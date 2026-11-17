import { findOwnedDevice, ownsHome } from '../homes/home.access.js';
import { db } from '../../config/database.js';
import { deviceService } from '../devices/device.service.js';
import type { RoutineRecord, CreateRoutineDTO, UpdateRoutineDTO } from './routine.types.js';

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(/IST/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }
  return (hours % 24) * 60 + minutes;
}

function getCurrentIstMinutes(date: Date = new Date()): { minutes: number; day: string; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const day = parts.find(p => p.type === 'weekday')?.value || '';
  const normalizedHour = hour === 24 ? 0 : hour;
  const minutes = normalizedHour * 60 + minute;
  const timeStr = `${normalizedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  return { minutes, day, timeStr };
}

export const routineService = {
  /**
   * Ensures the `routines` table exists in PostgreSQL.
   * Runs automatically at application boot.
   */
  ensureTableExists: async (): Promise<void> => {
    const query = `
      CREATE TABLE IF NOT EXISTS routines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          home_id UUID REFERENCES homes(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(50) DEFAULT 'sun',
          type VARCHAR(50) NOT NULL DEFAULT 'scene',
          room_id VARCHAR(100) DEFAULT 'all',
          schedule_time VARCHAR(50),
          schedule_off_time VARCHAR(50),
          repeat_days JSONB DEFAULT '[]',
          actions JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS routine_executions (
        routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        scheduled_minute TIMESTAMPTZ NOT NULL,
        target_state BOOLEAN NOT NULL,
        PRIMARY KEY (routine_id, scheduled_minute, target_state)
      );
      CREATE INDEX IF NOT EXISTS idx_routines_home_id ON routines(home_id);
      CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
      ALTER TABLE routines ADD COLUMN IF NOT EXISTS schedule_off_time VARCHAR(50);
    `;
    try {
      await db.query(query);
      console.log('✅ Routines table initialized in PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to verify routines table in PostgreSQL:', error);
      throw error;
    }
  },

  /**
   * Get all routines for a given home and/or user.
   * Returns empty array if no routines exist in the DB.
   */
  getRoutines: async (homeId?: string, userId?: string): Promise<RoutineRecord[]> => {
    try {
      let query = `SELECT * FROM routines WHERE 1=1`;
      const values: unknown[] = [];

      if (homeId) {
        values.push(homeId);
        query += ` AND home_id = $${values.length}`;
      }

      if (userId) {
        values.push(userId);
        query += ` AND user_id = $${values.length}`;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await db.query(query, values);
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching routines from database:', error);
      return [];
    }
  },

  /**
   * Get routine by ID
   */
  getRoutineById: async (id: string, userId?: string): Promise<RoutineRecord | null> => {
    try {
      const result = await db.query('SELECT * FROM routines WHERE id::text = $1 AND ($2::uuid IS NULL OR user_id = $2)', [id, userId ?? null]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching routine by ID:', error);
      return null;
    }
  },

  /**
   * Create a new routine (scene or scheduler)
   */
  createRoutine: async (userId: string, data: CreateRoutineDTO): Promise<RoutineRecord> => {
    const query = `
      INSERT INTO routines (
        home_id,
        user_id,
        name,
        description,
        icon,
        type,
        room_id,
        schedule_time,
        schedule_off_time,
        repeat_days,
        actions,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const isSchedule = data.type === 'schedule';
    const values = [
      data.homeId || null,
      userId || null,
      data.name,
      data.description || null,
      data.icon || (isSchedule ? 'clock' : 'sun'),
      data.type || 'scene',
      data.roomId || 'all',
      isSchedule ? (data.scheduleTime || null) : null,
      isSchedule ? (data.scheduleOffTime || null) : null,
      JSON.stringify(isSchedule ? (data.repeatDays || []) : []),
      JSON.stringify(data.actions || []),
      data.isActive !== undefined ? data.isActive : true,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Update an existing routine
   */
  updateRoutine: async (id: string, updates: UpdateRoutineDTO): Promise<RoutineRecord | null> => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      values.push(updates.name);
      fields.push(`name = $${values.length}`);
    }
    if (updates.description !== undefined) {
      values.push(updates.description);
      fields.push(`description = $${values.length}`);
    }
    if (updates.icon !== undefined) {
      values.push(updates.icon);
      fields.push(`icon = $${values.length}`);
    }
    if (updates.type !== undefined) {
      values.push(updates.type);
      fields.push(`type = $${values.length}`);

      if (updates.type === 'scene') {
        if (updates.scheduleTime === undefined) {
          fields.push(`schedule_time = NULL`);
        }
        if (updates.scheduleOffTime === undefined) {
          fields.push(`schedule_off_time = NULL`);
        }
        if (updates.repeatDays === undefined) {
          fields.push(`repeat_days = '[]'::jsonb`);
        }
      }
    }
    if (updates.roomId !== undefined) {
      values.push(updates.roomId);
      fields.push(`room_id = $${values.length}`);
    }
    if (updates.scheduleTime !== undefined) {
      values.push(updates.scheduleTime);
      fields.push(`schedule_time = $${values.length}`);
    }
    if (updates.scheduleOffTime !== undefined) {
      values.push(updates.scheduleOffTime);
      fields.push(`schedule_off_time = $${values.length}`);
    }
    if (updates.repeatDays !== undefined) {
      values.push(JSON.stringify(updates.repeatDays));
      fields.push(`repeat_days = $${values.length}`);
    }
    if (updates.actions !== undefined) {
      values.push(JSON.stringify(updates.actions));
      fields.push(`actions = $${values.length}`);
    }
    if (updates.isActive !== undefined) {
      values.push(updates.isActive);
      fields.push(`is_active = $${values.length}`);
    }

    if (fields.length === 0) {
      return routineService.getRoutineById(id);
    }

    values.push(id);
    const query = `
      UPDATE routines 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  },

  /**
   * Delete a routine
   */
  deleteRoutine: async (id: string): Promise<boolean> => {
    try {
      const result = await db.query(`DELETE FROM routines WHERE id = $1`, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting routine:', error);
      return false;
    }
  },

  validateActions: async (userId: string, homeId: string | null, actions: CreateRoutineDTO['actions']) => {
    if (!actions) return;
    if (!Array.isArray(actions)) throw new Error('Invalid routine actions');
    const devices = new Map<string, Awaited<ReturnType<typeof findOwnedDevice>>>();
    for (const action of actions) {
      if (!action || typeof action.deviceId !== 'string' || !Number.isInteger(action.channel) ||
          action.channel < 1 || typeof action.targetState !== 'boolean') {
        throw new Error('Invalid routine action');
      }
      if (!devices.has(action.deviceId)) devices.set(action.deviceId, await findOwnedDevice(userId, action.deviceId));
      const device = devices.get(action.deviceId);
      if (!device || (homeId && device.home_id !== homeId)) throw new Error('Device is outside this location');
    }
  },

  dispatchActions: async (routine: RoutineRecord, override?: boolean, scheduledAt?: Date) => {
    const actions = Array.isArray(routine.actions) ? routine.actions : [];
    let executedActions = 0;
    let failedActions = 0;
    if (!routine.user_id || (routine.home_id && !await ownsHome(routine.user_id, routine.home_id))) {
      return { success: false, executedActions, failedActions: actions.length };
    }
    const { rows } = await db.query(
      'INSERT INTO routine_history (home_id, user_id, name, scheduled_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [routine.home_id, routine.user_id, routine.name, scheduledAt ?? null]
    );
    const runId = rows[0].id;
    const results = [];
    for (const action of actions) {
      try {
        await routineService.validateActions(routine.user_id, routine.home_id, [action]);
        const target = override ?? action.targetState;
        await deviceService.controlSwitch(action.deviceId, action.channel, target ? 'on' : 'off', runId);
        results.push({ device: action.deviceName, channel: action.channel, sent: true });
        executedActions++;
      } catch (error) {
        results.push({ device: action?.deviceName, channel: action?.channel, sent: false,
          reason: error instanceof Error ? error.message : 'Command failed' });
        failedActions++;
      }
    }
    await db.query('UPDATE routine_history SET results = $2::jsonb WHERE id = $1', [runId, JSON.stringify(results)]);
    return { success: executedActions > 0 && failedActions === 0, executedActions, failedActions };
  },

  executeRoutine: async (id: string, userId: string) => {
    const routine = await routineService.getRoutineById(id, userId);
    if (!routine) throw new Error('Routine not found');
    return routineService.dispatchActions(routine);
  },

  startSchedulerEngine: (): void => {
    let running = false;
    let lastCleanup = 0;
    setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const now = new Date();
        const scheduledMinute = new Date(Math.floor(now.getTime() / 60000) * 60000);
        const { minutes, day } = getCurrentIstMinutes(now);
        if (now.getTime() - lastCleanup >= 86400000) {
          await db.query("DELETE FROM routine_executions WHERE scheduled_minute < NOW() - INTERVAL '7 days'");
          lastCleanup = now.getTime();
        }
        const result = await db.query<RoutineRecord>(
          "SELECT * FROM routines WHERE is_active = true AND (type = 'schedule' OR icon = 'clock')"
        );
        for (const routine of result.rows) {
          const repeatDays = Array.isArray(routine.repeat_days) ? routine.repeat_days : [];
          if (repeatDays.length && !repeatDays.some(d => typeof d === 'string' && d.toLowerCase().slice(0, 3) === day.toLowerCase().slice(0, 3))) continue;
          const times = [[routine.schedule_time, true], [routine.schedule_off_time, false]] as const;
          for (const [time, target] of times) {
            if (parseTimeToMinutes(time) !== minutes) continue;
            const claim = await db.query(
              'INSERT INTO routine_executions VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [routine.id, scheduledMinute, target]
            );
            if (!claim.rowCount) continue;
            const outcome = await routineService.dispatchActions(routine, target, scheduledMinute);
            if (!outcome.success) console.warn('Scheduled routine did not complete', routine.id, outcome);
          }
        }
      } catch (error) {
        console.error('Error running scheduler', error);
      } finally {
        running = false;
      }
    }, 10000).unref();
  },
};

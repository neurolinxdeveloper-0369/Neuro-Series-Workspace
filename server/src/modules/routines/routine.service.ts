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

      CREATE INDEX IF NOT EXISTS idx_routines_home_id ON routines(home_id);
      CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
      ALTER TABLE routines ADD COLUMN IF NOT EXISTS schedule_off_time VARCHAR(50);
    `;
    try {
      await db.query(query);
      console.log('✅ Routines table initialized in PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to verify routines table in PostgreSQL:', error);
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
        query += ` AND (home_id = $${values.length} OR home_id IS NULL)`;
      }

      if (userId) {
        values.push(userId);
        query += ` AND (user_id = $${values.length} OR user_id IS NULL)`;
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
  getRoutineById: async (id: string): Promise<RoutineRecord | null> => {
    try {
      const result = await db.query(`SELECT * FROM routines WHERE id = $1`, [id]);
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

  /**
   * Execute routine actions across connected devices
   */
  executeRoutine: async (id: string): Promise<{ success: boolean; executedActions: number }> => {
    const routine = await routineService.getRoutineById(id);
    if (!routine) {
      throw new Error('Routine not found');
    }

    const actions = Array.isArray(routine.actions) ? routine.actions : [];
    let count = 0;

    for (const act of actions) {
      if (act.deviceId && act.channel) {
        try {
          await deviceService.controlSwitch(act.deviceId, act.channel, act.targetState ? 'on' : 'off');
          count++;
        } catch (err) {
          console.error(`Failed to execute routine action on device ${act.deviceId}:`, err);
        }
      }
    }

    return { success: true, executedActions: count };
  },

  /**
   * Starts background automated scheduler engine for time-based hardware control
   */
  startSchedulerEngine: (): void => {
    const firedKeys = new Set<string>();

    setInterval(async () => {
      try {
        const now = new Date();
        const { minutes: currentMinutes, day: istDay, timeStr: istTimeStr } = getCurrentIstMinutes(now);
        const minuteKey = `${istDay}_${istTimeStr}`;

        const schedulesResult = await db.query(
          `SELECT * FROM routines WHERE is_active = true AND (type = 'schedule' OR icon = 'clock')`
        );
        const schedules: RoutineRecord[] = schedulesResult.rows || [];

        for (const sched of schedules) {
          const repeatDays: string[] = Array.isArray(sched.repeat_days) ? sched.repeat_days : [];
          if (repeatDays.length > 0 && !repeatDays.some(d => d.toLowerCase().slice(0, 3) === istDay.toLowerCase().slice(0, 3))) {
            continue;
          }

          // Check ON Time match
          if (sched.schedule_time) {
            const onMinutes = parseTimeToMinutes(sched.schedule_time);
            if (onMinutes !== null && onMinutes === currentMinutes) {
              const onKey = `${sched.id}_on_${minuteKey}`;
              if (!firedKeys.has(onKey)) {
                firedKeys.add(onKey);
                console.log(`⏰ [SERVER SCHEDULER] Triggering ON: "${sched.name}" at ${istTimeStr} IST (${istDay})`);
                const actions = Array.isArray(sched.actions) ? sched.actions : [];
                for (const act of actions) {
                  if (act.deviceId && act.channel) {
                    try {
                      await deviceService.controlSwitch(act.deviceId, act.channel, 'on');
                      console.log(`✅ [SCHEDULER ACTION] Turn ON dev ${act.deviceId} ch ${act.channel} SUCCESS`);
                    } catch (e: any) {
                      console.error(`❌ [SCHEDULER ACTION] Turn ON dev ${act.deviceId} ch ${act.channel} FAILED:`, e.message);
                    }
                  }
                }
              }
            }
          }

          // Check OFF Time match
          if (sched.schedule_off_time) {
            const offMinutes = parseTimeToMinutes(sched.schedule_off_time);
            if (offMinutes !== null && offMinutes === currentMinutes) {
              const offKey = `${sched.id}_off_${minuteKey}`;
              if (!firedKeys.has(offKey)) {
                firedKeys.add(offKey);
                console.log(`⏰ [SERVER SCHEDULER] Triggering OFF: "${sched.name}" at ${istTimeStr} IST (${istDay})`);
                const actions = Array.isArray(sched.actions) ? sched.actions : [];
                for (const act of actions) {
                  if (act.deviceId && act.channel) {
                    try {
                      await deviceService.controlSwitch(act.deviceId, act.channel, 'off');
                      console.log(`✅ [SCHEDULER ACTION] Turn OFF dev ${act.deviceId} ch ${act.channel} SUCCESS`);
                    } catch (e: any) {
                      console.error(`❌ [SCHEDULER ACTION] Turn OFF dev ${act.deviceId} ch ${act.channel} FAILED:`, e.message);
                    }
                  }
                }
              }
            }
          }
        }

        if (firedKeys.size > 200) firedKeys.clear();
      } catch (err) {
        console.error('Error running automated server scheduler engine:', err);
      }
    }, 10000); // Poll every 10 seconds for real-time accuracy
  },
};


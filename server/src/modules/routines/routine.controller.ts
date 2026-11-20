import { db } from '../../config/database.js';
import { activityOutcome } from '../history/history.service.js';
import { ownsHome } from '../homes/home.access.js';
import { Router, type Response } from 'express';
import { routineService } from './routine.service.js';
import { validateSchedule } from './schedule.js';
import { authenticateToken, type AuthenticatedRequest } from '../auth/auth.middleware.js';
import type { CreateRoutineDTO, UpdateRoutineDTO } from './routine.types.js';

export const routineRouter = Router();

// Protect all routine endpoints with JWT authentication
routineRouter.use(authenticateToken);

// GET /api/routines - List all scenes & schedules from database
routineRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const homeId = (req.query.homeId as string) || undefined;
    if (homeId && !await ownsHome(userId!, homeId)) return res.status(404).json({ success: false, error: 'Location not found' });
    const routines = await routineService.getRoutines(homeId, userId);
    return res.json({ success: true, routines });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch routines';
    return res.status(500).json({ success: false, error: message });
  }
});

routineRouter.get('/history/:homeId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const homeId = String(req.params.homeId);
    if (!await ownsHome(req.user!.id, homeId)) return res.status(404).json({ error: 'Location not found' });
    const runs = await db.query(`
      SELECT r.id, r.name, r.created_at, r.scheduled_at, r.results,
           COALESCE((SELECT jsonb_agg(to_jsonb(detail) ORDER BY detail.id)
             FROM (SELECT a.id, d.custom_name AS device, a.channel, a.target, a.failure, a.observed_at, ${activityOutcome}
                   FROM device_activity a JOIN devices d ON d.id = a.device_id WHERE a.run_id = r.id) detail
           ), '[]'::jsonb) AS commands
      FROM routine_history r WHERE r.home_id = $1 AND r.user_id = $2 ORDER BY r.created_at DESC LIMIT 50
    `, [homeId, req.user!.id]);
    return res.json({ runs: runs.rows });
  } catch (error) { next(error); }
});

// GET /api/routines/:id - Get routine by ID
routineRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const routine = await routineService.getRoutineById(id, req.user!.id);
    if (!routine) {
      return res.status(404).json({ success: false, error: 'Routine not found' });
    }
    return res.json({ success: true, routine });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch routine';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/routines - Create a new scene or schedule in PostgreSQL
routineRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const body = req.body as CreateRoutineDTO;
    const scheduleError = validateSchedule(body);
    if (scheduleError) return res.status(400).json({ success: false, error: scheduleError });
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ success: false, error: 'Routine name is required' });
    }

    if (body.homeId && !await ownsHome(userId, body.homeId)) return res.status(404).json({ success: false, error: 'Location not found' });
    await routineService.validateActions(userId, body.homeId ?? null, body.actions);
    const created = await routineService.createRoutine(userId, body);
    return res.status(201).json({ success: true, routine: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create routine';
    return res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/routines/:id - Update an existing routine
routineRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body as UpdateRoutineDTO;
    const existing = await routineService.getRoutineById(id, req.user!.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Routine not found' });
    const scheduleError = validateSchedule({ type: body.type ?? existing.type, scheduleTime: body.scheduleTime ?? existing.schedule_time,
      scheduleOffTime: body.scheduleOffTime ?? existing.schedule_off_time, repeatDays: body.repeatDays ?? existing.repeat_days });
    if (scheduleError) return res.status(400).json({ success: false, error: scheduleError });
    await routineService.validateActions(req.user!.id, existing.home_id, body.actions);
    const updated = await routineService.updateRoutine(id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Routine not found' });
    }
    return res.json({ success: true, routine: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update routine';
    return res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/routines/:id - Delete routine
routineRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!await routineService.getRoutineById(id, req.user!.id)) return res.status(404).json({ success: false, error: 'Routine not found' });
    const success = await routineService.deleteRoutine(id);
    return res.json({ success });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete routine';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/routines/:id/run - Execute routine
routineRouter.post('/:id/run', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await routineService.executeRoutine(id, req.user!.id);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute routine';
    return res.status(error instanceof RangeError ? 400 : 500).json({ success: false, error: message });
  }
});

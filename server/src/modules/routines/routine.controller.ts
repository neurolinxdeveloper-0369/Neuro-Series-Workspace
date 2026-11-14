import { Router, type Response } from 'express';
import { routineService } from './routine.service.js';
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
    const routines = await routineService.getRoutines(homeId, userId);
    return res.json({ success: true, routines });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch routines';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/routines/:id - Get routine by ID
routineRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const routine = await routineService.getRoutineById(id);
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
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ success: false, error: 'Routine name is required' });
    }

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
    const result = await routineService.executeRoutine(id);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute routine';
    return res.status(500).json({ success: false, error: message });
  }
});

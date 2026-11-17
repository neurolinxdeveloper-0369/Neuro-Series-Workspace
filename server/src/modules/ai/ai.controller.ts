import { Router, Request, Response } from 'express';
import { aiService } from './ai.service.js';
import { authenticateToken } from '../auth/auth.middleware.js';

export const aiRouter = Router();

/**
 * POST /api/ai/chat
 * User sends query + optional history.
 * Grounded in PostgreSQL + EMQX live state, routed to Ollama / grounded engine.
 */
aiRouter.post(
  '/chat',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { message, history, homeId } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const result = await aiService.chat(userId, message, history, typeof homeId === 'string' ? homeId : undefined);
      res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[ai.controller] Error in /chat:', err);
      res.status(500).json({
        error: 'Failed to process AI chat query',
        details: err?.message || 'Internal server error',
      });
    }
  }
);

/**
 * GET /api/ai/telemetry
 * Fetches the user's real-time device, switch, and routine state snapshot.
 */
aiRouter.get(
  '/telemetry',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const context = await aiService.getRealtimeContext(userId);
      res.json({
        success: true,
        context,
      });
    } catch (err: any) {
      console.error('[ai.controller] Error in /telemetry:', err);
      res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
  }
);

/**
 * GET /api/ai/status
 * Check Ollama connection status and available models.
 */
aiRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await aiService.isOllamaAvailable();
    res.json({
      success: true,
      ollama: status,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check AI status' });
  }
});

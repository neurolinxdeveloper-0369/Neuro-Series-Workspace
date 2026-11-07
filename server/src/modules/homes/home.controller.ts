import { Router, type Response } from 'express';
import { homeService } from './home.service.js';
import { authenticateToken, type AuthenticatedRequest } from '../auth/auth.middleware.js';
import type { PropertyType } from './home.types.js';

export const homeRouter = Router();

// Protect all home endpoints with JWT authentication
homeRouter.use(authenticateToken);

// GET /api/homes - List all homes for logged-in user
homeRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homes = await homeService.getHomesByOwner(userId);
    return res.json({ success: true, homes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch homes';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/homes - Create a new home
homeRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      name,
      property_type,
      floor_count,
      address_line,
      city,
      latitude,
      longitude,
      timezone,
      default_wifi_ssid,
      wifi_password,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Home name is required' });
    }

    const validPropertyTypes: PropertyType[] = ['Flat', 'Apartment', 'Villa', 'House', 'Office', 'Building'];
    const pType = validPropertyTypes.includes(property_type) ? (property_type as PropertyType) : 'House';

    const home = await homeService.createHome(userId, {
      name,
      property_type: pType,
      floor_count: Number(floor_count) || 1,
      address_line,
      city,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : undefined,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : undefined,
      timezone,
      default_wifi_ssid,
      wifi_password,
    });

    return res.status(201).json({ success: true, home });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create home';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/homes/:id - Get single home details
homeRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const home = await homeService.getHomeById(homeId, userId);
    if (!home) {
      return res.status(404).json({ success: false, error: 'Home not found' });
    }

    return res.json({ success: true, home });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch home';
    return res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/homes/:id - Update home details
homeRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await homeService.updateHome(homeId, userId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Home not found or update failed' });
    }

    return res.json({ success: true, home: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update home';
    return res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/homes/:id - Delete a home
homeRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await homeService.deleteHome(homeId, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Home not found or delete failed' });
    }

    return res.json({ success: true, message: 'Home removed successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete home';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/homes/:id/qr - Generate QR invite payload
homeRouter.get('/:id/qr', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await homeService.generateSharePayload(homeId, userId);
    return res.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate QR payload';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/homes/:id/rooms - Get all rooms
homeRouter.get('/:id/rooms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rooms = await homeService.getRoomsByHome(homeId);
    return res.json({ success: true, rooms });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch rooms';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/homes/:id/rooms - Create a room
homeRouter.post('/:id/rooms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Room name is required' });
    }
    const room = await homeService.createRoom(homeId, name);
    return res.status(201).json({ success: true, room });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    return res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/homes/:id/rooms/:roomId - Delete a room
homeRouter.delete('/:id/rooms/:roomId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
    const deleted = await homeService.deleteRoom(homeId, roomId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    return res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/homes/:id/invitations - Send member invite
homeRouter.post('/:id/invitations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { email, accessLevel } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email or account is required' });
    }

    const invitation = await homeService.sendInvitation(homeId, userId, email, accessLevel || 'Full access');
    return res.status(201).json({ success: true, invitation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send invitation';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/homes/:id/invitations - List invitations
homeRouter.get('/:id/invitations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const homeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const invitations = await homeService.getInvitations(homeId);
    return res.json({ success: true, invitations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invitations';
    return res.status(500).json({ success: false, error: message });
  }
});

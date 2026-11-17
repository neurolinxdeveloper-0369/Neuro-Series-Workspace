import { db } from '../../config/database.js';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.middleware.js';

export async function ownsHome(userId: string, homeId: string): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM homes WHERE id::text = $1 AND owner_id = $2', [homeId, userId]);
  return Boolean(result.rowCount);
}

export async function canAccessHome(userId: string, homeId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM homes h WHERE h.id::text = $1 AND
     (h.owner_id = $2 OR EXISTS (SELECT 1 FROM home_members m WHERE m.home_id = h.id AND m.user_id = $2))`,
    [homeId, userId]
  );
  return Boolean(result.rowCount);
}

export async function findOwnedDevice(userId: string, deviceId: string, includeMembers = false): Promise<{ device_id: string; home_id: string } | undefined> {
  const result = await db.query(
    `SELECT d.device_id, d.home_id FROM devices d JOIN homes h ON h.id = d.home_id
     WHERE (h.owner_id = $1 OR ($3::boolean AND EXISTS (
       SELECT 1 FROM home_members m WHERE m.home_id = h.id AND m.user_id = $1
     ))) AND (d.id::text = $2 OR d.device_id = $2)`,
    [userId, deviceId, includeMembers]
  );
  return result.rows[0];
}

export async function requireHomeOwner(req: AuthenticatedRequest, res: Response, next: NextFunction, homeId: string) {
  try {
    if (!req.user || !await ownsHome(req.user.id, homeId)) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

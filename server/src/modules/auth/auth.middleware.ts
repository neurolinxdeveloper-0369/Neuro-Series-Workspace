import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    phone_number?: string;
  };
}

export function verifySessionToken(token: string) {
  const decoded = jwt.verify(token, ENV.JWT_SECRET, { algorithms: ['HS256'], audience: 'neuro-series-verified-session' });
  if (typeof decoded === 'string' || typeof decoded.id !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(decoded.id) ||
      typeof decoded.exp !== 'number') {
    throw new Error('Invalid session');
  }
  return { id: decoded.id, email: decoded.email, phone_number: decoded.phone_number, expiresAt: decoded.exp * 1000 };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    req.user = verifySessionToken(token);
    next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

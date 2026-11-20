import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';

const derive = promisify(scrypt);
export async function verifyOtaCode(code: unknown, encoded = process.env.OTA_ACCESS_CODE_HASH || '') {
  if (typeof code !== 'string' || code.length < 8 || code.length > 128) return false;
  const [salt, hash] = encoded.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
  const actual = await derive(code, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export function issueOtaSession() {
  return jwt.sign({ scope: 'firmware-admin' }, ENV.JWT_SECRET, { algorithm: 'HS256', audience: 'neuro-ota-admin', expiresIn: '30m' });
}
export function verifyOtaSession(token: string) {
  const decoded = jwt.verify(token, ENV.JWT_SECRET, { algorithms: ['HS256'], audience: 'neuro-ota-admin' });
  if (typeof decoded === 'string' || decoded.scope !== 'firmware-admin' || typeof decoded.exp !== 'number') throw new Error('Invalid OTA session');
  return { expiresAt: decoded.exp * 1000 };
}

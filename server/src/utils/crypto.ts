import crypto from 'crypto';
import { ENV } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'neuro-series-homes-salt-2026';

// Derive a 32-byte (256-bit) encryption key from the environment secret
const getKey = (): Buffer => {
  return crypto.scryptSync(ENV.JWT_SECRET, SALT, 32);
};

/**
 * Encrypts sensitive text (such as Wi-Fi passwords) using AES-256-GCM with authentication tag.
 * Returns format: ivHex:authTagHex:cipherHex
 */
export const encryptSecret = (plainText: string): string => {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts ciphertext previously encrypted with encryptSecret.
 */
export const decryptSecret = (cipherPayload: string): string => {
  if (!cipherPayload) return '';
  const parts = cipherPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, encryptedText] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

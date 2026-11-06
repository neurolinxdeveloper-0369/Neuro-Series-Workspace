import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../../config/database.js';
import { ENV } from '../../config/env.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export class AuthService {
  // Sign JWT token for user
  public generateToken(userId: string, email?: string, phoneNumber?: string): string {
    return jwt.sign(
      { id: userId, email, phone_number: phoneNumber },
      ENV.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  // Google OAuth Login / Registration
  public async handleGoogleAuth(idToken: string) {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: ENV.GOOGLE_CLIENT_ID || undefined,
      });
      payload = ticket.getPayload();
    } catch {
      // In development / testing without valid Google Client ID, safely extract or validate
      throw new Error('Invalid Google ID token');
    }

    if (!payload || !payload.sub) {
      throw new Error('Invalid Google token payload');
    }

    const googleSub = payload.sub;
    const email = payload.email || null;
    const fullName = payload.name || 'Neuro Series User';
    const avatarUrl = payload.picture || null;

    // Check if auth identity exists
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const existingIdentity = await client.query(
        'SELECT user_id FROM auth_identities WHERE provider = $1 AND provider_key = $2',
        ['google', googleSub]
      );

      let userId: string;

      if (existingIdentity.rows.length > 0) {
        userId = existingIdentity.rows[0].user_id;
        // Update last login
        await client.query(
          'UPDATE auth_identities SET last_login = NOW() WHERE provider = $1 AND provider_key = $2',
          ['google', googleSub]
        );
      } else {
        // Create new user in users table
        const newUserRes = await client.query(
          `INSERT INTO users (full_name, email, avatar_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
           RETURNING id, full_name, email, avatar_url`,
          [fullName, email, avatarUrl]
        );
        userId = newUserRes.rows[0].id;

        // Insert into auth_identities
        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
          [userId, 'google', googleSub]
        );
      }

      await client.query('COMMIT');

      // Fetch complete user profile
      const userProfile = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userProfile.rows[0];
      const token = this.generateToken(user.id, user.email, user.phone_number);

      return { user, token };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Phone Number Login / OTP verification
  public async handlePhoneAuth(phoneNumber: string, fullName?: string) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const existingIdentity = await client.query(
        'SELECT user_id FROM auth_identities WHERE provider = $1 AND provider_key = $2',
        ['phone', phoneNumber]
      );

      let userId: string;

      if (existingIdentity.rows.length > 0) {
        userId = existingIdentity.rows[0].user_id;
        await client.query(
          'UPDATE auth_identities SET last_login = NOW() WHERE provider = $1 AND provider_key = $2',
          ['phone', phoneNumber]
        );
      } else {
        const newUserRes = await client.query(
          `INSERT INTO users (full_name, phone_number)
           VALUES ($1, $2)
           ON CONFLICT (phone_number) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [fullName || 'Neuro Series User', phoneNumber]
        );
        userId = newUserRes.rows[0].id;

        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
          [userId, 'phone', phoneNumber]
        );
      }

      await client.query('COMMIT');

      const userProfile = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userProfile.rows[0];
      const token = this.generateToken(user.id, user.email, user.phone_number);

      return { user, token };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get current user by ID
  public async getUserById(userId: string) {
    const res = await db.query('SELECT id, full_name, email, phone_number, avatar_url, created_at FROM users WHERE id = $1', [userId]);
    return res.rows[0] || null;
  }
}

export const authService = new AuthService();

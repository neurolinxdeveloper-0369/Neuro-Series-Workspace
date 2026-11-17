import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { db } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { openwaService } from './openwa.service.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_WEB_CLIENT_ID);

export class AuthService {
  private async storeOtp(table: 'email_otps' | 'phone_otps', column: 'email' | 'phone_number', identity: string, otp: string, minutes: number) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [table + ':' + identity]);
      const recent = await client.query(
        `SELECT 1 FROM ${table} WHERE ${column} = $1 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
        [identity]
      );
      if (recent.rowCount) throw new Error('Wait 60 seconds before requesting another code.');
      await client.query(`UPDATE ${table} SET verified = TRUE WHERE ${column} = $1 AND verified = FALSE`, [identity]);
      await client.query(
        `INSERT INTO ${table} (${column}, otp, expires_at) VALUES ($1, $2, NOW() + $3 * INTERVAL '1 minute')`,
        [identity, otp, minutes]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Ensure users, auth_identities, email_otps, and phone_otps tables exist
  public async ensureTablesExist() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          phone_number VARCHAR(50) UNIQUE,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auth_identities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          provider VARCHAR(50) NOT NULL,
          provider_key VARCHAR(255) NOT NULL,
          last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider, provider_key)
        );

        CREATE TABLE IF NOT EXISTS email_otps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          otp VARCHAR(10) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          attempts INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

        CREATE TABLE IF NOT EXISTS phone_otps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_number VARCHAR(50) NOT NULL,
          otp VARCHAR(10) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          attempts INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone_number);
      `);
      console.log('✅ Users, Auth Identities, Email OTP, and Phone OTP tables verified in PostgreSQL');
    } catch (err) {
      console.error('❌ Failed to ensure auth tables exist:', err);
      throw err;
    }
  }

  // Sign JWT token for user
  public generateToken(userId: string, email?: string, phoneNumber?: string): string {
    return jwt.sign(
      { id: userId, email, phone_number: phoneNumber },
      ENV.JWT_SECRET,
      { expiresIn: '30d', audience: 'neuro-series-verified-session' }
    );
  }

  // Send 6-digit OTP to Email
  public async sendEmailOtp(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 1000000).toString();

    // Invalidate existing unused OTPs
    await this.storeOtp('email_otps', 'email', email, otp, 10);


    // Send email via nodemailer if SMTP configured
    let emailSent = false;
    const cleanPass = ENV.SMTP_PASS.trim().replace(/\s+/g, '');
    if (ENV.SMTP_USER && cleanPass) {
      try {
        const isGmail = ENV.SMTP_HOST.includes('gmail.com');
        const transporter = nodemailer.createTransport(
          isGmail
            ? {
                service: 'gmail',
                auth: {
                  user: ENV.SMTP_USER,
                  pass: cleanPass,
                },
              }
            : {
                host: ENV.SMTP_HOST,
                port: ENV.SMTP_PORT,
                secure: ENV.SMTP_PORT === 465,
                auth: {
                  user: ENV.SMTP_USER,
                  pass: cleanPass,
                },
                tls: {
                  rejectUnauthorized: false,
                },
              }
        );

        await transporter.sendMail({
          from: ENV.SMTP_FROM,
          to: email,
          subject: `${otp} is your Neuro Series verification code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; background-color: #f8fafc; border-radius: 20px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0284c7; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Neuro Series</h1>
                <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">Smart Home Automation</p>
              </div>
              <div style="background-color: #ffffff; padding: 32px 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); text-align: center; border: 1px solid #f1f5f9;">
                <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 8px;">Sign in verification</h2>
                <p style="color: #475569; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">Enter the following 6-digit verification code to sign in to your Neuro Series account:</p>
                <div style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0284c7; background: #f0f9ff; padding: 14px 28px; border-radius: 12px; border: 2px dashed #38bdf8;">
                  ${otp}
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; margin-bottom: 0;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
              </div>
              <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 20px;">&copy; 2026 Neuro Series. All rights reserved.</p>
            </div>
          `,
        });
        emailSent = true;
        console.log(`📧 [EMAIL SENT] Verification code successfully sent to ${email} via ${ENV.SMTP_USER}`);
      } catch {
        console.error('Email OTP delivery failed');
      }
    }
    if (!emailSent) {
      await db.query('DELETE FROM email_otps WHERE email = $1 AND otp = $2', [email, otp]);
      throw new Error('Email delivery unavailable. Try again later.');
    }

    return {
      success: true,
      message: 'Verification code sent to your email',
      email,
    };
  }

  // Verify 6-digit OTP and Sign In / Register User
  public async verifyEmailOtp(rawEmail: string, rawOtp: string, fullName?: string) {
    const email = rawEmail.trim().toLowerCase();
    const otp = rawOtp.trim();

    if (!email || !otp) {
      throw new Error('Email and verification code are required');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['email_otps:' + email]);
      // Verify OTP in email_otps table
      const otpRes = await client.query(
        `SELECT id, attempts, expires_at 
         FROM email_otps 
         WHERE email = $1 AND otp = $2 AND verified = FALSE AND expires_at > NOW() AND attempts < 5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [email, otp]
      );

      if (otpRes.rows.length === 0) {
        await client.query(
          `UPDATE email_otps SET attempts = attempts + 1 WHERE email = $1 AND verified = FALSE AND expires_at > NOW() AND attempts < 5`,
          [email]
        );
        await client.query('COMMIT');
        throw new Error('Invalid or expired verification code');
      }

      // Mark OTP as verified
      await client.query(
        `UPDATE email_otps SET verified = TRUE WHERE id = $1`,
        [otpRes.rows[0].id]
      );

      // Check if user exists by email
      const existingUser = await client.query(
        `SELECT id, full_name, email, phone_number, avatar_url FROM users WHERE email = $1`,
        [email]
      );

      let userId: string;

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_key, last_login)
           VALUES ($1, 'email', $2, NOW())
           ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
          [userId, email]
        );
      } else {
        const defaultName = fullName?.trim() || email.split('@')[0] || 'Neuro Series User';
        const newUserRes = await client.query(
          `INSERT INTO users (full_name, email)
           VALUES ($1, $2)
           ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
           RETURNING id, full_name, email, phone_number, avatar_url`,
          [defaultName, email]
        );
        userId = newUserRes.rows[0].id;

        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_key, last_login)
           VALUES ($1, 'email', $2, NOW())
           ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
          [userId, email]
        );
      }

      await client.query('COMMIT');

      const userProfile = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userProfile.rows[0];
      const token = this.generateToken(user.id, user.email, user.phone_number);

      console.log(`✅ [EMAIL OTP VERIFIED] User ${user.email} (${user.id}) signed in successfully`);
      return { user, token };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Send 6-digit OTP to WhatsApp via OpenWA Gateway (5-minute expiry)
  public async sendWhatsAppOtp(rawPhone: string) {
    const cleanPhone = openwaService.cleanPhoneNumber(rawPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Please enter a valid phone number (at least 10 digits)');
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 1000000).toString();
    await this.storeOtp('phone_otps', 'phone_number', cleanPhone, otp, 5);

    // Dispatch via OpenWA WhatsApp Gateway
    let messageId: string | undefined;
    try {
      const sendRes = await openwaService.sendOtp(cleanPhone, otp, 5);
      messageId = sendRes.messageId;
    } catch {
      await db.query('DELETE FROM phone_otps WHERE phone_number = $1 AND otp = $2', [cleanPhone, otp]);
      throw new Error('WhatsApp delivery unavailable. Try again later.');
    }

    return {
      success: true,
      message: 'Verification code sent to your WhatsApp',
      phoneNumber: cleanPhone,
      messageId,
    };
  }

  // Verify 6-digit WhatsApp OTP and Sign In / Register User
  public async verifyWhatsAppOtp(rawPhone: string, rawOtp: string, fullName?: string) {
    const cleanPhone = openwaService.cleanPhoneNumber(rawPhone);
    const otp = rawOtp.trim();

    if (!cleanPhone || !otp) {
      throw new Error('Phone number and verification code are required');
    }

    let isMatch = false;

    // Check DB first
    try {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['phone_otps:' + cleanPhone]);
        const otpRes = await client.query(
          `SELECT id, attempts, expires_at 
           FROM phone_otps 
           WHERE phone_number = $1 AND otp = $2 AND verified = FALSE AND expires_at > NOW() AND attempts < 5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [cleanPhone, otp]
        );

        if (otpRes.rows.length > 0) {
          isMatch = true;
          await client.query(`UPDATE phone_otps SET verified = TRUE WHERE id = $1`, [otpRes.rows[0].id]);
        } else {
          await client.query(
            `UPDATE phone_otps SET attempts = attempts + 1 WHERE phone_number = $1 AND verified = FALSE AND expires_at > NOW() AND attempts < 5`,
            [cleanPhone]
          );
        }

        if (isMatch) {
          // Find or create user
          const existingUser = await client.query(
            `SELECT id, full_name, email, phone_number, avatar_url FROM users WHERE phone_number = $1`,
            [cleanPhone]
          );

          let userId: string;

          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            await client.query(
              `INSERT INTO auth_identities (user_id, provider, provider_key, last_login)
               VALUES ($1, 'whatsapp', $2, NOW())
               ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
              [userId, cleanPhone]
            );
          } else {
            const defaultName = fullName?.trim() || `User ${cleanPhone.slice(-4)}`;
            const newUserRes = await client.query(
              `INSERT INTO users (full_name, phone_number)
               VALUES ($1, $2)
               ON CONFLICT (phone_number) DO UPDATE SET updated_at = NOW()
               RETURNING id, full_name, email, phone_number, avatar_url`,
              [defaultName, cleanPhone]
            );
            userId = newUserRes.rows[0].id;

            await client.query(
              `INSERT INTO auth_identities (user_id, provider, provider_key, last_login)
               VALUES ($1, 'whatsapp', $2, NOW())
               ON CONFLICT (provider, provider_key) DO UPDATE SET last_login = NOW()`,
              [userId, cleanPhone]
            );
          }

          await client.query('COMMIT');

          const userProfile = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
          const user = userProfile.rows[0];
          const token = this.generateToken(user.id, user.email, user.phone_number);

          // Clear from in-memory cache

          console.log(`✅ [WHATSAPP OTP VERIFIED] User ${cleanPhone} (${user.id}) signed in successfully`);
          return { user, token };
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (dbErr) {
      console.error('Database error during WhatsApp OTP verification:', dbErr);
      throw new Error('Invalid or expired verification code');
    }

    if (!isMatch) {
      throw new Error('Invalid or expired verification code');
    }
  }

  // Google OAuth Login / Registration
  public async handleGoogleAuth(params: { idToken?: string; accessToken?: string }) {
    const { idToken, accessToken } = params;
    const validAudiences = [
      ENV.GOOGLE_WEB_CLIENT_ID,
      ENV.GOOGLE_ANDROID_CLIENT_ID,
      ENV.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean);

    if (!validAudiences.length) throw new Error('Google sign-in is unavailable.');

    let googleSub: string;
    let email: string | null = null;
    let fullName = 'Neuro Series User';
    let avatarUrl: string | null = null;

    if (idToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: validAudiences,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub) {
          throw new Error('Invalid Google token payload');
        }
        googleSub = payload.sub;
        email = payload.email_verified === true ? payload.email?.trim().toLowerCase() || null : null;
        fullName = payload.name || 'Neuro Series User';
        avatarUrl = payload.picture || null;
      } catch (err: unknown) {
        throw new Error('Google ID token verification failed');
      }
    } else if (accessToken) {
      try {
        const tokenInfo = await googleClient.getTokenInfo(accessToken);
        if (!validAudiences.includes(tokenInfo.aud)) throw new Error('Invalid Google token audience');
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) {
          throw new Error(`Google userinfo returned status ${userInfoRes.status}`);
        }
        const info = await userInfoRes.json() as {
          sub: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
        };
        if (!info || !info.sub) {
          throw new Error('Failed to retrieve user info from Google');
        }
        googleSub = info.sub;
        email = info.email_verified === true ? info.email?.trim().toLowerCase() || null : null;
        fullName = info.name || 'Neuro Series User';
        avatarUrl = info.picture || null;
      } catch (err: unknown) {
        throw new Error('Google access token verification failed');
      }
    } else {
      throw new Error('Either idToken or accessToken is required for Google Sign-In');
    }

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

  // Get current user by ID
  public async getUserById(userId: string) {
    const res = await db.query('SELECT id, full_name, email, phone_number, avatar_url, created_at FROM users WHERE id = $1', [userId]);
    return res.rows[0] || null;
  }
}

export const authService = new AuthService();

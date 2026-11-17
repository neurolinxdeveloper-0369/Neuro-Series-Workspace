import { Router, type Response } from 'express';
import { authService } from './auth.service.js';
import { authenticateToken, type AuthenticatedRequest } from './auth.middleware.js';

export const authRouter = Router();

// POST /api/auth/google
authRouter.post('/google', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    if (!idToken && !accessToken) {
      return res.status(400).json({ success: false, error: 'idToken or accessToken is required' });
    }

    const result = await authService.handleGoogleAuth({ idToken, accessToken });
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Google authentication failed';
    return res.status(400).json({ success: false, error: message });
  }
});

// POST /api/auth/send-otp
authRouter.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const result = await authService.sendEmailOtp(email);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return res.status(400).json({ success: false, error: message });
  }
});

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, fullName } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and verification code are required' });
    }

    const result = await authService.verifyEmailOtp(email, otp, fullName);
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'OTP verification failed';
    return res.status(400).json({ success: false, error: message });
  }
});

// POST /api/auth/whatsapp/send-otp and /api/auth/send-whatsapp-otp
authRouter.post(['/whatsapp/send-otp', '/send-whatsapp-otp', '/whatsapp-otp'], async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.body.phone;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const result = await authService.sendWhatsAppOtp(phoneNumber);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send WhatsApp OTP';
    return res.status(400).json({ success: false, error: message });
  }
});

// POST /api/auth/whatsapp/verify-otp and /api/auth/verify-whatsapp-otp
authRouter.post(['/whatsapp/verify-otp', '/verify-whatsapp-otp', '/phone'], async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.body.phone;
    const { otp, fullName } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and verification code are required' });
    }

    const result = await authService.verifyWhatsAppOtp(phoneNumber, otp, fullName);
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'WhatsApp OTP verification failed';
    return res.status(400).json({ success: false, error: message });
  }
});

// GET /api/auth/me (Protected)
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    return res.status(500).json({ success: false, error: message });
  }
});

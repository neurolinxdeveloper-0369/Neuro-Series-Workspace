import { ENV } from '../../config/env.js';

interface OpenWASession {
  id: string;
  name: string;
  status: string;
  phone?: string;
  pushName?: string;
}

export class OpenWAService {
  private cachedSessionId: string = ENV.OPENWA_SESSION_ID || '';

  /**
   * Normalizes incoming phone number to standard international format (e.g. 919876543210 for India)
   */
  public cleanPhoneNumber(rawPhone: string): string {
    if (!rawPhone) return '';
    // Remove all non-digit characters
    let digits = rawPhone.replace(/\D/g, '');

    // Handle leading zeros (e.g. 09876543210 -> 9876543210)
    if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.substring(1);
    }

    // Standard 10-digit Indian numbers starting with 6, 7, 8, or 9
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      digits = '91' + digits;
    }

    return digits;
  }

  /**
   * Constructs the WhatsApp Chat ID (e.g., 919876543210@c.us)
   */
  public getChatId(phone: string): string {
    const clean = this.cleanPhoneNumber(phone);
    if (!clean) throw new Error('Invalid phone number provided');
    return `${clean}@c.us`;
  }

  /**
   * Dynamically resolves the active OpenWA Session ID
   */
  public async getSessionId(forceRefresh = false): Promise<string> {
    if (this.cachedSessionId && !forceRefresh) {
      return this.cachedSessionId;
    }

    try {
      const url = `${ENV.OPENWA_BASE_URL}/sessions`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ENV.OPENWA_API_KEY,
        },
      });

      if (!res.ok) {
        throw new Error(`OpenWA sessions list returned HTTP ${res.status}`);
      }

      const sessions = (await res.json()) as OpenWASession[];
      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new Error('No OpenWA WhatsApp sessions configured on the gateway');
      }

      // Priority 1: Match by configured session name (e.g. 'neuro-touch')
      let found = sessions.find((s) => s.name === ENV.OPENWA_SESSION_NAME);

      // Priority 2: Match by configured session ID
      if (!found && ENV.OPENWA_SESSION_ID) {
        found = sessions.find((s) => s.id === ENV.OPENWA_SESSION_ID);
      }

      // Priority 3: First ready/active session
      if (!found) {
        found = sessions.find((s) => s.status === 'ready' || s.status === 'authenticated');
      }

      // Priority 4: First session
      if (!found) {
        found = sessions[0];
      }

      this.cachedSessionId = found.id;
      console.log(`📱 [OpenWA] Resolved session: "${found.name}" (ID: ${found.id}, status: ${found.status})`);
      return this.cachedSessionId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ [OpenWA] Failed to resolve session ID:', msg);
      if (this.cachedSessionId) return this.cachedSessionId;
      throw new Error(`Failed to resolve WhatsApp session: ${msg}`);
    }
  }

  /**
   * Sends 6-digit OTP code to the recipient's WhatsApp number
   */
  public async sendOtp(rawPhone: string, otp: string, validityMinutes = 5) {
    const cleanPhone = this.cleanPhoneNumber(rawPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Please enter a valid phone number (at least 10 digits)');
    }

    const chatId = this.getChatId(cleanPhone);
    const messageText = `Your Neuro Series login OTP is: *${otp}*. Valid for ${validityMinutes} minutes.\n\n_Do not share this code with anyone._`;

    return this.sendTextMessage(chatId, messageText, cleanPhone);
  }

  /**
   * Sends arbitrary text message to a WhatsApp recipient
   */
  public async sendTextMessage(chatIdOrPhone: string, text: string, displayPhone?: string, explicitSessionId?: string) {
    const chatId = chatIdOrPhone.includes('@') ? chatIdOrPhone : this.getChatId(chatIdOrPhone);
    let sessionId = explicitSessionId || await this.getSessionId();

    const doSend = async (sid: string) => {
      const url = `${ENV.OPENWA_BASE_URL}/sessions/${sid}/messages/send-text`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ENV.OPENWA_API_KEY,
        },
        body: JSON.stringify({
          chatId,
          text,
        }),
      });
      return res;
    };

    let response = await doSend(sessionId);

    // If session ID changed or expired (404), refresh session ID and retry once
    if (response.status === 404) {
      console.warn(`⚠️ [OpenWA] Session ${sessionId} returned 404. Refreshing session ID and retrying...`);
      sessionId = await this.getSessionId(true);
      response = await doSend(sessionId);
    }

    const resJson = await response.json().catch(() => ({})) as {
      messageId?: string;
      message?: string;
      error?: string;
      statusCode?: number;
    };

    if (!response.ok) {
      const errDetail = resJson.message || resJson.error || `HTTP ${response.status}`;
      console.error(`WhatsApp gateway rejected the message (HTTP ${response.status}).`);
      throw new Error(`WhatsApp delivery failed: ${errDetail}`);
    }

    console.log(`✅ [OpenWA] Message sent to WhatsApp ${displayPhone || chatId} (ID: ${resJson.messageId || 'ok'})`);
    return {
      success: true,
      messageId: resJson.messageId,
      phone: displayPhone || chatId,
    };
  }
}

export const openwaService = new OpenWAService();

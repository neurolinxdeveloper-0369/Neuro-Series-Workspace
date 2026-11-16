import { Router, Request, Response } from 'express';
import { openwaService } from '../auth/openwa.service.js';

export const webhookRouter = Router();

interface ExtractedMessage {
  event?: string;
  chatId?: string;
  messageText?: string;
  fromMe?: boolean;
  sessionId?: string;
}

/**
 * Robustly parses incoming OpenWA webhook payloads across different event wrappers
 * (message.received, onMessage, data wrapper, payload wrapper, or root level)
 */
export function extractMessageDetails(body: any): ExtractedMessage {
  if (!body || typeof body !== 'object') return {};

  const event = body.event || body.type || body.action || '';
  const sessionId = body.session || body.sessionId || body.session_id;

  // Look for the message payload object
  const data = body.data || body.payload || body.message || body;

  // Extract fromMe boolean (prevent self-reply loop)
  const fromMe = Boolean(
    data.fromMe ??
    data.isFromMe ??
    body.fromMe ??
    (data.id && typeof data.id === 'string' && data.id.startsWith('true_'))
  );

  // Extract chatId or sender JID (e.g. 919876543210@c.us)
  const chatId = 
    data.chatId || 
    data.from || 
    data.sender?.id || 
    data.author || 
    body.chatId || 
    body.from ||
    '';

  // Extract message text / body
  const messageText = 
    data.body || 
    data.text || 
    data.message || 
    data.caption || 
    data.content || 
    body.body || 
    body.text || 
    '';

  return {
    event: typeof event === 'string' ? event : undefined,
    chatId: typeof chatId === 'string' ? chatId.trim() : undefined,
    messageText: typeof messageText === 'string' ? messageText.trim() : undefined,
    fromMe,
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
  };
}

/**
 * Main Webhook Handler for OpenWA WhatsApp events
 */
const handleOpenWAWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawBody = req.body;
    console.log('📥 [OpenWA Webhook] Received webhook payload:', JSON.stringify(rawBody).slice(0, 300));

    const { event, chatId, messageText, fromMe, sessionId } = extractMessageDetails(rawBody);

    // If it's a non-message event (e.g. session.status, qr, group update), acknowledge and return
    if (event && !event.includes('message') && event !== 'onMessage') {
      res.status(200).json({ success: true, ignored: true, reason: `Ignored non-message event: ${event}` });
      return;
    }

    // Do not reply to messages sent by ourselves
    if (fromMe) {
      res.status(200).json({ success: true, ignored: true, reason: 'Message from self ignored' });
      return;
    }

    if (!chatId || !messageText) {
      res.status(200).json({ success: true, ignored: true, reason: 'Missing chatId or messageText in payload' });
      return;
    }

    const cleanText = messageText.toLowerCase().trim();
    console.log(`💬 [OpenWA Webhook] Parsed message from ${chatId}: "${messageText}" (normalized: "${cleanText}")`);

    // Check if the text is 'hi' (or common greeting: 'hi', 'hi!', 'hi.', 'hello', 'hey')
    const isGreeting = cleanText === 'hi' || cleanText === 'hi!' || cleanText === 'hi.' || cleanText === 'hello' || cleanText === 'hey';

    if (isGreeting) {
      const replyText = "Hi, this is Neurolinx! How can we assist you today?";
      console.log(`📤 [OpenWA Webhook] Dispatching greeting reply to ${chatId}: "${replyText}"`);

      // Reply using OpenWA Send Text API endpoint:
      // POST /api/sessions/:sessionId/messages/send-text with { chatId, text }
      const delivery = await openwaService.sendTextMessage(chatId, replyText, undefined, sessionId);

      res.status(200).json({
        success: true,
        replied: true,
        chatId,
        text: replyText,
        delivery,
      });
      return;
    }

    // For non-greeting messages, acknowledge 200 without auto-reply
    res.status(200).json({
      success: true,
      replied: false,
      chatId,
      receivedText: messageText,
      reason: 'No auto-reply rule matched',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ [OpenWA Webhook] Error processing webhook:', msg);
    res.status(500).json({
      success: false,
      error: msg,
    });
  }
};

// Mount multi-route handlers for flexible OpenWA URL configuration
webhookRouter.post('/', handleOpenWAWebhook);
webhookRouter.post('/whatsapp', handleOpenWAWebhook);
webhookRouter.post('/openwa', handleOpenWAWebhook);
webhookRouter.post('/message', handleOpenWAWebhook);

// Status / Ping GET endpoint
webhookRouter.get(['/', '/whatsapp', '/openwa'], async (_req: Request, res: Response) => {
  const sessionId = await openwaService.getSessionId().catch(() => 'unknown');
  res.json({
    status: 'active',
    service: 'OpenWA WhatsApp Webhook Service',
    sessionId,
    triggerRule: "When message text is 'hi' -> auto-replies 'Hi, this is Neurolinx! How can we assist you today?'",
    endpoints: [
      '/api/webhook/whatsapp',
      '/webhook/whatsapp',
      '/api/openwa/webhook',
      '/api/webhook'
    ]
  });
});

import express from 'express';
import { createHash } from 'node:crypto';
import { db } from '../../config/database.js';
import { MAX_FIRMWARE_BYTES } from './ota.policy.js';
import { issueOtaSession, verifyOtaCode, verifyOtaSession } from './ota.auth.js';
import { otaService } from './ota.service.js';

export const otaRouter = express.Router();
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let failures = 0;
let windowStart = Date.now();
otaRouter.post('/session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.OTA_ACCESS_CODE_HASH) { res.status(503).json({ error: 'OTA access code is not configured on the server.' }); return; }
  if (Date.now() - windowStart > 60000) { failures = 0; windowStart = Date.now(); }
  if (failures >= 6) { res.set('Retry-After', '60').status(429).json({ error: 'Too many access-code attempts. Wait one minute.' }); return; }
  failures++;
  try {
    if (!await verifyOtaCode(req.body?.code)) { res.status(401).json({ error: 'Incorrect OTA access code.' }); return; }
    res.json({ success: true, token: issueOtaSession() });
  } catch { res.status(503).json({ error: 'Could not verify the OTA code.' }); }
});

// A per-job expiring capability URL permits ESP downloads without app credentials.
otaRouter.get('/download/:id/:token.bin', async (req, res) => {
  if (!uuid.test(req.params.id) || !/^[a-f0-9]{64}$/.test(req.params.token)) { res.sendStatus(404); return; }
  try {
    const file = (await db.query(`SELECT f.image_bytes,f.byte_size FROM ota_jobs j JOIN ota_firmware f ON f.id=j.firmware_id
      WHERE j.id=$1 AND j.download_token_hash=$2 AND j.download_expires_at>NOW() AND j.status IN ('queued','downloading','unconfirmed')`,
      [req.params.id, createHash('sha256').update(req.params.token).digest('hex')])).rows[0];
    if (!file) { res.sendStatus(404); return; }
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.byte_size), 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="firmware.bin"' });
    res.send(file.image_bytes);
  } catch { res.sendStatus(503); }
});

otaRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    if (!token) { res.status(401).json({ error: 'Enter the OTA access code to continue.' }); return; }
    verifyOtaSession(token);
    next();
  } catch { res.status(401).json({ error: 'OTA session expired. Enter the access code again.' }); }
});

otaRouter.get('/devices', async (_req, res) => {
  try {
    await otaService.expireStalled();
    const devices = (await db.query(`SELECT d.id,d.device_id,d.custom_name,d.model_code,d.firmware_version,d.last_seen_at,
      (d.is_online AND d.last_seen_at > NOW()-INTERVAL '12 seconds') AS is_online,
      h.name AS home_name,r.name AS room_name,u.email AS owner_email,u.full_name AS owner_name
      FROM devices d JOIN homes h ON h.id=d.home_id JOIN users u ON u.id=h.owner_id LEFT JOIN rooms r ON r.id=d.room_id
      ORDER BY h.name,d.custom_name`)).rows;
    res.json({ success: true, devices });
  } catch { res.status(503).json({ error: 'Could not load devices.' }); }
});

otaRouter.get('/jobs', async (_req, res) => {
  try {
    await otaService.expireStalled();
    const jobs = (await db.query(`SELECT j.id,j.device_id,j.firmware_id,j.status,j.progress,j.detail,j.created_at,j.updated_at,
      d.device_id AS hardware_id,d.custom_name,d.last_seen_at,d.firmware_version,
      (d.is_online AND d.last_seen_at>NOW()-INTERVAL '12 seconds') AS is_online,
      f.filename,f.version,f.model_code FROM ota_jobs j JOIN devices d ON d.id=j.device_id JOIN ota_firmware f ON f.id=j.firmware_id
      ORDER BY j.created_at DESC LIMIT 100`)).rows;
    res.json({ success: true, jobs });
  } catch { res.status(503).json({ error: 'Could not load update history.' }); }
});

otaRouter.post('/firmware', express.raw({ type: 'application/octet-stream', limit: MAX_FIRMWARE_BYTES }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'Upload firmware as application/octet-stream.' }); return; }
    const { filename, model, version } = req.query;
    if ([filename, model, version].some(v => typeof v !== 'string')) { res.status(400).json({ error: 'Filename, model and version are required.' }); return; }
    const firmware = await otaService.upload(null, req.body, filename as string, model as string, version as string);
    res.status(201).json({ success: true, firmware });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Could not upload firmware.' }); }
});

otaRouter.post('/jobs', async (req, res) => {
  const { firmwareId, deviceIds, confirmed } = req.body || {};
  if (!uuid.test(firmwareId || '') || !Array.isArray(deviceIds) || !deviceIds.length || deviceIds.length > 20 ||
    deviceIds.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(deviceIds).size !== deviceIds.length || confirmed !== true) {
    res.status(400).json({ error: 'Confirm the update and select 1–20 unique devices with a firmware upload.' }); return;
  }
  try { res.status(202).json({ success: true, jobIds: await otaService.start(null, firmwareId, deviceIds) }); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Could not start update.' }); }
});

otaRouter.use((error: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.type === 'entity.too.large' ? 413 : 500).json({ error: error.type === 'entity.too.large' ? 'Firmware must not exceed 4 MiB.' : 'OTA request failed.' });
});

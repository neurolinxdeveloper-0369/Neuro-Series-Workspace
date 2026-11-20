import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../config/database.js';
import { emqxService } from '../mqtt/emqx.client.js';
import { socketManager } from '../websocket/socket.server.js';
import { parseOtaStatus, validateFirmware } from './ota.policy.js';

export const otaService = {
  async initialize() {
    await db.query(`CREATE TABLE IF NOT EXISTS ota_firmware (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      filename TEXT NOT NULL, model_code VARCHAR(30) NOT NULL, version VARCHAR(30) NOT NULL,
      sha256 CHAR(64) NOT NULL, byte_size INTEGER NOT NULL, image_bytes BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS ota_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      firmware_id UUID NOT NULL REFERENCES ota_firmware(id), requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'queued', progress INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '',
      download_token_hash CHAR(64) NOT NULL, download_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX IF NOT EXISTS ota_one_active_device ON ota_jobs(device_id) WHERE status IN ('queued','downloading');
      CREATE INDEX IF NOT EXISTS ota_jobs_recent ON ota_jobs(created_at DESC);`);
  },
  async expireStalled() {
    await db.query(`UPDATE ota_jobs SET status='unconfirmed', detail='No device OTA report for 3 minutes. Check the device before retrying.', updated_at=NOW()
      WHERE status IN ('queued','downloading') AND updated_at < NOW() - INTERVAL '3 minutes'`);
  },
  async upload(userId: string | null, bytes: Buffer, filename: string, model: string, version: string) {
    validateFirmware(bytes, filename, model, version);
    return (await db.query(`INSERT INTO ota_firmware (uploaded_by,filename,model_code,version,sha256,byte_size,image_bytes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,filename,model_code,version,sha256,byte_size,created_at`,
      [userId, filename, model, version, createHash('sha256').update(bytes).digest('hex'), bytes.length, bytes])).rows[0];
  },
  async status(deviceId: string, value: unknown) {
    const report = parseOtaStatus(value);
    if (!report) return;
    const detail = report.status === 'success' ? 'Device confirmed flashing success; waiting for reboot and reconnection.' :
      report.status === 'failed' ? 'Device reported failure. Firmware did not provide a reason; check network, download URL and flash compatibility.' : 'Device is downloading firmware.';
    const result = await db.query(`UPDATE ota_jobs j SET status=$2, progress=$3, detail=$4, updated_at=NOW()
      FROM devices d WHERE j.device_id=d.id AND d.device_id=$1 AND j.status IN ('queued','downloading','unconfirmed')
      AND NOT EXISTS (SELECT 1 FROM ota_jobs newer WHERE newer.device_id=j.device_id AND newer.created_at>j.created_at)
      AND ($2 != 'downloading' OR $3 >= j.progress) RETURNING j.*`, [deviceId, report.status, report.progress, detail]);
    for (const job of result.rows) socketManager.broadcastOtaUpdate(job);
  },
  async start(userId: string | null, firmwareId: string, deviceIds: string[]) {
    await this.expireStalled();
    const client = await db.connect();
    const prepared: Array<{ id: string; hardwareId: string; token: string }> = [];
    try {
      await client.query('BEGIN');
      const firmware = (await client.query('SELECT id,model_code FROM ota_firmware WHERE id=$1', [firmwareId])).rows[0];
      if (!firmware) throw new Error('Firmware upload not found.');
      const devices = (await client.query(`SELECT id,device_id,model_code,is_online,last_seen_at FROM devices WHERE id=ANY($1::uuid[]) FOR UPDATE`, [deviceIds])).rows;
      if (devices.length !== deviceIds.length) throw new Error('A selected device no longer exists.');
      for (const device of devices) {
        if (device.model_code !== firmware.model_code) throw new Error('Firmware model must match every selected device.');
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(device.device_id)) throw new Error('Unsupported device MQTT identifier.');
        if (!device.is_online || !device.last_seen_at || Date.now() - new Date(device.last_seen_at).getTime() > 12000) throw new Error(`${device.device_id} is offline. Refresh and select online devices.`);
        const token = randomBytes(32).toString('hex');
        const job = (await client.query(`INSERT INTO ota_jobs(device_id,firmware_id,requested_by,download_token_hash)
          VALUES ($1,$2,$3,$4) RETURNING id`, [device.id, firmwareId, userId, createHash('sha256').update(token).digest('hex')])).rows[0];
        prepared.push({ id: job.id, hardwareId: device.device_id, token });
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw new Error('A selected device already has an active OTA update.');
      throw error;
    } finally { client.release(); }
    const base = (process.env.OTA_PUBLIC_BASE_URL || 'https://neurolinx.in/neuro-series/api/ota').replace(/\/$/, '');
    await Promise.all(prepared.map(async job => {
      try {
        await emqxService.sendOtaCommand(job.hardwareId, `${base}/download/${job.id}/${job.token}.bin`);
        await db.query(`UPDATE ota_jobs SET detail='MQTT broker accepted the command; waiting for the device.',updated_at=NOW() WHERE id=$1 AND status='queued'`, [job.id]);
      } catch {
        // A publish timeout may still have reached hardware. Never automatically retry it.
        await db.query(`UPDATE ota_jobs SET status='unconfirmed',detail='Could not confirm MQTT delivery. Check the device before retrying.',updated_at=NOW() WHERE id=$1 AND status='queued'`, [job.id]);
      }
    }));
    return prepared.map(job => job.id);
  },
};

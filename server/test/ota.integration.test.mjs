import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { test } from 'node:test';

test('OTA endpoints enforce access, immutable binary downloads, model/online checks and hardware status', { skip: !process.env.NEURO_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.NEURO_TEST_DATABASE_URL;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const code = randomBytes(16).toString('hex'); const salt = randomBytes(16).toString('hex');
  process.env.OTA_ACCESS_CODE_HASH = salt + ':' + scryptSync(code, salt, 64).toString('hex');
  const { db } = await import('../dist/config/database.js');
  const { authService } = await import('../dist/modules/auth/auth.service.js');
  const { homeService } = await import('../dist/modules/homes/home.service.js');
  const { deviceService } = await import('../dist/modules/devices/device.service.js');
  const { otaService } = await import('../dist/modules/ota/ota.service.js');
  const { otaRouter } = await import('../dist/modules/ota/ota.controller.js');
  const { emqxService } = await import('../dist/modules/mqtt/emqx.client.js');
  await authService.ensureTablesExist(); await homeService.ensureTableExists(); await deviceService.ensureTablesExist(); await otaService.initialize();
  const app = express(); app.use(express.json()); app.use('/ota', otaRouter);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  process.env.OTA_PUBLIC_BASE_URL = url + '/ota';
  let token = ''; let owner; let firmwareId;
  const originalSend = emqxService.sendOtaCommand;
  const sent = [];
  emqxService.sendOtaCommand = async (id, downloadUrl) => { sent.push({ id, downloadUrl }); };
  const request = (path, body) => fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await request('/ota/devices')).status, 401);
    assert.equal((await request('/ota/session', { code: code + 'x' })).status, 401);
    const login = await request('/ota/session', { code }); assert.equal(login.status, 200); token = (await login.json()).token;
    owner = (await db.query("INSERT INTO users(email,full_name) VALUES ($1,'OTA test owner') RETURNING id", ['ota-' + randomBytes(8).toString('hex') + '@example.test'])).rows[0].id;
    const home = (await db.query("INSERT INTO homes(owner_id,name,property_type) VALUES ($1,'OTA test','House') RETURNING id", [owner])).rows[0].id;
    const hardwareId = 'ota-test-' + randomBytes(6).toString('hex');
    const device = (await db.query(`INSERT INTO devices(home_id,device_id,mac_4,model_code,custom_name,wifi_ssid,is_online,last_seen_at)
      VALUES ($1,$2,'ABCD','TP8','Test panel','Test',true,NOW()) RETURNING id`, [home, hardwareId])).rows[0].id;
    const bytes = Buffer.alloc(64); bytes[0] = 0xe9;
    const upload = await fetch(url + '/ota/firmware?filename=test.bin&model=TP8&version=1.1', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: bytes });
    assert.equal(upload.status, 201); const firmware = (await upload.json()).firmware; firmwareId = firmware.id;
    assert.equal(firmware.binary, undefined); assert.equal(firmware.sha256.length, 64);
    assert.equal((await request('/ota/jobs', { firmwareId, deviceIds: [device] })).status, 400);
    await db.query('UPDATE devices SET model_code=$2 WHERE id=$1', [device, 'TP4']);
    assert.equal((await request('/ota/jobs', { firmwareId, deviceIds: [device], confirmed: true })).status, 409);
    assert.equal(sent.length, 0);
    await db.query('UPDATE devices SET model_code=$2,is_online=false WHERE id=$1', [device, 'TP8']);
    assert.equal((await request('/ota/jobs', { firmwareId, deviceIds: [device], confirmed: true })).status, 409);
    await db.query('UPDATE devices SET is_online=true,last_seen_at=NOW() WHERE id=$1', [device]);
    const started = await request('/ota/jobs', { firmwareId, deviceIds: [device], confirmed: true }); assert.equal(started.status, 202);
    assert.equal(sent.length, 1); assert.equal(sent[0].id, hardwareId);
    const download = await fetch(sent[0].downloadUrl); assert.equal(download.status, 200); assert.equal(download.headers.get('content-type'), 'application/octet-stream'); assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    await db.query("UPDATE ota_jobs SET download_expires_at=NOW()-INTERVAL '1 second' WHERE firmware_id=$1", [firmwareId]);
    assert.equal((await fetch(sent[0].downloadUrl)).status, 404);
    await db.query("UPDATE ota_jobs SET download_expires_at=NOW()+INTERVAL '30 minutes' WHERE firmware_id=$1", [firmwareId]);
    assert.equal((await fetch(sent[0].downloadUrl.replace(/\/[a-f0-9]{64}\.bin$/, '/' + '0'.repeat(64) + '.bin'))).status, 404);
    assert.equal((await request('/ota/jobs', { firmwareId, deviceIds: [device], confirmed: true })).status, 409);
    await otaService.status(hardwareId, { status: 'downloading', progress: 45 });
    await otaService.status(hardwareId, { status: 'downloading', progress: 20 });
    let rows = (await db.query('SELECT * FROM ota_jobs WHERE firmware_id=$1', [firmwareId])).rows;
    assert.equal(rows[0].progress, 45);
    await otaService.status(hardwareId, { status: 'success', progress: 100 });
    await otaService.status(hardwareId, { status: 'failed', progress: -1 });
    rows = (await db.query('SELECT * FROM ota_jobs WHERE firmware_id=$1', [firmwareId])).rows;
    assert.equal(rows[0].status, 'success'); assert.equal(rows[0].progress, 100);
    assert.equal((await fetch(sent[0].downloadUrl)).status, 404);
    const history = await request('/ota/jobs'); assert.equal(history.status, 200);
    assert.equal((await history.text()).includes('download_token_hash'), false);
    token = authService.generateToken(owner);
    assert.equal((await request('/ota/devices')).status, 401);
  } finally {
    emqxService.sendOtaCommand = originalSend;
    if (firmwareId) { await db.query('DELETE FROM ota_jobs WHERE firmware_id=$1', [firmwareId]); await db.query('DELETE FROM ota_firmware WHERE id=$1', [firmwareId]); }
    if (owner) await db.query('DELETE FROM users WHERE id=$1', [owner]);
    await new Promise(resolve => server.close(resolve)); await db.end();
  }
});

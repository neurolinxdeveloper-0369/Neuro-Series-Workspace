import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { test } from 'node:test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { validateFirmware, parseOtaStatus, MAX_FIRMWARE_BYTES } = await import('../dist/modules/ota/ota.policy.js');
const { verifyOtaCode, issueOtaSession, verifyOtaSession } = await import('../dist/modules/ota/ota.auth.js');
const { verifySessionToken } = await import('../dist/modules/auth/auth.middleware.js');

test('OTA access codes are hashed, checked exactly and issue purpose-limited sessions', async () => {
  const code = randomBytes(20).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const hash = salt + ':' + scryptSync(code, salt, 64).toString('hex');
  assert.equal(await verifyOtaCode(code, hash), true);
  assert.equal(await verifyOtaCode(code + 'x', hash), false);
  assert.equal(await verifyOtaCode(code, ''), false);
  assert.equal(await verifyOtaCode({}, hash), false);
  const token = issueOtaSession();
  assert.ok(verifyOtaSession(token).expiresAt > Date.now());
  assert.throws(() => verifySessionToken(token));
});

test('OTA firmware rejects unsafe filenames, non-ESP payloads, oversized images and invalid metadata', () => {
  const image = Buffer.alloc(64); image[0] = 0xe9;
  assert.doesNotThrow(() => validateFirmware(image, 'panel.bin', 'TP8', '1.1.0'));
  for (const name of ['../panel.bin', 'panel.exe', 'panel.bin\r\nX-Evil: true']) assert.throws(() => validateFirmware(image, name, 'TP8', '1'));
  assert.throws(() => validateFirmware(Buffer.alloc(64), 'panel.bin', 'TP8', '1'));
  assert.throws(() => validateFirmware(Buffer.alloc(MAX_FIRMWARE_BYTES + 1), 'panel.bin', 'TP8', '1'));
  assert.throws(() => validateFirmware(image, 'panel.bin', 'TP8/#', '1'));
});

test('OTA status accepts only the specified status/progress combinations', () => {
  for (const report of [{ status: 'downloading', progress: 0 }, { status: 'downloading', progress: 45 }, { status: 'success', progress: 100 }, { status: 'failed', progress: -1 }]) assert.deepEqual(parseOtaStatus(report), report);
  for (const report of [null, {}, { status: 'success', progress: 0 }, { status: 'downloading', progress: -1 }, { status: 'downloading', progress: 101 }, { status: 'failed', progress: 0 }, { status: 'downloading', progress: '45' }]) assert.equal(parseOtaStatus(report), null);
});

test('OTA MQTT waits for status SUBACK, publishes only URL with QoS1 and never retains the command', async () => {
  const { emqxService } = await import('../dist/modules/mqtt/emqx.client.js');
  const previous = emqxService.client;
  const calls = [];
  let subscribed;
  emqxService.client = { connected: true,
    subscribe(topic, options, callback) { calls.push(['subscribe', topic, options]); subscribed = callback; },
    publish(topic, payload, options, callback) { calls.push(['publish', topic, JSON.parse(payload), options]); callback(); },
  };
  try {
    const url = 'https://example.test/firmware.bin';
    const pending = emqxService.sendOtaCommand('ntoz-7708-TP8', url);
    assert.equal(calls.length, 1);
    subscribed(null, [{ qos: 0 }]);
    await pending;
    assert.deepEqual(calls, [ ['subscribe', 'devices/ntoz-7708-TP8/ota/stat', { qos: 0 }], ['publish', 'devices/ntoz-7708-TP8/ota', { url }, { qos: 1, retain: false }] ]);
    emqxService.client.subscribe = (_topic, _options, callback) => callback(null, [{ qos: 128 }]);
    await assert.rejects(emqxService.sendOtaCommand('ntoz-7708-TP8', url), /rejected/);
    assert.equal(calls.length, 2);
    await assert.rejects(emqxService.sendOtaCommand('bad/+/id', url), /Invalid/);
  } finally { emqxService.client = previous; }
});

test('OTA WebSocket events exclude normal users, expired sessions and download capabilities', async () => {
  const { socketManager } = await import('../dist/modules/websocket/socket.server.js');
  const normalEvents = [], adminEvents = [], closed = [];
  const normal = { readyState: 1, send: value => normalEvents.push(value) };
  const admin = { readyState: 1, send: value => adminEvents.push(JSON.parse(value)) };
  const expired = { readyState: 1, close: code => closed.push(code), send: () => assert.fail('Expired session received OTA data') };
  socketManager.sessions.set(normal, { id: randomBytes(16).toString('hex'), expiresAt: Date.now() + 10000 });
  socketManager.otaSessions.set(admin, { expiresAt: Date.now() + 10000 });
  socketManager.otaSessions.set(expired, { expiresAt: Date.now() - 1 });
  try {
    socketManager.broadcastOtaUpdate({ id: 'job', device_id: 'device', status: 'downloading', progress: 45, download_token_hash: 'private-capability' });
    assert.equal(normalEvents.length, 0);
    assert.equal(adminEvents[0].type, 'OTA_UPDATE');
    assert.equal(adminEvents[0].job.progress, 45);
    assert.equal(JSON.stringify(adminEvents).includes('private-capability'), false);
    assert.deepEqual(closed, [1008]);
  } finally { socketManager.sessions.delete(normal); socketManager.otaSessions.delete(admin); socketManager.otaSessions.delete(expired); }
});

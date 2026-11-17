import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';

test('owner can invite, grant access to one home, and revoke membership', {
  skip: !process.env.NEURO_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.NEURO_TEST_DATABASE_URL;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');

  const { db } = await import('../dist/config/database.js');
  const { authService } = await import('../dist/modules/auth/auth.service.js');
  const { homeService } = await import('../dist/modules/homes/home.service.js');
  const { deviceService } = await import('../dist/modules/devices/device.service.js');
  const { homeRouter } = await import('../dist/modules/homes/home.controller.js');
  const { deviceRouter } = await import('../dist/modules/devices/device.controller.js');
  const { notificationRouter, initializeNotifications } = await import('../dist/modules/notifications/notification.controller.js');

  await authService.ensureTablesExist();
  await homeService.ensureTableExists();
  await deviceService.ensureTablesExist();
  await initializeNotifications();

  const app = express();
  app.use(express.json());
  app.use('/homes', homeRouter);
  app.use('/devices', deviceRouter);
  app.use('/notifications', notificationRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  const ids = [];
  const addresses = [];
  try {
    const suffix = randomBytes(8).toString('hex');
    addresses.push(...['owner', 'member', 'other'].map(role => role + '-' + suffix + '@example.test'));
    const users = await db.query(
      "INSERT INTO users (email, full_name) SELECT email, email FROM unnest($1::text[]) AS email RETURNING id",
      [addresses]
    );
    ids.push(...users.rows.map(user => user.id));
    const [owner, member, other] = ids;
    await db.query("INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')", [addresses[0], '102938']);
    for (let attempt = 0; attempt < 5; attempt++) {
      await assert.rejects(authService.verifyEmailOtp(addresses[0], '493821'), /Invalid or expired/);
    }
    await assert.rejects(authService.verifyEmailOtp(addresses[0], '102938'), /Invalid or expired/);
    await db.query("INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')", [addresses[1], '102938']);
    const verification = await Promise.allSettled([
      authService.verifyEmailOtp(addresses[1], '102938'),
      authService.verifyEmailOtp(addresses[1], '102938'),
    ]);
    assert.equal(verification.filter(result => result.status === 'fulfilled').length, 1);
    const request = (id, path, method = 'GET', body) => fetch(url + path, {
      method,
      headers: { Authorization: 'Bearer ' + authService.generateToken(id), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sharedHome = (await db.query(
      "INSERT INTO homes (owner_id, name, property_type) VALUES ($1, 'Shared test home', 'House') RETURNING id",
      [owner]
    )).rows[0].id;
    const privateHome = (await db.query(
      "INSERT INTO homes (owner_id, name, property_type) VALUES ($1, 'Private test home', 'House') RETURNING id",
      [owner]
    )).rows[0].id;
    const room = await homeService.createRoom(sharedHome, 'Office');
    const panel = await deviceService.provisionDevice({
      homeId: sharedHome, roomId: room.id, deviceId: 'test-' + suffix, modelCode: 'TP4',
      customName: 'Fixture panel', wifiSsid: 'Fixture Wi-Fi',
    });
    assert.equal(panel.device.is_online, false);
    const inviteResponse = await request(owner, '/homes/' + sharedHome + '/invitations', 'POST', { email: addresses[1] });
    assert.equal(inviteResponse.status, 201);
    const { code } = await inviteResponse.json();
    const history = await (await request(owner, '/homes/' + sharedHome + '/invitations')).json();
    assert.equal(JSON.stringify(history).includes(code), false);
    assert.equal((await request(other, '/homes/join', 'POST', { code })).status, 400);
    assert.equal((await request(member, '/homes/join', 'POST', { code })).status, 200);
    assert.equal((await request(member, '/homes/join', 'POST', { code })).status, 400);

    const { homes } = await (await request(member, '/homes')).json();
    assert.deepEqual(homes.map(home => home.id), [sharedHome]);
    assert.equal((await request(member, '/homes/' + sharedHome + '/rooms')).status, 200);
    assert.equal((await request(member, '/devices/home/' + sharedHome)).status, 200);
    assert.equal((await request(member, '/devices/' + panel.deviceId)).status, 200);
    assert.equal((await request(member, '/devices/home/' + privateHome)).status, 404);
    assert.equal((await request(member, '/homes/' + sharedHome + '/rooms', 'POST', { name: 'Forbidden test' })).status, 404);
    assert.equal((await request(member, '/devices/' + panel.deviceId, 'PATCH', { name: 'New panel', roomId: room.id })).status, 404);
    assert.equal((await request(owner, '/devices/' + panel.deviceId, 'PATCH', { name: 'New panel', roomId: room.id })).status, 200);
    const sensor = await deviceService.provisionDevice({
      homeId: sharedHome, roomId: room.id, deviceId: 'meter-' + suffix, modelCode: 'SHUB',
      customName: 'Fixture sensor', wifiSsid: 'Fixture Wi-Fi',
    });
    await deviceService.handleTelemetryUpdate(sensor.deviceId, {
      readings: { '1': { value: 24.75, unit: '?C' }, '2': { value: 66, unit: '%' } },
      alerts: { over_voltage: true },
    });
    await deviceService.handleTelemetryUpdate(sensor.deviceId, { alerts: { over_voltage: true } });
    const devices = (await (await request(member, '/devices/home/' + sharedHome)).json()).devices;
    const endpoint = devices.find(device => device.device_id === sensor.deviceId).endpoints[0];
    assert.equal(endpoint.state.reading.value, 24.75);
    assert.equal(endpoint.state.reading.unit, '?C');
    assert.ok(endpoint.state.reading.reportedAt);
    const items = (await (await request(member, '/notifications')).json()).notifications;
    assert.deepEqual(items.map(item => item.kind).sort(), ['alert', 'online']);
    assert.equal((await (await request(other, '/notifications')).json()).notifications.length, 0);
    assert.equal((await request(member, '/notifications/read', 'POST', { ids: items.map(item => item.id) })).status, 200);
    assert.ok((await (await request(member, '/notifications')).json()).notifications.every(item => item.read));
    assert.ok((await (await request(owner, '/notifications')).json()).notifications.every(item => !item.read));
    assert.equal((await request(owner, '/homes/' + sharedHome + '/members/' + member, 'DELETE')).status, 200);
    assert.equal((await request(member, '/devices/home/' + sharedHome)).status, 404);
    assert.equal((await (await request(member, '/notifications')).json()).notifications.length, 0);
  } finally {
    await db.query('DELETE FROM email_otps WHERE email = ANY($1::text[])', [addresses]);
    await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    await new Promise(resolve => server.close(resolve));
    await db.end();
  }
});

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { test } from 'node:test';

test('database administration uses OTA access, previews impact and deletes only confirmed records', { skip: !process.env.NEURO_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.NEURO_TEST_DATABASE_URL;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const { db } = await import('../dist/config/database.js');
  const { authService } = await import('../dist/modules/auth/auth.service.js');
  const { homeService } = await import('../dist/modules/homes/home.service.js');
  const { deviceService } = await import('../dist/modules/devices/device.service.js');
  const { routineService } = await import('../dist/modules/routines/routine.service.js');
  const { initializeHistory } = await import('../dist/modules/history/history.service.js');
  const { initializeNotifications } = await import('../dist/modules/notifications/notification.controller.js');
  const { otaService } = await import('../dist/modules/ota/ota.service.js');
  const { otaRouter } = await import('../dist/modules/ota/ota.controller.js');
  const { issueOtaSession } = await import('../dist/modules/ota/ota.auth.js');
  const { authenticateToken } = await import('../dist/modules/auth/auth.middleware.js');
  const { socketManager } = await import('../dist/modules/websocket/socket.server.js');
  await authService.ensureTablesExist(); await homeService.ensureTableExists(); await deviceService.ensureTablesExist(); await routineService.ensureTableExists(); await initializeNotifications(); await initializeHistory(); await otaService.initialize();
  const app = express(); app.use(express.json()); app.use('/ota', otaRouter); app.get('/account', authenticateToken, (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const suffix = randomBytes(8).toString('hex');
  let token = issueOtaSession(); const users = []; let fw;
  const request = (path, method = 'GET', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body === undefined ? undefined : JSON.stringify(body) });
  const exists = async (table, id) => (await db.query(`SELECT 1 FROM ${table} WHERE id=$1`, [id])).rowCount > 0;
  const preview = async (kind, id) => { const result = await request(`/ota/database/${kind}/${id}/preview`, 'POST'); assert.equal(result.status, 200, await result.clone().text()); return (await result.json()).preview; };
  const remove = async (kind, id, expected) => request(`/ota/database/${kind}/${id}`, 'DELETE', { confirmation: id, previewToken: expected.token });
  const createDevice = async (home, room, tag) => (await db.query(`INSERT INTO devices(home_id,room_id,device_id,mac_4,model_code,custom_name,wifi_ssid)
    VALUES($1,$2,$3,'ABCD','TP8',$4,'PRIVATE-WIFI-SSID') RETURNING *`, [home, room, tag + '-' + suffix, tag])).rows[0];
  try {
    const created = await db.query("INSERT INTO users(full_name,email,phone_number) VALUES ('DB owner',$1,$2),('DB member',$3,NULL),('DB other',$4,NULL) RETURNING *", ['db-owner-' + suffix + '@example.test', '+9199' + suffix, 'db-member-' + suffix + '@example.test', 'db-other-' + suffix + '@example.test']);
    users.push(...created.rows.map(row => row.id)); const [owner, member, other] = users;
    const ownerEmail = created.rows[0].email;
    const homes = (await db.query("INSERT INTO homes(owner_id,name,property_type,wifi_password_encrypted) VALUES ($1,$3,'House','PRIVATE-ENCRYPTED-PASSWORD'),($2,$4,'House',NULL) RETURNING *", [owner, other, 'DB home ' + suffix, 'DB other ' + suffix])).rows;
    const [home, otherHome] = homes.map(row => row.id);
    const room = (await db.query("INSERT INTO rooms(home_id,name) VALUES($1,'Living room') RETURNING id", [home])).rows[0].id;
    const keepRoom = (await db.query("INSERT INTO rooms(home_id,name) VALUES($1,'Bedroom') RETURNING id", [home])).rows[0].id;
    const device = await createDevice(home, room, 'delete-panel');
    const keptDevice = await createDevice(home, keepRoom, 'keep-panel');
    const otherDevice = await createDevice(otherHome, null, 'other-panel');
    const actions = [{ deviceId: device.id, deviceName: 'Deleted', channel: 1, targetState: true }, { deviceId: device.device_id, deviceName: 'Deleted legacy', channel: 2, targetState: false }, { deviceId: keptDevice.id, deviceName: 'Kept', channel: 1, targetState: true }];
    const routine = (await db.query("INSERT INTO routines(user_id,home_id,name,type,actions,is_active) VALUES($1,$2,'DB Scene','scene',$3,true) RETURNING id", [owner, home, JSON.stringify(actions)])).rows[0].id;
    await db.query('INSERT INTO home_members(home_id,user_id,device_ids) VALUES($1,$2,$3)', [home, member, [device.id]]);
    await db.query("INSERT INTO home_invitations(home_id,invited_by,email,device_ids) VALUES($1,$2,'',$3)", [home, owner, [device.id]]);
    const accountToken = authService.generateToken(owner);
    token = ''; assert.equal((await request('/ota/database/users')).status, 401);
    token = accountToken; assert.equal((await request('/ota/database/devices')).status, 401);
    token = issueOtaSession();
    assert.equal((await request('/ota/database/auth_identities')).status, 404);
    assert.equal((await request('/ota/database/users?pageSize=500')).status, 400);
    const listing = await request('/ota/database/devices?search=' + suffix + '&page=1&pageSize=2'); const listed = await listing.json();
    assert.equal(listing.status, 200); assert.equal(listed.rows.length, 2); assert.equal(listed.total, 3);
    assert.ok(listed.columns.some(column => column.key === 'id'));
    assert.equal(JSON.stringify(listed).includes('PRIVATE-'), false);
    let plan = await preview('devices', device.id);
    assert.ok(plan.impact.some(item => item.label === 'Devices deleted' && item.count === 1));
    assert.ok(plan.warnings.some(warning => warning.includes('physical hardware')));
    assert.equal((await request(`/ota/database/devices/${device.id}`, 'DELETE', { confirmation: 'wrong', previewToken: plan.token })).status, 400);
    assert.equal(await exists('devices', device.id), true);
    const saved = token; token = issueOtaSession(); // Tokens signed in the same second are deterministic, use a different signed valid session below.
    const { default: jwt } = await import('jsonwebtoken');
    token = jwt.sign({ scope: 'firmware-admin', jti: 'second-session' }, process.env.JWT_SECRET, { algorithm: 'HS256', audience: 'neuro-ota-admin', expiresIn: '30m' });
    assert.equal((await remove('devices', device.id, plan)).status, 409); token = saved;
    await db.query("UPDATE devices SET custom_name='Renamed after preview' WHERE id=$1", [device.id]);
    assert.equal((await remove('devices', device.id, plan)).status, 409);
    plan = await preview('devices', device.id);
    fw = await otaService.upload(null, Buffer.from([0xe9, ...new Array(63).fill(0)]), 'test.bin', 'TP8', '1');
    const job = (await db.query("INSERT INTO ota_jobs(device_id,firmware_id,status,download_token_hash) VALUES($1,$2,'unconfirmed',$3) RETURNING id", [device.id, fw.id, 'a'.repeat(64)])).rows[0].id;
    assert.equal((await remove('devices', device.id, plan)).status, 409);
    assert.equal((await request(`/ota/database/users/${owner}/preview`, 'POST')).status, 409);
    await db.query("UPDATE ota_jobs SET download_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [job]);
    plan = await preview('devices', device.id);
    const deleted = await remove('devices', device.id, plan); assert.equal(deleted.status, 200, await deleted.clone().text());
    assert.equal(await exists('devices', device.id), false); assert.equal(await exists('devices', keptDevice.id), true); assert.equal(await exists('devices', otherDevice.id), true);
    const currentRoutine = (await db.query('SELECT actions,is_active FROM routines WHERE id=$1', [routine])).rows[0];
    assert.equal(currentRoutine.is_active, false); assert.deepEqual(currentRoutine.actions.map(action => action.deviceId), [keptDevice.id]);
    const permissions = (await db.query('SELECT room_ids,device_ids FROM home_members WHERE home_id=$1 AND user_id=$2', [home, member])).rows[0];
    assert.equal(permissions.room_ids, null); assert.deepEqual(permissions.device_ids, []);
    assert.deepEqual((await db.query('SELECT device_ids FROM home_invitations WHERE home_id=$1', [home])).rows[0].device_ids, []);

    const movedDevice = await createDevice(home, room, 'unassign-panel');
    const roomRoutine = (await db.query("INSERT INTO routines(user_id,home_id,room_id,name,type,is_active,actions) VALUES($1,$2,$3,'DB room schedule','schedule',true,$4) RETURNING *", [owner, home, room, JSON.stringify([{ deviceId: movedDevice.id, deviceName: 'Panel', channel: 1, targetState: true }])])).rows[0];
    await db.query('UPDATE home_members SET room_ids=$3,device_ids=NULL WHERE home_id=$1 AND user_id=$2', [home, member, [room]]);
    const staleRoom = await preview('rooms', room); await createDevice(home, room, 'another-room-panel');
    assert.equal((await remove('rooms', room, staleRoom)).status, 409);
    const roomPlan = await preview('rooms', room); assert.equal((await remove('rooms', room, roomPlan)).status, 200);
    assert.equal((await db.query('SELECT room_id FROM devices WHERE id=$1', [movedDevice.id])).rows[0].room_id, null);
    const disabled = (await db.query('SELECT is_active,room_id FROM routines WHERE id=$1', [roomRoutine.id])).rows[0]; assert.equal(disabled.is_active, false); assert.equal(disabled.room_id, 'all');
    assert.deepEqual((await db.query('SELECT room_ids FROM home_members WHERE home_id=$1 AND user_id=$2', [home, member])).rows[0].room_ids, []);
    let commands = 0; const originalControl = deviceService.controlSwitch; deviceService.controlSwitch = async () => { commands++; };
    try { const result = await routineService.dispatchActions(roomRoutine, true, new Date()); assert.equal(commands, 0); assert.equal(result.success, false); }
    finally { deviceService.controlSwitch = originalControl; }

    await db.query('INSERT INTO home_members(home_id,user_id) VALUES($1,$2)', [otherHome, owner]);
    await db.query("INSERT INTO home_invitations(home_id,invited_by,email,status) VALUES($1,$2,$3,'pending')", [otherHome, other, ownerEmail]);
    await db.query("INSERT INTO email_otps(email,otp,expires_at) VALUES($1,'123456',NOW()+INTERVAL '10 minutes')", [ownerEmail]);
    const closed = []; const cachedSocket = { close: (...values) => closed.push(values) }; socketManager.sessions.set(cachedSocket, { id: owner, expiresAt: Date.now() + 10000 });
    const userPlan = await preview('users', owner); assert.ok(userPlan.impact.some(item => item.label === 'Owned homes deleted' && item.count === 1));
    assert.equal((await remove('users', owner, userPlan)).status, 200);
    assert.equal(await exists('users', owner), false); assert.equal(await exists('homes', home), false); assert.equal(await exists('homes', otherHome), true); assert.equal(await exists('devices', otherDevice.id), true);
    assert.equal((await db.query('SELECT 1 FROM email_otps WHERE email=$1', [ownerEmail])).rowCount, 0);
    assert.equal((await db.query('SELECT 1 FROM home_invitations WHERE email=$1', [ownerEmail])).rowCount, 0);
    assert.equal(closed.length, 1); assert.equal(socketManager.sessions.has(cachedSocket), false);
    token = accountToken; assert.equal((await request('/account')).status, 403);
  } finally {
    if (users.length) await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    if (fw) { await db.query('DELETE FROM ota_jobs WHERE firmware_id=$1', [fw.id]); await db.query('DELETE FROM ota_firmware WHERE id=$1', [fw.id]); }
    await new Promise(resolve => server.close(resolve)); await db.end();
  }
});

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = randomBytes(32).toString('hex');

const { db } = await import('../dist/config/database.js');
const { authService } = await import('../dist/modules/auth/auth.service.js');
const { verifySessionToken } = await import('../dist/modules/auth/auth.middleware.js');
const { findOwnedDevice, ownsHome } = await import('../dist/modules/homes/home.access.js');
const { routineService } = await import('../dist/modules/routines/routine.service.js');
const { deviceService } = await import('../dist/modules/devices/device.service.js');

const owner = '19ce50a1-804f-466a-8134-60d158467f1a';
const other = '52b1c653-e9c1-4c0d-b144-f3f86bb96721';
const homeId = '31b5a02a-e838-41d0-aded-532c00f4eeb5';

test('session verification requires a current verified session token', () => {
  assert.equal(verifySessionToken(authService.generateToken(owner)).id, owner);
  const previousSession = jwt.sign({ id: owner }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.throws(() => verifySessionToken(previousSession));
});

test('home and device lookups are scoped to the owner', async context => {
  context.mock.method(db, 'query', async (sql, params) => {
    if (sql.includes('JOIN homes')) {
      assert.ok(sql.includes('h.owner_id = $1'));
      assert.equal(params[2], false);
      return { rows: params[0] === owner ? [{ device_id: params[1], home_id: homeId }] : [] };
    }
    assert.ok(sql.includes('WHERE id::text = $1 AND owner_id = $2'));
    return { rowCount: Number(params[0] === homeId && params[1] === owner) };
  });
  assert.equal(await ownsHome(owner, homeId), true);
  assert.equal(await ownsHome(other, homeId), false);
  assert.equal((await findOwnedDevice(owner, 'panel')).home_id, homeId);
  assert.equal(await findOwnedDevice(other, 'panel'), undefined);
});

test('scheduled off overrides an on action and the failure count is accurate', async context => {
  context.mock.method(db, 'query', async (sql, params) => sql.includes('JOIN homes')
    ? { rows: [{ device_id: params[1], home_id: homeId }] }
    : { rowCount: 1 });
  const send = context.mock.method(deviceService, 'controlSwitch', async id => {
    if (id === 'offline') throw new Error('Device is offline');
  });
  const routine = {
    user_id: owner,
    home_id: homeId,
    actions: ['panel', 'offline'].map(deviceId => ({ deviceId, channel: 1, targetState: true })),
  };
  assert.deepEqual(await routineService.dispatchActions(routine, false), {
    success: false,
    executedActions: 1,
    failedActions: 1,
  });
  assert.deepEqual(send.mock.calls.map(call => call.arguments), [
    ['panel', 1, 'off'],
    ['offline', 1, 'off'],
  ]);
});

test('device telemetry accepts typed channels and finite sensor values', async () => {
  const { normalizeSwitches, normalizeReadings } = await import('../dist/modules/devices/telemetry.js');
  assert.deepEqual(normalizeSwitches({ '1': true, '2': false, '3': 'on', '18': true }), { '1': true, '2': false });
  assert.deepEqual(normalizeReadings({ '1': { value: 0, unit: ' ?C ' }, '2': { value: false }, '3': { value: Infinity } }), [
    { channel: 1, value: 0, unit: '?C' }, { channel: 2, value: false, unit: '' },
  ]);
});

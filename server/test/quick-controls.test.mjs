import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOffTargets } from '../dist/utils/quick-controls.js';

const device = (id, room_id, extra = {}) => ({
  id, device_id: id, room_id, model_code: 'TP2', custom_name: id, is_online: true,
  endpoints: [1, 2].map(endpoint_index => ({ endpoint_type: 'RELAY', endpoint_index })), ...extra,
});

test('All Off covers all rooms and unassigned devices, while a room scope never leaks', () => {
  const devices = [device('living', 'r1'), device('bed', 'r2'), device('unassigned', null)];
  assert.equal(getOffTargets(devices, null).length, 6);
  assert.deepEqual(getOffTargets(devices, 'r1').map(target => target.deviceId), ['living', 'living']);
  assert.equal(getOffTargets(devices, '__missing__').length, 0);
});

test('All Off excludes view-only devices and sensors and preserves offline status', () => {
  const devices = [device('view', 'r1', { can_control: false }),
    device('offline', 'r1', { is_online: false }),
    device('sensor', 'r1', { endpoints: [{ endpoint_type: 'SENSOR', endpoint_index: 1 }] })];
  const targets = getOffTargets(devices, null);
  assert.equal(targets.length, 2);
  assert.ok(targets.every(target => target.deviceId === 'offline' && !target.online));
});

test('meter relays use channel one and duplicate or invalid endpoints are ignored', () => {
  const devices = [device('meter', 'r1', { model_code: 'EMS3', endpoints: [
    { endpoint_type: 'PHASE', endpoint_index: 1 },
    { endpoint_type: 'RELAY', endpoint_index: 4 },
  ] }), device('panel', 'r1', { endpoints: [1, 1, 0, -1].map(endpoint_index => ({ endpoint_type: 'RELAY', endpoint_index })) })];
  assert.deepEqual(getOffTargets(devices, null).map(target => [target.deviceId, target.channel]), [['meter', 1], ['panel', 1]]);
});

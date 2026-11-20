import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { ROOM_PRESETS, getRoomImage } from '../dist/config/room-presets.js';

test('all 15 room choices resolve to supplied image files', () => {
  assert.equal(ROOM_PRESETS.length, 15);
  for (const room of ROOM_PRESETS) {
    assert.equal(getRoomImage(room.name), room.image_path);
    assert.ok(existsSync(new URL('../../public/' + room.image_path, import.meta.url)), room.image_path);
  }
});

test('legacy room names map correctly and custom names have no default image', () => {
  assert.equal(getRoomImage(' Master Bedroom '), 'Rooms Images/Master Bed Room.png');
  assert.equal(getRoomImage('Kids Bedroom'), 'Rooms Images/Kids Bed Room.png');
  assert.equal(getRoomImage('Dining'), 'Rooms Images/Dinning Area.png');
  assert.equal(getRoomImage('Theater Room'), 'Rooms Images/Theater Room.png');
  assert.equal(getRoomImage('Custom workshop'), null);
});

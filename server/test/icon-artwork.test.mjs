import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ICON_ARTWORK } from '../dist/config/icon-artwork.js';

test('all updated icon assets have valid original dimensions, framing and cache versions', () => {
  assert.equal(Object.keys(ICON_ARTWORK).length, 187);
  for (const [filename, artwork] of Object.entries(ICON_ARTWORK)) {
    const bytes = readFileSync(new URL('../../public/ICONS/' + encodeURIComponent(filename), import.meta.url));
    assert.equal(bytes.readUInt32BE(16), artwork.sourceWidth, filename);
    assert.equal(bytes.readUInt32BE(20), artwork.sourceHeight, filename);
    assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 12), artwork.version, filename);
    assert.ok(artwork.x >= 0 && artwork.y >= 0 && artwork.width > 0 && artwork.height > 0, filename);
    assert.ok(artwork.x + artwork.width <= artwork.sourceWidth && artwork.y + artwork.height <= artwork.sourceHeight, filename);
  }
});

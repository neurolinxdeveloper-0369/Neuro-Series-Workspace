const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('public/logo.png');
let offset = 8;
let idatBuffers = [];
let beforeIdat = buf.slice(0, 8);
let afterIdat = [];
let idatFound = false;

while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  const chunkTotal = 12 + len;
  if (type === 'IDAT') {
    idatFound = true;
    idatBuffers.push(buf.slice(offset + 8, offset + 8 + len));
  } else if (!idatFound) {
    beforeIdat = Buffer.concat([beforeIdat, buf.slice(offset, offset + chunkTotal)]);
  } else {
    afterIdat.push(buf.slice(offset, offset + chunkTotal));
  }
  offset += chunkTotal;
}

const decompressed = zlib.inflateSync(Buffer.concat(idatBuffers));
const modified = Buffer.from(decompressed);

let p = 0;
for (let y = 0; y < 70; y++) {
  p++; // skip filter byte
  for (let x = 0; x < 70; x++) {
    const r = modified[p];
    const g = modified[p + 1];
    const b = modified[p + 2];
    const a = modified[p + 3];
    // Check if pixel is white or near-white
    if (a > 30 && r > 200 && g > 200 && b > 200) {
      modified[p] = 15;     // slate-900 / black
      modified[p + 1] = 23;
      modified[p + 2] = 42;
    }
    p += 4;
  }
}

const newIdatData = zlib.deflateSync(modified);

function makeCrcTable() {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
}
const crcTable = makeCrcTable();
function crc32(b) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < b.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ b[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const idatType = Buffer.from('IDAT', 'ascii');
const typeAndData = Buffer.concat([idatType, newIdatData]);
const crcVal = crc32(typeAndData);

const newIdatChunk = Buffer.alloc(12 + newIdatData.length);
newIdatChunk.writeUInt32BE(newIdatData.length, 0);
typeAndData.copy(newIdatChunk, 4);
newIdatChunk.writeUInt32BE(crcVal, 8 + newIdatData.length);

const finalPng = Buffer.concat([beforeIdat, newIdatChunk, ...afterIdat]);
fs.writeFileSync('public/logo_black.png', finalPng);
console.log('Successfully created public/logo_black.png! Size:', finalPng.length);

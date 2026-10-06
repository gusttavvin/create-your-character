/**
 * Rounds off the tip of the monster kit's big tongue.
 *
 * `big_tongue.png` was exported with its bottom sliced: the mouth is still 130 px wide on
 * its last row and simply stops, so every monster wearing it has a tongue that ends in a
 * straight line. This grows the missing tip back: the last intact row is carried downwards
 * along an elliptical cap, squeezing its colours towards the middle, so the red, the dark
 * groove and the black outline all close the way the artist drew the rest of the shape.
 *
 * Usage: node round-tongue.cjs <in.png> <out.png> [lipCapPx] [redCapPx]
 */
const fs = require('fs');
const zlib = require('zlib');

/* ----------------------------------------------------------------- PNG I/O */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function decode(file) {
  const b = fs.readFileSync(file);
  let off = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.slice(off + 4, off + 8).toString('ascii');
    const data = b.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('expected 8-bit RGBA, not interlaced');
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  const stride = w * 4;
  // undo the per-scanline filters
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = px.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0;
      const bb = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= 4 ? px[(y - 1) * stride + i - 4] : 0;
      let v = src[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += bb;
      else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) {
        const p = a + bb - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - bb);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
      }
      cur[i] = v & 0xff;
    }
    cur.copy(px, y * stride);
  }
  return { w, h, px };
}

function encode(file, w, h, px) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from('89504e470d0a1a0a', 'hex'),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

/* ------------------------------------------------------------- the repair */

const [, , inFile, outFile, capArg, redArg] = process.argv;
const CAP = Number(capArg || 38); // how far the dark lip still had to close
const RED_CAP = Number(redArg || 9); // the red tip is nearly finished; it needs a few rows
const { w, h, px } = decode(inFile);
const at = (x, y) => (y * w + x) * 4;

/** First and last opaque pixel of a row, or null for an empty one. */
function span(y) {
  let lo = -1;
  let hi = -1;
  for (let x = 0; x < w; x++) {
    if (px[at(x, y) + 3] > 60) {
      if (lo < 0) lo = x;
      hi = x;
    }
  }
  return lo < 0 ? null : { lo, hi };
}

/** First and last pixel of the tongue's own red on a row. */
function redSpan(y) {
  let lo = -1;
  let hi = -1;
  for (let x = 0; x < w; x++) {
    const i = at(x, y);
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a > 60 && r > 170 && g > 60 && g < 150 && b > 50 && b < 150) {
      if (lo < 0) lo = x;
      hi = x;
    }
  }
  return lo < 0 ? null : { lo, hi };
}

let last = -1;
for (let y = h - 1; y >= 0; y--) {
  if (span(y)) {
    last = y;
    break;
  }
}
const seam = span(last);
const red = redSpan(last) ?? redSpan(last - 1);
if (last + CAP >= h) throw new Error('no room below the art for the new tip');

/** Averages a patch of the drawing, so the new pixels wear its own colours. */
function sample(x0, x1, y0, y1) {
  let n = 0;
  const c = [0, 0, 0];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = at(x, y);
      if (px[i + 3] < 200) continue;
      c[0] += px[i];
      c[1] += px[i + 1];
      c[2] += px[i + 2];
      n++;
    }
  return n ? c.map((v) => v / n) : [24, 24, 24];
}

// the dark lip, taken from the edge of the last row, and the red, from the tongue's tip
const INK = sample(seam.lo + 4, seam.lo + 14, last - 8, last);
const RED = sample(red.lo + 2, red.hi - 2, last - 6, last);

/** Half-width of an elliptical cap `hh` tall that starts `half` wide. */
const capHalf = (half, hh, t) => half * Math.sqrt(Math.max(0, 1 - (t / hh) * (t / hh)));

const cxInk = (seam.lo + seam.hi) / 2;
const halfInk = (seam.hi - seam.lo) / 2;
const cxRed = (red.lo + red.hi) / 2;
const halfRed = (red.hi - red.lo) / 2;
const SS = 4; // sub-samples per axis, so the new edge is as soft as the drawn one

for (let dy = 1; dy <= CAP; dy++) {
  const y = last + dy;
  for (let x = Math.floor(cxInk - halfInk) - 2; x <= Math.ceil(cxInk + halfInk) + 2; x++) {
    let inInk = 0;
    let inRed = 0;
    for (let sy = 0; sy < SS; sy++) {
      const t = dy - 1 + (sy + 0.5) / SS;
      const hwInk = capHalf(halfInk, CAP, t);
      const hwRed = capHalf(halfRed, RED_CAP, t);
      for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + 0.5) / SS;
        if (Math.abs(fx - cxInk) <= hwInk) inInk++;
        if (t <= RED_CAP && Math.abs(fx - cxRed) <= hwRed) inRed++;
      }
    }
    if (!inInk && !inRed) continue;
    const n = SS * SS;
    const ca = inInk / n;
    const cr = inRed / n;
    // the red tip sits on the dark lip, which closes below it
    const alpha = cr + ca * (1 - cr);
    // the lip turns under the tongue, so it darkens a little as it closes
    const shade = 1 - 0.12 * (dy / CAP);
    const o = at(x, y);
    for (let k = 0; k < 3; k++) {
      const v = (RED[k] * cr + INK[k] * ca * (1 - cr)) / Math.max(1e-6, alpha);
      px[o + k] = Math.max(0, Math.min(255, Math.round(v * shade)));
    }
    px[o + 3] = Math.round(alpha * 255);
  }
}

encode(outFile, w, h, px);
console.log(
  `seam row ${last}: lip ${seam.lo}..${seam.hi}, red ${red.lo}..${red.hi}; ` +
    `lip cap ${CAP}px, red cap ${RED_CAP}px; ink ${INK.map(Math.round)}, red ${RED.map(Math.round)} -> ${outFile}`,
);

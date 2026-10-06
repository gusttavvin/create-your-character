/**
 * Reads a PNG. Eight bits a channel, colour type 2 or 6, not interlaced — which is what
 * `hand-ref.png` is, and there is no image library in this project to do it for us.
 *
 * It exists so `claw-hand.cjs` can trace Clara's reference photograph instead of guessing at
 * it: the outline of the hand she asked for is in those pixels, and a shape walked out of
 * them is the shape she sent, not an impression of it.
 */
const fs = require('fs');
const zlib = require('zlib');

function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8;
  let head = null;
  const parts = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.slice(p + 4, p + 8).toString();
    const data = b.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      head = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    }
    if (type === 'IDAT') parts.push(data);
    if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!head || head.depth !== 8 || head.interlace !== 0) throw new Error(`${file}: only plain 8-bit PNGs`);
  const ch = head.color === 2 ? 3 : head.color === 6 ? 4 : 0;
  if (!ch) throw new Error(`${file}: colour type ${head.color} is not supported`);

  const raw = zlib.inflateSync(Buffer.concat(parts));
  const { w, h } = head;
  const stride = w * ch;
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = px.slice(y * stride, (y + 1) * stride);
    const up = y ? px.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b2 = up[i];
      const c = i >= ch ? up[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b2;
      else if (filter === 3) v += (a + b2) >> 1;
      else if (filter === 4) {
        // Paeth: whichever of the three neighbours the gradient points at
        const guess = a + b2 - c;
        const da = Math.abs(guess - a);
        const db = Math.abs(guess - b2);
        const dc = Math.abs(guess - c);
        v += da <= db && da <= dc ? a : db <= dc ? b2 : c;
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, px };
}

/** The colour at one pixel, as `[r, g, b]`. */
function at(img, x, y) {
  const i = (y * img.w + x) * img.ch;
  return [img.px[i], img.px[i + 1], img.px[i + 2]];
}

module.exports = { readPng, at };

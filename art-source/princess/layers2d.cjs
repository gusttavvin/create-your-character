/**
 * The flat princess from the layered doll pictures in reference/v3 (made with an image
 * generator from Clara's dolls, as five layers per princess: face, dress, hair with crown,
 * eyes with brows, mouth — all on one 768 by 1152 canvas, the four princesses lined up alike).
 *
 *   node art-source/princess/layers2d.cjs        (needs sharp)
 *
 * Writes the game's pictures in public/princess/ under their old names, so nothing else
 * changes: head-<hair>-<tone> and head-<tone> (the face), dress-<dress>-<tone>,
 * hair-<hair>-front (hair and crown; hair-<hair>-back is left clear: the picture is drawn as
 * seen from the front, so nothing of it goes behind her), eyes-<eyes> and brows-<eyes> (the
 * brows taken apart from the eyes, so they stay still when she blinks), mouth-<mouth>; and the
 * cards' boxes in src/characters/princess/pieces.json.
 *
 * Each layer is enlarged by 4/3 onto the 1024 by 1536 sheet and moved down so her eyes are where
 * the game has always had them (y 492, the blink's middle). The skin is made the same on all four
 * (the mermaid's came out warmer) and painted in the four tones the child can choose.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);

/**
 * FROM_REF: the layers cut by cutref.cjs straight from Clara's pictures of her four princesses
 * (reference/v4), already in place: nothing is moved, grown, rounded or repainted on them (all
 * the corrections below were for the layers of reference/v3, made by an image generator, which
 * did not look like her princesses: "o rosto ainda tá quadrado... os olhos estão diferentes...
 * o cabelo está bem maior que na referência").
 */
const FROM_REF = true;
const SRC = path.join(__dirname, 'reference', FROM_REF ? 'v4' : 'v3');
const OUT = path.join(__dirname, '..', '..', 'public', 'princess');
const BOXES = path.join(__dirname, '..', '..', 'src', 'characters', 'princess', 'pieces.json');
const W = 1024;
const H = 1536;
const SCALE = 4 / 3;
/** How far down the enlarged layers go, so the eyes (y 336 on the small canvas) sit at y 492. */
const DY = Math.round(492 - 336 * SCALE);

const SETS = [
  { dir: '01_verde_ruiva', dress: 'gown', hair: 'braids', eyes: 'sparkly', mouth: 'smile' },
  { dir: '02_rosa_castanha', dress: 'aline', hair: 'long', eyes: 'happy', mouth: 'laugh' },
  { dir: '03_sereia_cacheada', dress: 'mermaid', hair: 'curly', eyes: 'wink', mouth: 'oh' },
  { dir: '04_azul_loira', dress: 'star', hair: 'bun', eyes: 'sleepy', mouth: 'tongue' },
];
/** The game's tones (as dolls.cjs and the 3D paint them): the others are this much darker than light. */
const TONES = { light: [253, 197, 155], tan: [228, 160, 116], brown: [178, 114, 74], dark: [114, 70, 44] };

function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

/**
 * Where her face and its features go, on the small 768 by 1152 canvas of the layers: every face
 * is moved (with its hair) so its chin is on CHIN_AT, and every pair of eyes, every nose and
 * every mouth is centred on its own line above it, whichever princess it was drawn for. Drawn,
 * the four faces had their chins at different heights and the features sat low (the mouth
 * almost on the chin), so a mouth from one princess on another's face could fall off it.
 */
const PLACE = { chin: 420, eyes: 336, nose: 358, mouthTop: 381 };
/**
 * How much bigger the eyes and brows are drawn than in the layers, about the middle of the eyes
 * (Clara's picture of the blue princess, 23 Oct 2026: big round eyes, wide apart, in the middle
 * of a round face; ours were smaller, closer together and high, with a long face under them).
 * Measured on her blue and pink princesses, from hairline (0) to chin (1): brows at 0.24, eyes at
 * 0.55-0.60, irises 0.30-0.36 across and 0.58-0.67 apart. At 1.2 ours were 0.28 across and 0.48
 * apart, with the brows low over them at 0.30 ("ainda tô achando os olhos estranhos").
 */
const EYES_GROW = 1.2;
/** And the brows that much higher again (sheet pixels), off her eyes. */
const BROWS_UP = 16;
/**
 * Corrections for single pieces, after that (small-canvas pixels, + is lower): the purple eyes
 * are drawn bigger and lower in their frame and looked droopy beside the others.
 */
const NUDGE = { eyes: { sleepy: -8 }, mouth: {} };
/**
 * The oval of her face below her eyes, on the sheet: hair over it goes behind her face. Her
 * cheeks, not her ears (which stick out past it, with the earrings).
 */
// (from top, quickly: fading in over 60 px from y 410, curls over her temples were left half
// clear, grey smudges beside her eyes)
const FACE_OVAL = { cx: 512, cy: 470, rx: 140, ry: 150, top: 440 };
/**
 * And her round face (see CHEEKS), from her eyes down: hair over it goes behind it too, so her
 * face shows as wide across her eyes as in Clara's pictures. Not over her ears (with what hangs
 * from them), and starting quickly, under her brows: a slow start left half-clear locks over her
 * temples, like ghosts.
 */
function cheekBehind(x, y) {
  if (y < 462) return 0;
  const off = Math.abs(x - W / 2);
  if (y < 562 && off > 138) return 0;
  const R = y < CHEEKS.from ? CHEEKS.hw : faceHalf(y) + 2;
  if (off > R) return 0;
  return Math.min(1, (y - 462) / 14) * Math.min(1, (R - off) / 8);
}
/** Where each princess's nose is on the sheet (measured on base_rosto), to lift it with the eyes. */
const NOSE = { '01_verde_ruiva': [516, 511], '02_rosa_castanha': [512, 527], '03_sereia_cacheada': [513, 532], '04_azul_loira': [511, 525] };

/**
 * FROM_REF: where each face's nose is on the sheet (measured on a grid), and the head with no
 * hair's; each is lifted NOSE_UP, as it sat too close to her mouth (Clara: "sobe ele um pouquinho").
 */
const NOSE_REF = { '01_verde_ruiva': [503, 528], '02_rosa_castanha': [509, 525], '03_sereia_cacheada': [513, 528], '04_azul_loira': [511, 526], bald: [505, 530] };
const NOSE_UP = 10;

/** From the small canvas to the sheet (y). */
const toSheet = (y) => y * SCALE + DY;

/** A layer, enlarged onto the sheet and moved down (and `up` sheet pixels higher): RGBA pixels, 1024 by 1536. */
async function sheet(file, up = 0) {
  up = Math.round(up);
  const big = await sharp(fs.readFileSync(file)).ensureAlpha().resize(Math.round(768 * SCALE), Math.round(1152 * SCALE), { kernel: 'lanczos3' }).png().toBuffer();
  const top = Math.max(0, DY - up);
  const skip = Math.max(0, up - DY);
  const crop = await sharp(big).extract({ left: 0, top: skip, width: W, height: Math.min(H - top, Math.round(1152 * SCALE) - skip) }).png().toBuffer();
  const { data } = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left: 0, top }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
}

async function write(file, img) {
  const buf = await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  for (let k = 0; ; k++) {
    try {
      fs.writeFileSync(path.join(OUT, file), buf);
      return;
    } catch (e) {
      if (k > 40) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/**
 * Lifts the nose drawn on a face by `dy`: the nose is lifted out with a soft edge, the skin
 * round it grown back over where it was, and the nose laid back on higher up.
 */
function liftNose(face, [cx, cy], dy, rx = 26, ry = 22) {
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const patch = new Uint8ClampedArray(face);
  const out = new Uint8ClampedArray(face);
  // the hole, filled from its rim inwards with the average of the skin round each pixel
  const known = new Uint8Array(W * H).fill(1);
  let todo = [];
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++)
    for (let x = cx - rx - 2; x <= cx + rx + 2; x++)
      if (inside(x, y) <= 1.15) {
        known[y * W + x] = 0;
        todo.push(y * W + x);
      }
  while (todo.length) {
    const rest = [];
    const done = [];
    for (const i of todo) {
      const x = i % W;
      const y = (i / W) | 0;
      const sum = [0, 0, 0];
      let n = 0;
      for (let dy2 = -1; dy2 <= 1; dy2++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = (y + dy2) * W + x + dx;
          if (!known[j]) continue;
          for (let c = 0; c < 3; c++) sum[c] += out[j * 4 + c];
          n++;
        }
      if (n >= 2) done.push([i, sum.map((v) => v / n)]);
      else rest.push(i);
    }
    if (!done.length) break;
    for (const [i, c] of done) {
      for (let k = 0; k < 3; k++) out[i * 4 + k] = c[k];
      known[i] = 1;
    }
    todo = rest;
  }
  // the nose back on, dy higher, fading out towards the edge of what was lifted
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const d = inside(x, y);
      if (d > 1) continue;
      const a = d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45;
      const src = (y * W + x) * 4;
      const dst = ((y - dy) * W + x) * 4;
      for (let k = 0; k < 3; k++) out[dst + k] = out[dst + k] * (1 - a) + patch[src + k] * a;
    }
  return out;
}

/**
 * How far down (sheet pixels) each hairstyle's hairline is moved, so every forehead is the same
 * height: drawn, the long hair started high (a big forehead) and the bun low (a small one).
 */
const HAIRLINE = { braids: 0, long: 40, curly: 0, bun: -53 };

/**
 * Moves a hairline down by `by` pixels (up if negative) without moving the top of the hair or
 * anything from her ears down (her earrings): the hair is stretched or squeezed smoothly between
 * them, most at the hairline itself (y 330).
 */
function hairline(img, by) {
  if (!by) return img;
  const ease = (t) => t * t * (3 - 2 * t);
  const shift = (y) => (y <= 120 || y >= 560 ? 0 : y < 330 ? by * ease((y - 120) / 210) : by * ease((560 - y) / 230));
  const o = new Uint8ClampedArray(img.length);
  for (let y = 0; y < H; y++) {
    const sy = y - shift(y);
    const y0 = Math.max(0, Math.min(H - 1, Math.floor(sy)));
    const y1 = Math.min(H - 1, y0 + 1);
    const t = sy - Math.floor(sy);
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 4; c++) o[(y * W + x) * 4 + c] = img[(y0 * W + x) * 4 + c] * (1 - t) + img[(y1 * W + x) * 4 + c] * t;
  }
  return o;
}

/**
 * Her neck on the sheet: above `fade` only the face's own neck shows, and from there to `to` the
 * dress's skin comes in over it (the face's neck ends at y 683-690, her shoulders begin near 650).
 */
const NECK = { from: 590, fade: 636, to: 676 };

/** Where her chin ends on the sheet: hair below it goes behind her (see HAIR_BEHIND). */
const CHIN = 640;
/** Where the tops of the dresses' shoulders are on the sheet: her hair beside them can be hidden. */
const SHOULDERS = 580;
/** The hairstyles whose lower hair goes behind her; the braid drapes over her shoulder in front. */
const HAIR_BEHIND = { long: true, curly: true, bun: true, braids: false };
/**
 * Rosy cheeks, as the dolls have: a soft round flush on each cheek, below and outside the eyes.
 * It reddens the skin under it rather than painting pink on it, so it suits every skin tone.
 */
// (as in Clara's picture: a round pink spot on each cheek, out under the eyes, with a soft edge —
// it was a wide faint flush)
function blush(face, { y = 570, x = [412, 612], rx = 38, ry = 30, strength = 0.8 } = {}) {
  const o = new Uint8ClampedArray(face);
  const k = [1.0, 0.7, 0.76];
  for (const cx of x)
    for (let py = y - ry * 2; py <= y + ry * 2; py++)
      for (let px = cx - rx * 2; px <= cx + rx * 2; px++) {
        const i = (py * W + px) * 4;
        if (face[i + 3] < 200) continue;
        const d = Math.sqrt(((px - cx) / rx) ** 2 + ((py - y) / ry) ** 2);
        const t = Math.min(1, Math.max(0, (d - 0.55) / 0.5));
        const a = strength * (1 - t * t * (3 - 2 * t));
        if (a < 0.01) continue;
        for (let c = 0; c < 3; c++) o[i + c] = face[i + c] * (1 - a + a * k[c]);
      }
  return o;
}

/**
 * Round cheeks (Clara's pink and blue princesses: a round, chubby face, widest across her eyes and
 * curving down to a small round chin; ours narrowed from under her ears into a pointed chin).
 * Each row of the face below her ears is widened about her middle to the outline of her pink
 * princess's face (FACE_LINE: half-widths, as a share of the widest, from the middle of her eyes
 * (0) to her chin (1), measured on the picture); never narrower than it was, and her ears and
 * neck are left as they are. (A plain ellipse, widest below her ears, came out square: wide jaws
 * under narrow temples, "o rosto ainda tá muito quadrado".)
 */
const CHEEKS = { eye: 508, chin: 626, hw: 136, from: 552, to: 626 };
const FACE_LINE = [[0, 1], [0.37, 1], [0.61, 0.89], [0.73, 0.78], [0.85, 0.61], [0.91, 0.44], [1, 0.24]];
/** Half the width of her face at row y, as it is to be. */
function faceHalf(y) {
  const u = (y - CHEEKS.eye) / (CHEEKS.chin - CHEEKS.eye);
  if (u <= 0) return CHEEKS.hw;
  for (let k = 1; k < FACE_LINE.length; k++) {
    const [u1, p1] = FACE_LINE[k];
    const [u0, p0] = FACE_LINE[k - 1];
    if (u <= u1) return CHEEKS.hw * (p0 + ((p1 - p0) * (u - u0)) / (u1 - u0));
  }
  return 0;
}
function roundCheeks(face) {
  const out = new Uint8ClampedArray(face);
  const f = new Float32Array(H).fill(1);
  for (let y = CHEEKS.from; y < CHEEKS.to; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) if (face[(y * W + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    const now = (r - l) / 2;
    if (now > 10) f[y] = Math.min(1.7, Math.max(1, faceHalf(y) / now));
  }
  // smoothly from row to row, and back to 1 at her ears and her neck
  const g = new Float32Array(H).fill(1);
  for (let y = CHEEKS.from; y < CHEEKS.to + 16; y++) {
    let sum = 0;
    let n = 0;
    for (let k = -8; k <= 8; k++) {
      sum += f[y + k] ?? 1;
      n++;
    }
    const ends = Math.min(1, (y - CHEEKS.from) / 14, Math.max(0, (CHEEKS.to + 16 - y) / 16));
    g[y] = 1 + (sum / n - 1) * ends;
  }
  for (let y = CHEEKS.from; y < CHEEKS.to + 16; y++) {
    if (g[y] === 1) continue;
    for (let x = 0; x < W; x++) {
      const sx = W / 2 + (x - W / 2) / g[y];
      const x0 = Math.floor(sx);
      const t = sx - x0;
      const o = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = face[(y * W + x0) * 4 + c] * (1 - t) + face[(y * W + x0 + 1) * 4 + c] * t;
    }
  }
  return out;
}

/** The middle colour of the skin on her forehead: what "her skin" is in this picture. */
function skinOf(face) {
  const vals = [];
  for (let y = 300; y < 340; y++)
    for (let x = 480; x < 545; x++) {
      const i = (y * W + x) * 4;
      if (face[i + 3] > 250) vals.push([face[i], face[i + 1], face[i + 2]]);
    }
  return [0, 1, 2].map((c) => vals.map((v) => v[c]).sort((a, b) => a - b)[vals.length >> 1]);
}

/** Where a princess's chin, eyes and mouth were drawn on the small canvas of her layers. */
async function measure(L) {
  const raw = async (n) => {
    const { data, info } = await sharp(fs.readFileSync(L(n))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { d: data, w: info.width, h: info.height };
  };
  const centreY = (im) => {
    let sy = 0;
    let n = 0;
    for (let i = 0; i < im.w * im.h; i++) if (im.d[i * 4 + 3] > 128) { sy += (i / im.w) | 0; n++; }
    return sy / n;
  };
  const face = await raw('base_rosto');
  const width = [];
  for (let y = 0; y < face.h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < face.w; x++) if (face.d[(y * face.w + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    width.push(l < 0 ? 0 : r - l);
  }
  // her chin: below the widest row (her ears), where the face narrows to her neck
  let y = width.indexOf(Math.max(...width));
  while (y < face.h && width[y] > 90) y++;
  // a mouth by the top of its upper lip: open, laughing or with a tongue out, a mouth's middle
  // is lower, and placed by its middle each mouth sat at a different height under her nose
  const mouth = await raw('boca');
  let top = 0;
  while (top < mouth.h && !mouth.d.subarray(top * mouth.w * 4, (top + 1) * mouth.w * 4).some((v, k) => k % 4 === 3 && v > 128)) top++;
  return { chin: y, eyes: centreY(await raw('olhos')), mouth: top };
}

function components(mask) {
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  const stack = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    let top = 0;
    stack[top++] = s;
    label[s] = id;
    while (top) {
      const i = stack[--top];
      n++;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && mask[j] && label[j] < 0) {
          label[j] = id;
          stack[top++] = j;
        }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/**
 * The skin on a dress picture (her neck, chest, arms, hands, legs): the colour of her skin in
 * any light, in big connected patches. Gold trims are yellower, satin pinks and reds pinker.
 */
function skinMask(img, base) {
  const [h0, s0] = hsv(...base);
  const near = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (img[i * 4 + 3] < 30) continue;
    const [h, s, v] = hsv(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
    // shadows on skin go redder, shadows on gold go towards skin from the yellow side: the
    // window reaches further to the red than to the yellow
    // (skin in shadow, as under her chin, is redder and more saturated: allowed on the red side)
    // (FROM_REF: the shine on her shoulders is paler, and was left light on dark skin)
    if (h >= h0 - 13 && h <= h0 + 6 && s >= s0 * (FROM_REF ? 0.22 : 0.4) && s <= (h <= h0 - 2 ? 0.8 : s0 + 0.3) && v >= 0.3) near[i] = 1;
  }
  const c = components(near);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (near[i] && c.sizes[c.label[i]] > 1500) mask[i] = 1;
  // the soft rim of her outline (half clear, mixed with whatever was behind her) and the
  // specks inside her skin, if they are warm: left out, they showed as a pale rim on dark skin
  const edge = new Uint8Array(W * H);
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (mask[i] || img[i * 4 + 3] < 10) continue;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) n += mask[i + dy * W + dx];
      if (n < 6) continue;
      const [h, s] = hsv(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
      if (h >= h0 - 20 && h <= h0 + 8 && s <= s0 + 0.35) edge[i] = 1;
    }
  for (let i = 0; i < W * H; i++) if (edge[i]) mask[i] = 1;
  return mask;
}

/**
 * The skin drawn round the eyes and the mouth (eyelids, the skin round her lips), taken out:
 * those pictures are the same for every skin, and on a darker face that light skin showed as a
 * pale patch. The face's own skin is under them, in the right tone. Fades out what is nearly
 * skin, so no hard edge is left.
 */
function dropSkin(img, base, only = null) {
  const [h0, s0, v0] = hsv(...base);
  const o = new Uint8ClampedArray(img);
  for (let i = 0; i < W * H; i++) {
    if (img[i * 4 + 3] < 10) continue;
    if (only && !only(i % W, (i / W) | 0)) continue;
    const [h, s, v] = hsv(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
    if (h < h0 - 14 || h > h0 + 8 || s > s0 + 0.32 || s < s0 * 0.35 || v < v0 * 0.62) continue;
    // how surely it is skin: lighter and closer to her skin is surer
    const sure = Math.min(1, Math.max(0, (v - v0 * 0.62) / (v0 * 0.18)));
    o[i * 4 + 3] = img[i * 4 + 3] * (1 - sure);
  }
  return o;
}

/** A picture with its skin pixels repainted from the picture's own skin to a tone. */
function toned(img, mask, from, to) {
  const o = new Uint8ClampedArray(img);
  if (FROM_REF) return retoned(img, o, mask, from, to);
  const k = [0, 1, 2].map((c) => to[c] / from[c]);
  for (let i = 0; i < W * H; i++) if (!mask || mask[i]) for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * k[c];
  return o;
}

/**
 * The skin left on an eye or mouth picture (round her lashes and lids, the corners of her lips) in
 * another tone: each pixel as much as it looks like her skin (not lashes, lips, tongue or a brown
 * iris, which are darker or stronger). The eyes and mouth go on every face, so without this they
 * kept a rim of light skin on dark skin.
 */
function skinBits(img, from, to) {
  const all = retoned(img, new Uint8ClampedArray(img), null, from, to);
  const [h0, s0] = hsv(...from);
  const o = new Uint8ClampedArray(img);
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (let i = 0; i < W * H; i++) {
    if (!img[i * 4 + 3]) continue;
    const [h, s, v] = hsv(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
    const dh = ((h - h0 + 540) % 360) - 180;
    const k = ramp(-30, -20, dh) * (1 - ramp(8, 14, dh)) * (1 - ramp(s0 + 0.15, s0 + 0.3, s)) * ramp(0.3, 0.42, v) * ramp(s0 * 0.2, s0 * 0.4, s);
    for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * (1 - k) + all[i * 4 + c] * k;
  }
  return o;
}

/**
 * Where each princess's ears are (small canvas of reference/v4: middle and half width and height,
 * measured by eye on a grid). By colour her ears in the shade of her hair are her hair's colour,
 * and marked so, half her ears stayed light on dark skin.
 */
const EARS = {
  '01_verde_ruiva': [[272, 358, 15, 26], [488, 345, 14, 26]],
  '02_rosa_castanha': [[277, 357, 16, 28], [484, 352, 15, 28]],
  '03_sereia_cacheada': [[272, 360, 16, 26], [500, 360, 16, 26]],
  '04_azul_loira': [[281, 350, 15, 28], [497, 346, 17, 28]],
};

/**
 * Her ears in her hair (they lie between its locks) painted in another skin: inside each ear, with a
 * soft edge, all but her earrings (pearls are colourless, gold and jewels another colour).
 */
function earsIn(hair, ears, from, to) {
  const all = retoned(hair, new Uint8ClampedArray(hair), null, from, to);
  const o = new Uint8ClampedArray(hair);
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (const [ex, ey, erx, ery] of ears) {
    const cx = ex * SCALE;
    const cy = toSheet(ey);
    const rx = erx * SCALE;
    const ry = ery * SCALE;
    for (let y = Math.floor(cy - ry - 4); y <= cy + ry + 4; y++)
      for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
        const i = y * W + x;
        if (!hair[i * 4 + 3]) continue;
        const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
        const [h, s] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
        const red = h >= 330 || h <= 32;
        const k = (1 - ramp(0.85, 1.1, d)) * (red ? 1 : 0) * ramp(0.08, 0.14, s);
        if (!k) continue;
        for (let c = 0; c < 3; c++) o[i * 4 + c] = hair[i * 4 + c] * (1 - k) + all[i * 4 + c] * k;
      }
  }
  return o;
}

/**
 * FROM_REF: her face's skin made smooth, as a doll's is (Clara: "a cabeça ainda está manchada").
 * Where her eyes, brows and mouth were cut out of her picture, the skin grown back came out in
 * patches, and her blush, cut by them, in red smears. So her skin is her own skin blurred wide (a
 * Gaussian over the clean skin only: not her blush, not her nose), her nose laid back on as it
 * was, and a round blush put on each cheek. Her ears, outside the middle of her face, stay.
 */
const FACE_MID = { cx: 512, cy: 505, rx: 150, ry: 140 };
/** (the head with no hair: all of it, but her ears) */
const BALD_MID = { cx: 512, cy: 450, rx: 158, ry: 240 };
const BLUSH = { y: 532, x: [424, 606], rx: 30, ry: 25, strength: 0.5 };
function smoothFace(face, skin, [nx, ny], mid = FACE_MID) {
  const x0 = 300;
  const x1 = 724;
  const y0 = 240;
  const y1 = 700;
  const bw = x1 - x0;
  const bh = y1 - y0;
  const sigma = 16;
  const R = Math.ceil(sigma * 2.5);
  const g = [];
  for (let k = -R; k <= R; k++) g.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const red0 = skin[0] / skin[1];
  const inNose = (x, y) => ((x - nx) / 26) ** 2 + ((y - ny) / 24) ** 2;
  // the clean skin: solid, not blush (redder than her skin), not her nose
  const wgt = new Float32Array(bw * bh);
  const col = new Float32Array(bw * bh * 3);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = ((y + y0) * W + x + x0) * 4;
      if (face[i + 3] < 250 || inNose(x + x0, y + y0) < 1.4) continue;
      // (blush is light and pink; the shade at the sides of her face is as red, but darker, and
      // is her skin: left out too, big patches of it kept their blocks)
      if (face[i] / Math.max(1, face[i + 1]) > red0 + 0.08 && face[i] > skin[0] * 0.9) continue;
      const k = y * bw + x;
      wgt[k] = 1;
      for (let c = 0; c < 3; c++) col[k * 3 + c] = face[i + c];
    }
  // separable Gaussian of weight and colour, then colour / weight
  const blur = (src, n) => {
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++)
        for (let c = 0; c < n; c++) {
          let s = 0;
          for (let k = -R; k <= R; k++) {
            const xx = x + k;
            if (xx >= 0 && xx < bw) s += src[(y * bw + xx) * n + c] * g[k + R];
          }
          tmp[(y * bw + x) * n + c] = s;
        }
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++)
        for (let c = 0; c < n; c++) {
          let s = 0;
          for (let k = -R; k <= R; k++) {
            const yy = y + k;
            if (yy >= 0 && yy < bh) s += tmp[(yy * bw + x) * n + c] * g[k + R];
          }
          out[(y * bw + x) * n + c] = s;
        }
    return out;
  };
  const W1 = blur(wgt, 1);
  const C3 = blur(col, 3);
  const o = new Uint8ClampedArray(face);
  const sm = (a, b, v) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const X = x + x0;
      const Y = y + y0;
      const i = (Y * W + X) * 4;
      const k = y * bw + x;
      if (!face[i + 3] || W1[k] < 1e-3) continue;
      // (only the middle of her face; her ears and the edge of her head stay as they are)
      const d = Math.sqrt(((X - mid.cx) / mid.rx) ** 2 + ((Y - mid.cy) / mid.ry) ** 2);
      let a = 1 - sm(0.85, 1.05, d);
      // (her nose, as it was, softly at its edge)
      a *= sm(0.5, 1.2, inNose(X, Y));
      for (let c = 0; c < 3; c++) o[i + c] = face[i + c] * (1 - a) + (C3[k * 3 + c] / W1[k]) * a;
    }
  return blush(o, BLUSH);
}

/**
 * FROM_REF: a short neck under her chin, as narrow as the narrowest neck of the four dresses
 * (`half`: half its width on each row), fading out towards her collarbone. Her head is drawn in
 * front of her dress (Princess2D), so her chin lies over the top of any dress's neck and her head
 * sits on it (Clara: "deixe ela colada no corpo"; with no hair, the head stood apart over the flat
 * top of the dress's neck). Wider than a dress's neck, it showed beside it on dark skin.
 */
function neckOn(face, half, skin) {
  const o = new Uint8ClampedArray(face);
  const sm = (a, b, v) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // the colour of her neck: her skin in the shade under her chin
  const shade = skin.map((c) => c * 0.86);
  for (let y = 590; y < 660; y++) {
    const hw = half[y];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const off = Math.abs(x - W / 2);
      // (below her chin, nothing of her face wider than the neck)
      if (y >= 614 && off > hw) {
        o[i + 3] = face[i + 3] * (1 - sm(614, 622, y));
        continue;
      }
      if (off > hw) continue;
      const a = 255 * (1 - sm(hw - 3, hw, off)) * (1 - sm(632, 656, y));
      if (face[i + 3] >= a) continue;
      // under what of her face is there, her neck
      const f = face[i + 3] / 255;
      for (let c = 0; c < 3; c++) o[i + c] = face[i + c] * f + shade[c] * (1 - f);
      o[i + 3] = a;
    }
  }
  return o;
}

/**
 * The soft inner edge of her hair, over her face, is half the light skin of her picture: on a
 * darker face it was a light dotted line round it. Within a few pixels of that edge, each pixel is
 * painted in the skin as much as it looks like skin.
 */
function rimIn(hair, face, from, to) {
  const all = retoned(hair, new Uint8ClampedArray(hair), null, from, to);
  const [h0, s0] = hsv(...from);
  const o = new Uint8ClampedArray(hair);
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (let y = 4; y < 700; y++)
    for (let x = 4; x < W - 4; x++) {
      const i = y * W + x;
      if (!hair[i * 4 + 3] || face[i * 4 + 3] < 200) continue;
      let edge = false;
      for (let dy = -4; !edge && dy <= 4; dy++) for (let dx = -4; !edge && dx <= 4; dx++) edge = hair[((y + dy) * W + x + dx) * 4 + 3] < 60;
      if (!edge) continue;
      const [h, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      const dh = ((h - h0 + 540) % 360) - 180;
      const k = ramp(-30, -20, dh) * (1 - ramp(8, 14, dh)) * (1 - ramp(s0 + 0.15, s0 + 0.3, s)) * ramp(0.3, 0.45, v);
      for (let c = 0; c < 3; c++) o[i * 4 + c] = hair[i * 4 + c] * (1 - k) + all[i * 4 + c] * k;
    }
  return o;
}

/**
 * Her own hair, carried on where it was hidden (Clara: "tem que dar continuidade ao cabelo", not
 * another hair laid under it). In her picture her locks stop where her own sleeves and arms lay
 * over them; behind another dress those places show. They are filled by exemplar-based inpainting
 * (Criminisi, Pérez and Toyama): from the edge of what is there inwards, the place where a strand
 * runs into the hole most strongly first, each time with the patch of her own hair (9 by 9) most
 * like what is already round it, so her strands go on in their own direction, light and shade.
 *
 * `hair` is all her hair; `want` (0/1) where her hair is to be (her hair, and where it hangs as in
 * her picture of her from behind); `hidden` (0/1) where it is always under a dress or her face
 * (filled plainly, as no one sees it); `earringsWhite` when her hair has no white shine, so white
 * near it is her pearls. Returns her hair with the holes filled.
 */
function inpaintHair(hair, want, hidden, earringsWhite) {
  const X0 = 140;
  const X1 = W - 140;
  const Y0 = 420;
  const Y1 = 1150;
  const w = X1 - X0;
  const h = Y1 - Y0;
  const r = 4;
  const at = (x, y) => (y + Y0) * W + x + X0;
  const img = new Float32Array(w * h * 3);
  const known = new Uint8Array(w * h); // 1 her hair (and, as it is filled, the hair filled in)
  const todo = new Uint8Array(w * h); // 1 to be filled
  const conf = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const i = at(x, y);
      for (let c = 0; c < 3; c++) img[k * 3 + c] = hair[i * 4 + c];
      // (the pale rim of her hair, half the background of her picture where her sleeves cut it,
      // is filled too: kept, it was white specks by her shoulders)
      const [, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      let rim = false;
      if (s < 0.2 && v > 0.7 && y + Y0 > SHOULDERS)
        for (let dy = -3; !rim && dy <= 3; dy++) for (let dx = -3; !rim && dx <= 3; dx++) rim = hair[(i + dy * W + dx) * 4 + 3] < 60;
      if (hair[i * 4 + 3] > 200 && !rim) {
        known[k] = 1;
        conf[k] = 1;
      } else if (want[i] && !hidden[i] && y + Y0 > SHOULDERS) todo[k] = 1;
    }
  // (not her earrings: jewels, gold and pearls were copied into her hair)
  const jewel = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (hair[i * 4 + 3] < 100) continue;
      const [hh, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      if (!((s > 0.35 && hh > 38 && hh < 330) || (s < 0.12 && v > 0.85 && earringsWhite))) continue;
      for (let dy = -14; dy <= 14; dy++)
        for (let dx = -14; dx <= 14; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) jewel[yy * w + xx] = 1;
        }
    }
  // the patches she can be filled from: wholly her own hair, from her chin down, every 2 px
  const sources = [];
  for (let y = r; y < h - r; y += 2)
    for (let x = r; x < w - r; x += 2) {
      if (y + Y0 < CHIN - 120) continue;
      let all = true;
      for (let dy = -r; all && dy <= r; dy++) for (let dx = -r; all && dx <= r; dx++) all = known[(y + dy) * w + x + dx] === 1 && !jewel[(y + dy) * w + x + dx];
      if (all) sources.push(y * w + x);
    }
  const lum = (k) => img[k * 3] * 0.3 + img[k * 3 + 1] * 0.59 + img[k * 3 + 2] * 0.11;
  const onFront = (k) => {
    if (!todo[k]) return false;
    const x = k % w;
    return (x > 0 && known[k - 1]) || (x < w - 1 && known[k + 1]) || (k >= w && known[k - w]) || (k < w * (h - 1) && known[k + w]);
  };
  const priority = (k) => {
    const x = k % w;
    const y = (k / w) | 0;
    if (x < r + 1 || y < r + 1 || x >= w - r - 1 || y >= h - r - 1) return -1;
    let c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) c += known[k + dy * w + dx] ? conf[k + dy * w + dx] : 0;
    c /= (2 * r + 1) ** 2;
    // the strand running into the hole: the light and shade across it (turned along it), against
    // the edge of the hole
    let gx = 0;
    let gy = 0;
    let best = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const q = k + dy * w + dx;
        if (!known[q] || !known[q - 1] || !known[q + 1] || !known[q - w] || !known[q + w]) continue;
        const ax = (lum(q + 1) - lum(q - 1)) / 2;
        const ay = (lum(q + w) - lum(q - w)) / 2;
        if (ax * ax + ay * ay > best) [best, gx, gy] = [ax * ax + ay * ay, ax, ay];
      }
    const nx = (known[k + 1] ? 1 : 0) - (known[k - 1] ? 1 : 0);
    const ny = (known[k + w] ? 1 : 0) - (known[k - w] ? 1 : 0);
    const nn = Math.hypot(nx, ny) || 1;
    const d = Math.abs(-gy * nx + gx * ny) / nn / 255;
    return c * (d + 0.01);
  };
  const front = new Set();
  const pri = new Map();
  for (let k = 0; k < w * h; k++) if (onFront(k)) front.add(k);
  for (const k of front) pri.set(k, priority(k));
  let steps = 0;
  while (front.size) {
    let p = -1;
    let pv = -2;
    for (const k of front) {
      const v = pri.get(k);
      if (v > pv) [p, pv] = [k, v];
    }
    if (pv < 0) {
      front.delete(p);
      todo[p] = 0;
      continue;
    }
    const px = p % w;
    const py = (p / w) | 0;
    // the patch of her hair most like what is round this place (only the hair already there)
    let bestS = -1;
    let bestD = Infinity;
    for (const s of sources) {
      const sx = s % w;
      const sy = (s / w) | 0;
      if (Math.abs(sx - px) > 110 || Math.abs(sy - py) > 150) continue;
      let dsum = 0;
      for (let dy = -r; dy <= r && dsum < bestD; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const q = p + dy * w + dx;
          if (!known[q]) continue;
          const o = s + dy * w + dx;
          for (let c = 0; c < 3; c++) {
            const e = img[q * 3 + c] - img[o * 3 + c];
            dsum += e * e;
          }
        }
      if (dsum < bestD) [bestD, bestS] = [dsum, s];
    }
    let cp = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) cp += known[p + dy * w + dx] ? conf[p + dy * w + dx] : 0;
    cp /= (2 * r + 1) ** 2;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const q = p + dy * w + dx;
        if (!todo[q] || known[q]) continue;
        const o = (bestS < 0 ? p : bestS) + dy * w + dx;
        for (let c = 0; c < 3; c++) img[q * 3 + c] = img[o * 3 + c];
        known[q] = 1;
        conf[q] = cp;
        todo[q] = 0;
        front.delete(q);
      }
    // the edge of the hole round what was filled, and its priorities, again
    for (let dy = -r - 3; dy <= r + 3; dy++)
      for (let dx = -r - 3; dx <= r + 3; dx++) {
        const q = p + dy * w + dx;
        if (q < 0 || q >= w * h) continue;
        if (onFront(q)) {
          front.add(q);
          pri.set(q, priority(q));
        } else front.delete(q);
      }
    steps++;
  }
  // her hair with what was filled; under the dresses and her face, the nearest hair, plainly
  const out = new Uint8ClampedArray(hair);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const i = at(x, y);
      if (!known[k] || (conf[k] === 1 && hair[i * 4 + 3] > 200)) continue;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = img[k * 3 + c];
      out[i * 4 + 3] = 255;
    }
  for (let pass = 0; pass < 60; pass++) {
    let grew = 0;
    const copy = new Uint8ClampedArray(out);
    for (let y = Y0 + 1; y < Y1 - 1; y++)
      for (let x = X0 + 1; x < X1 - 1; x++) {
        const i = y * W + x;
        if (!hidden[i] || !want[i] || copy[i * 4 + 3] > 200) continue;
        for (const j of [i - 1, i + 1, i - W, i + W])
          if (copy[j * 4 + 3] > 200) {
            for (let c = 0; c < 4; c++) out[i * 4 + c] = copy[j * 4 + c];
            grew++;
            break;
          }
      }
    if (!grew) break;
  }
  console.log('  hair carried on:', steps, 'patches');
  return out;
}

/** sRGB (0-255) to CIE Lab, and back. */
function toLab(r, g, b) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function fromLab(L, a, b) {
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;
  const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const [X, Y, Z] = [f(x) * 0.95047, f(y), f(z) * 1.08883];
  const g = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return [g(X * 3.2406 - Y * 1.5372 - Z * 0.4986), g(-X * 0.9689 + Y * 1.8758 + Z * 0.0415), g(X * 0.0557 - Y * 0.204 + Z * 1.057)];
}

/**
 * Her skin in another tone, changed as a whole and not darkened over: each pixel keeps how much
 * lighter or darker, redder or yellower it is than her skin, round the new skin colour (her
 * shine, shade and blush stay, as on a darker doll); only a little less light and shade on the
 * darkest tones. (Multiplied by the darker colour, as before, dark skin came out flat and muddy,
 * "pintada".)
 */
function retoned(img, o, mask, from, to) {
  const [Lf, af, bf] = toLab(...from);
  const [Lt, at, bt] = toLab(...to);
  if (Math.abs(Lf - Lt) < 0.5) return o;
  const kL = 0.55 + 0.45 * (Lt / Lf);
  const kC = 0.4 + 0.6 * (Lt / Lf);
  for (let i = 0; i < W * H; i++) {
    if ((mask && !mask[i]) || !img[i * 4 + 3]) continue;
    const [L, a, b] = toLab(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
    // (her blush softer on darker skin: as red as on light skin, it was a red spot)
    const rgb = fromLab(Lt + (L - Lf) * kL, at + (a - af) * kC, bt + (b - bf) * kC);
    for (let c = 0; c < 3; c++) o[i * 4 + c] = rgb[c];
  }
  return o;
}

function box(...imgs) {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const img of imgs)
    for (let i = 0; i < W * H; i++)
      if (img[i * 4 + 3] > 40) {
        const x = i % W;
        const y = (i / W) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** The eyes and the brows apart: the brows are what lies wholly above the middle of the eyes. */
/**
 * A mouth made a little girl's (Clara: "deixa as bocas mais infantis"; then her picture of the
 * blue princess, with a small soft pink smile): a little smaller, about the middle of its top
 * lip so it stays where it was, and its lips lighter and softer, not lipstick red (shrunk to
 * two thirds, as first done, it was a tiny pout far under her eyes).
 */
const CHILD = { x: 0.9, y: 0.9 };
function childlike(img) {
  const [bx, by, bw] = box(img);
  const small = scaleAbout(img, bx + bw / 2, by, CHILD.x, CHILD.y);
  for (let i = 0; i < W * H; i++) {
    if (small[i * 4 + 3] < 10) continue;
    const [h, s, v] = hsv(small[i * 4], small[i * 4 + 1], small[i * 4 + 2]);
    // the lips (red to pink, not the white of her teeth): lighter and less strong
    if (!(h >= 320 || h <= 20) || s < 0.25) continue;
    const k = 0.28;
    for (let c = 0; c < 3; c++) {
      const soft = [246, 160, 172][c];
      small[i * 4 + c] = small[i * 4 + c] * (1 - k) + soft * k * Math.min(1, v + 0.3);
    }
  }
  return small;
}

/** A picture made sx wider and sy taller about (cx, cy). */
function scaleAbout(img, cx, cy, sxk, syk) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = cx + (x - cx) / sxk, sy = cy + (y - cy) / syk;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
      const fx = sx - x0, fy = sy - y0;
      let a = 0;
      const acc = [0, 0, 0];
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const k = ((y0 + dy) * W + x0 + dx) * 4;
        const al = (img[k + 3] / 255) * wt;
        a += al;
        for (let c = 0; c < 3; c++) acc[c] += img[k + c] * al;
      }
      if (a <= 0) continue;
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = acc[c] / a;
      out[o + 3] = a * 255;
    }
  return out;
}

/**
 * The bun's picture has a second pair of ears drawn on it, low, under her own (Clara: "o hair
 * bun está com orelhas em baixo"), with the earrings hanging from them by her shoulders. Those
 * ears go, with the specks of their outline (taken out by colour alone, bits of skin and holes
 * were left), and the earrings are hung under her own ears, as in Clara's picture.
 */
const BUN_EARRINGS = [
  { bead: [357, 627], to: [349, 563] },
  { bead: [683, 627], to: [679, 563] },
];
function bunEars(hair) {
  const zone = (x, y) => y >= 460 && y <= 720 && ((x >= 290 && x <= 420) || (x >= 604 && x <= 734));
  const at = (x) => BUN_EARRINGS[x < W / 2 ? 0 : 1];
  // the earrings: the purple drop, the gold round it and the gold bead it hangs from
  const drop = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!zone(x, y) || hair[i * 4 + 3] < 60) continue;
    const [h, s] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
    if (h >= 220 && h <= 320 && s > 0.25) drop[i] = 1;
  }
  const earring = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!zone(x, y) || hair[i * 4 + 3] < 10) continue;
    const { bead: [bx, by] } = at(x);
    let near = Math.hypot(x - bx, y - by) <= 11 || (Math.abs(x - bx - 2) <= 5 && y >= by && y <= by + 16);
    for (let dy = -4; !near && dy <= 4; dy++) for (let dx = -4; !near && dx <= 4; dx++) near = drop[i + dy * W + dx] === 1;
    if (!near) continue;
    const [h, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
    // (the skin of the ear behind the bead stays behind)
    if (h <= 28 && s > 0.12 && s < 0.6 && v > 0.45 && !drop[i]) continue;
    for (let c = 0; c < 4; c++) earring[i * 4 + c] = hair[i * 4 + c];
    hair[i * 4 + 3] = 0;
  }
  // the ears: their skin, then the outline round where it was, then what is left in specks
  const gone = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!zone(x, y) || hair[i * 4 + 3] < 10) continue;
    const [h, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
    // (her hair round them is gold, hue 28-40; the ears are peach, 12-24)
    if ((h <= 25 || h >= 340) && s > 0.12 && v > 0.4) {
      hair[i * 4 + 3] = 0;
      gone[i] = 1;
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const more = [];
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      if (!zone(x, y) || hair[i * 4 + 3] < 1) continue;
      let by = false;
      for (let dy = -2; !by && dy <= 2; dy++) for (let dx = -2; !by && dx <= 2; dx++) by = gone[i + dy * W + dx] === 1;
      if (!by) continue;
      const [h, , v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      if (h <= 27 || v < 0.4 || hair[i * 4 + 3] < 140) more.push(i);
    }
    for (const i of more) {
      hair[i * 4 + 3] = 0;
      gone[i] = 1;
    }
  }
  const left = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (zone(i % W, (i / W) | 0) && hair[i * 4 + 3] > 10) left[i] = 1;
  const c = components(left);
  for (let i = 0; i < W * H; i++) if (left[i] && c.sizes[c.label[i]] < 120) hair[i * 4 + 3] = 0;
  // a soft edge where the hair was cut round them (it was left ragged)
  for (let pass = 0; pass < 2; pass++) {
    const alpha = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) alpha[i] = hair[i * 4 + 3];
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      if (!zone(x, y) || !alpha[i]) continue;
      let cut = false;
      for (let dy = -3; !cut && dy <= 3; dy++) for (let dx = -3; !cut && dx <= 3; dx++) cut = gone[i + dy * W + dx] === 1;
      if (!cut) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += alpha[i + dy * W + dx];
      hair[i * 4 + 3] = Math.min(alpha[i], sum / 9);
    }
  }
  // the earrings, hung under her own ears, in front of the hair
  for (let i = 0; i < W * H; i++) {
    const a = earring[i * 4 + 3] / 255;
    if (!a) continue;
    const x = i % W, y = (i / W) | 0;
    const { bead, to } = at(x);
    const j = (y + to[1] - bead[1]) * W + x + to[0] - bead[0];
    const b = hair[j * 4 + 3] / 255;
    const out = a + b * (1 - a);
    for (let k = 0; k < 3; k++) hair[j * 4 + k] = (earring[i * 4 + k] * a + hair[j * 4 + k] * b * (1 - a)) / out;
    hair[j * 4 + 3] = out * 255;
  }
}

/**
 * The long hair's white hearts, drawn on her ears beside her eyes: with the bigger eyes they
 * were over the corners of her eyes, so they go down onto her ear lobes, a little outwards.
 */
const LONG_HEARTS = [
  { box: [336, 474, 386, 526], by: [-26, 34] },
  { box: [618, 474, 664, 524], by: [26, 34] },
];
/** Moves the white (pearl, heart) pixels in a box of a hair picture, and their rim, by `by`. */
function moveStud(hair, { box: [x0, y0, x1, y1], by: [dx, dy] }) {
  const pick = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (hair[i * 4 + 3] < 10) continue;
      const [, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      // (and the gold of the little hook it hangs from, yellower than her brown hair)
      const h = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2])[0];
      if ((s < 0.3 && v > 0.55) || (h >= 32 && h <= 60 && s > 0.35 && v > 0.6)) pick[i] = 1;
    }
  const rim = new Uint8Array(pick);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (pick[i] || hair[i * 4 + 3] < 10) continue;
      if ([i - 1, i + 1, i - W, i + W].some((j) => pick[j])) rim[i] = 1;
    }
  const stud = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++)
    if (rim[i]) {
      for (let c = 0; c < 4; c++) stud[i * 4 + c] = hair[i * 4 + c];
      hair[i * 4 + 3] = 0;
    }
  for (let i = 0; i < W * H; i++) {
    const a = stud[i * 4 + 3] / 255;
    if (!a) continue;
    const j = i + dy * W + dx;
    const b = hair[j * 4 + 3] / 255;
    const out = a + b * (1 - a);
    for (let k = 0; k < 3; k++) hair[j * 4 + k] = (stud[i * 4 + k] * a + hair[j * 4 + k] * b * (1 - a)) / out;
    hair[j * 4 + 3] = out * 255;
  }
}

/**
 * Bigger irises (Clara's pink and blue princesses: the coloured part fills almost all the eye,
 * touching the lids; ours had white all round it and looked startled). Each iris, with its pupil
 * and shines, is drawn IRIS_GROW times bigger about its middle, only inside the eye: over the
 * white and the iris itself, never over the lids and lashes, which clip it as real lids do.
 */
const IRIS_GROW = 1.22;
function biggerIris(eyes) {
  const out = new Uint8ClampedArray(eyes);
  for (const side of [0, 1]) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < W * H; i++) {
      const x = i % W;
      if ((x < W / 2) !== (side === 0) || eyes[i * 4 + 3] < 200) continue;
      const [, s, v] = hsv(eyes[i * 4], eyes[i * 4 + 1], eyes[i * 4 + 2]);
      if (s > 0.3 && v > 0.3) {
        xs.push(x);
        ys.push((i / W) | 0);
      }
    }
    // a closed (winking) eye has no iris
    if (xs.length < 1500) continue;
    // its circle from its sides and its bottom (the lid hides its top)
    const at = (a, p) => a.slice().sort((m, n) => m - n)[Math.floor(a.length * p)];
    const r = (at(xs, 0.99) - at(xs, 0.01)) / 2;
    const cx = (at(xs, 0.99) + at(xs, 0.01)) / 2;
    const cy = at(ys, 0.99) - r;
    const R = r * IRIS_GROW;
    for (let y = Math.floor(cy - R); y <= cy + R; y++)
      for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > R) continue;
        const i = y * W + x;
        if (eyes[i * 4 + 3] < 200) continue;
        const [, s, v] = hsv(eyes[i * 4], eyes[i * 4 + 1], eyes[i * 4 + 2]);
        // (the white of the eye, or the iris itself; not a lid or a lash)
        // (its shaded edge too: bluish grey under the lid)
        if (!(d <= r || (s < 0.38 && v > 0.45))) continue;
        const sx = Math.round(cx + (x - cx) / IRIS_GROW);
        const sy = Math.round(cy + (y - cy) / IRIS_GROW);
        if (Math.hypot(sx - cx, sy - cy) > r) continue;
        const j = sy * W + sx;
        // a soft rim, so the iris's edge is not cut
        const a = Math.min(1, (R - d) / 3);
        for (let c = 0; c < 3; c++) out[i * 4 + c] = eyes[i * 4 + c] * (1 - a) + eyes[j * 4 + c] * a;
      }
  }
  return out;
}

function splitBrows(eyes, up) {
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = eyes[i * 4 + 3] > 20 ? 1 : 0;
  const c = components(solid);
  const low = new Array(c.sizes.length).fill(0);
  for (let i = 0; i < W * H; i++) if (solid[i]) low[c.label[i]] = Math.max(low[c.label[i]], (i / W) | 0);
  const brows = new Uint8ClampedArray(W * H * 4);
  const rest = new Uint8ClampedArray(eyes);
  for (let i = 0; i < W * H; i++)
    if (solid[i] && low[c.label[i]] < 452 - up && c.sizes[c.label[i]] > 80) {
      for (let k = 0; k < 4; k++) brows[i * 4 + k] = eyes[i * 4 + k];
      rest[i * 4 + 3] = 0;
    }
  return { brows, eyes: rest };
}

(async () => {
  const boxes = JSON.parse(fs.readFileSync(BOXES, 'utf8'));
  const faces = [];
  const loaded = [];
  for (const set of SETS) {
    const L = (n) => path.join(SRC, set.dir, `${n}.png`);
    // where this princess's chin, eyes and mouth were drawn (small canvas)
    const m = await measure(L);
    const up = FROM_REF ? { face: 0, eyes: 0, mouth: 0 } : {
      face: (m.chin - PLACE.chin) * SCALE,
      eyes: (m.eyes - PLACE.eyes - (NUDGE.eyes[set.eyes] ?? 0)) * SCALE,
      mouth: (m.mouth - PLACE.mouthTop - (NUDGE.mouth[set.mouth] ?? 0)) * SCALE,
    };
    const [nx, ny] = NOSE[set.dir];
    const noseAt = Math.round(ny - up.face);
    const face = await sheet(L('base_rosto'), up.face);
    const layers = {
      face: FROM_REF ? liftNose(face, NOSE_REF[set.dir], NOSE_UP, 22, 18) : blush(roundCheeks(liftNose(face, [nx, noseAt], Math.round(noseAt - toSheet(PLACE.nose))))),
      dress: await sheet(L('vestido')),
      dressSkin: FROM_REF ? await sheet(L('vestido_pele')) : null,
      // (a round head with no hair, for a princess with none chosen: cutref.cjs)
      backView: fs.existsSync(L('cabelo_costas')) ? await sheet(L('cabelo_costas')) : null,
      bald: fs.existsSync(L('base_careca')) ? liftNose(await sheet(L('base_careca')), NOSE_REF.bald, NOSE_UP, 22, 18) : null,
      hair: FROM_REF ? await sheet(L('cabelo_coroa')) : hairline(await sheet(L('cabelo_coroa'), up.face), HAIRLINE[set.hair]),
      eyes: await sheet(L('olhos'), up.eyes),
      mouth: await sheet(L('boca'), up.mouth),
      up,
    };
    console.log(set.dir.padEnd(20), 'chin', m.chin, 'eyes', m.eyes, 'mouth', m.mouth, '-> moved up (sheet px): face', Math.round(up.face), 'eyes', Math.round(up.eyes), 'nose', Math.round(noseAt - toSheet(PLACE.nose)), 'mouth', Math.round(up.mouth));
    layers.skin = skinOf(layers.face);
    faces.push(layers.skin);
    loaded.push([set, layers]);
  }
  // one light skin for all four, their average; the darker tones in the game's proportions
  const light = [0, 1, 2].map((c) => Math.round(faces.reduce((a, f) => a + f[c], 0) / faces.length));
  const tone = Object.fromEntries(Object.entries(TONES).map(([t, v]) => [t, v.map((x, c) => (light[c] * x) / TONES.light[c])]));
  console.log('light skin', light.join(','));

  const clear = new Uint8ClampedArray(W * H * 4);
  // FROM_REF: how wide the narrowest of the four dresses' necks is on each row (half, from the
  // middle; never narrower going down, and from where they all start, up to her chin)
  const neckHalf = new Float32Array(H);
  // (under every dress, or under every face: any face goes with any dress)
  const hiddenAll = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    let dress = true;
    let face = true;
    for (const [, layers] of loaded) {
      if (layers.dress[i * 4 + 3] < 220) dress = false;
      if (layers.face[i * 4 + 3] < 220) face = false;
    }
    hiddenAll[i] = dress || face ? 1 : 0;
  }
  if (FROM_REF) {
    neckHalf.fill(999);
    for (const [, layers] of loaded) {
      const a = layers.dressSkin;
      for (let y = 590; y < 660; y++) {
        let l = 0;
        let r = 0;
        while (l < 200 && a[(y * W + W / 2 - l - 1) * 4 + 3] > 100) l++;
        while (r < 200 && a[(y * W + W / 2 + r + 1) * 4 + 3] > 100) r++;
        neckHalf[y] = Math.min(neckHalf[y], Math.min(l, r) * 0.9);
      }
    }
    let first = 590;
    while (first < 660 && neckHalf[first] < 20) first++;
    for (let y = 590; y < first; y++) neckHalf[y] = neckHalf[first];
    for (let y = first + 1; y < 660; y++) neckHalf[y] = Math.max(neckHalf[y], neckHalf[y - 1]);
    console.log('neck half-width', Math.round(neckHalf[600]), 'to', Math.round(neckHalf[655]));
    for (const [set, layers] of loaded) {
      const [nx, ny] = NOSE_REF[set.dir];
      layers.face = neckOn(smoothFace(layers.face, layers.skin, [nx, ny - NOSE_UP]), neckHalf, layers.skin);
      if (layers.bald) layers.bald = neckOn(smoothFace(layers.bald, layers.skin, [NOSE_REF.bald[0], NOSE_REF.bald[1] - NOSE_UP], BALD_MID), neckHalf, layers.skin);
    }
  }
  for (const [set, layers] of loaded) {
    // (FROM_REF: the skin on her dress was found by cutref.cjs on her picture)
    const mask = layers.dressSkin ? layers.dressSkin.filter((_, k) => k % 4 === 3).map((a) => (a > 100 ? 1 : 0)) : skinMask(layers.dress, layers.skin);
    // one neck: the face comes with its neck down to her collarbone, and the dress with another
    // neck on top of it, whose top edge showed as a line under her chin. Where the face's neck is
    // under it, the dress's neck fades out towards her chin, so the neck runs on from her chin
    // into her chest
    const dress = new Uint8ClampedArray(layers.dress);
    // (cut from her picture, her dress has her own neck, laid over her face's: it stays whole)
    for (let y = FROM_REF ? NECK.to : NECK.from; y < NECK.to; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // (its skin, and its soft half-clear rim, which kept the light skin)
        if (!(mask[i] || layers.dress[i * 4 + 3] < 250) || layers.face[i * 4 + 3] < 60) continue;
        const t = Math.max(0, (y - NECK.fade) / (NECK.to - NECK.fade));
        dress[i * 4 + 3] = dress[i * 4 + 3] * t * t * (3 - 2 * t);
      }
    for (const t of Object.keys(TONES)) {
      // the face is all skin; on the dress only her skin is repainted
      const face = toned(layers.face, null, layers.skin, tone[t]);
      await write(`head-${set.hair}-${t}.webp`, face);
      if (set.hair === 'braids') await write(`head-${t}.webp`, layers.bald ? toned(layers.bald, null, layers.skin, tone[t]) : face);
      await write(`dress-${set.dress}-${t}.webp`, toned(dress, mask, layers.skin, tone[t]));
    }
    // the hair pictures have her ears drawn in, in the light skin. Her face has its own ears, in
    // the right skin, just under them: the skin-coloured pixels of the hair that lie over the
    // face's ears are taken out, so hers show. Only where her face is under them (taken out
    // anywhere else, brown and blonde hair the colour of skin was left with holes; repainted,
    // strands came out as dark spots).
    const ears = (x, y) => y >= 440 && y <= 610 && ((x >= 300 && x <= 405) || (x >= 619 && x <= 724));
    const [h0, s0, v0] = hsv(...layers.skin);
    const hair = new Uint8ClampedArray(layers.hair);
    for (let i = 0; !FROM_REF && i < W * H; i++) {
      if (hair[i * 4 + 3] < 10 || layers.face[i * 4 + 3] < 200 || !ears(i % W, (i / W) | 0)) continue;
      const [h, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      if (h < h0 - 14 || h > h0 + 8 || s < s0 * 0.35 || s > (h <= h0 - 2 ? 0.8 : s0 + 0.32) || v < v0 * 0.5) continue;
      const sure = Math.min(1, Math.max(0, (v - v0 * 0.5) / (v0 * 0.2)));
      hair[i * 4 + 3] = hair[i * 4 + 3] * (1 - sure);
    }
    if (!FROM_REF && set.hair === 'bun') bunEars(hair);
    if (!FROM_REF && set.hair === 'long') for (const s of LONG_HEARTS) moveStud(hair, s);
    // hair that falls below her chin goes behind her shoulders and dress, as in the dolls'
    // pictures (in front, long hair and curls hid her puff sleeves); a braid drapes in front
    const front = new Uint8ClampedArray(hair);
    const back = new Uint8ClampedArray(W * H * 4);
    // (long hair and curls: behind her, her own hair carried on where her sleeves and arms hid it,
    // as far as it hangs in her picture of her from behind)
    let behind = hair;
    if (layers.backView) {
      const want = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) want[i] = hair[i * 4 + 3] > 128 || layers.backView[i * 4 + 3] > 128 ? 1 : 0;
      // (one mass: on each row from her chin down, between the outer edges of her hair, and in each
      // column down to where her hair ends there; cut where her own sleeves and arms were, it kept
      // their shape, and between curls there were white specks)
      const bottom = new Int32Array(W).fill(-1);
      for (let y = SHOULDERS; y < H; y++) for (let x = 0; x < W; x++) if (want[y * W + x]) bottom[x] = y;
      // (the edges widen at most a pixel a row going down: where a curl stands out, the space
      // beside it filled at once came out with a flat top; her own hair keeps its own outline)
      const mass = new Uint8Array(want);
      let pl = -1;
      let pr = -1;
      for (let y = SHOULDERS; y < H; y++) {
        let l = -1;
        let r = -1;
        for (let x = 0; x < W; x++) if (mass[y * W + x]) [l, r] = [l < 0 ? x : l, x];
        if (l < 0) continue;
        if (pl >= 0) [l, r] = [Math.max(l, pl - 1), Math.min(r, pr + 1)];
        [pl, pr] = [l, r];
        for (let x = l; x <= r; x++) if (y <= bottom[x]) want[y * W + x] = 1;
      }
      behind = inpaintHair(hair, want, hiddenAll, set.hair === 'long');
    }
    if (HAIR_BEHIND[set.hair])
      for (let i = 0; i < W * H; i++) {
        const y = (i / W) | 0;
        // a soft change over 24 px, so there is no seam where it passes behind
        const k = Math.min(1, Math.max(0, (y - CHIN) / 24));
        if (!k) {
          if (y >= SHOULDERS && hair[i * 4 + 3] < 200 && behind[i * 4 + 3] > 200) for (let c = 0; c < 4; c++) back[i * 4 + c] = behind[i * 4 + c];
          continue;
        }
        for (let c = 0; c < 3; c++) back[i * 4 + c] = behind[i * 4 + c];
        // (whole behind, fading only in front: two half-clear layers over each other let the
        // page show through as a pale line)
        back[i * 4 + 3] = behind[i * 4 + 3];
        front[i * 4 + 3] = hair[i * 4 + 3] * (1 - k);
      }
    // no hair over her cheeks: below her eyes, whatever lies over the oval of her face goes
    // behind it (the long hair was drawn with locks over both cheeks, the opening for her face
    // only 50 px wide at her chin, and her face, eyes and mouth came out half hidden); her
    // ears and earrings are outside the oval and stay in front
    // (her own hair, cut from her picture, lies where it lay there)
    for (let y = FROM_REF ? H : FACE_OVAL.top; y < H; y++)
      for (let x = W / 2 - CHEEKS.hw - 2; x <= W / 2 + CHEEKS.hw + 2; x++) {
        const d = ((x - FACE_OVAL.cx) / FACE_OVAL.rx) ** 2 + ((y - FACE_OVAL.cy) / FACE_OVAL.ry) ** 2;
        const kOval = d > 1 ? 0 : Math.min(1, (1 - d) / 0.12) * Math.min(1, Math.max(0, (y - FACE_OVAL.top) / 16));
        const kFace = cheekBehind(x, y);
        if (!kOval && !kFace) continue;
        const i = y * W + x;
        if (!front[i * 4 + 3]) continue;
        // a pearl earring (white) stays in front
        const [, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
        if (s < 0.18 && v > 0.7) continue;
        // and so do the jewels of the earrings (green, blue, purple)
        const h = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2])[0];
        if (h >= 80 && h <= 320 && s > 0.3) continue;
        // (softly at the edge of the oval, and softly from her eyes down, so there is no line
        // across her face)
        const k = Math.max(kOval, kFace);
        for (let c = 0; c < 3; c++) back[i * 4 + c] = hair[i * 4 + c];
        back[i * 4 + 3] = Math.max(back[i * 4 + 3], hair[i * 4 + 3]);
        front[i * 4 + 3] = front[i * 4 + 3] * (1 - k);
      }
    await write(`hair-${set.hair}-front.webp`, front);
    // (and in each skin: her ears, in her hair, painted in it)
    if (FROM_REF) for (const t of Object.keys(TONES)) await write(`hair-${set.hair}-front-${t}.webp`, rimIn(earsIn(front, EARS[set.dir], layers.skin, tone[t]), layers.face, layers.skin, tone[t]));
    await write(`hair-${set.hair}-back.webp`, back);
    const split = splitBrows(dropSkin(layers.eyes, layers.skin), Math.round(layers.up.eyes));
    const eyeLine = toSheet(PLACE.eyes);
    const eyes = FROM_REF ? split.eyes : biggerIris(scaleAbout(split.eyes, W / 2, eyeLine, EYES_GROW, EYES_GROW));
    const brows = FROM_REF ? split.brows : scaleAbout(split.brows, W / 2, eyeLine + BROWS_UP / (EYES_GROW - 1), EYES_GROW, EYES_GROW);
    await write(`eyes-${set.eyes}.webp`, eyes);
    // (and in each skin: the skin left round her lashes and lids is painted in it too)
    for (const t of Object.keys(TONES)) await write(`eyes-${set.eyes}-${t}.webp`, skinBits(eyes, layers.skin, tone[t]));
    await write(`brows-${set.eyes}.webp`, brows);
    if (set.eyes === 'sparkly') await write('brows.webp', brows);
    const mouth = FROM_REF ? dropSkin(layers.mouth, layers.skin) : childlike(dropSkin(layers.mouth, layers.skin));
    await write(`mouth-${set.mouth}.webp`, mouth);
    for (const t of Object.keys(TONES)) await write(`mouth-${set.mouth}-${t}.webp`, skinBits(mouth, layers.skin, tone[t]));
    boxes[`hair:${set.hair}`] = box(layers.hair);
    boxes[`dress:${set.dress}`] = box(layers.dress);
    boxes[`eyes:${set.eyes}`] = box(eyes, brows);
    boxes[`mouth:${set.mouth}`] = box(mouth);
    let skinPx = 0;
    for (let i = 0; i < W * H; i++) skinPx += mask[i];
    console.log(set.dir.padEnd(20), 'skin', layers.skin.join(','), '| skin on the dress', skinPx, 'px');
  }
  fs.writeFileSync(BOXES, JSON.stringify(boxes, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

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

const SRC = path.join(__dirname, 'reference', 'v3');
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
const PLACE = { chin: 420, eyes: 318, nose: 345, mouthTop: 381 };
/**
 * Corrections for single pieces, after that (small-canvas pixels, + is lower): the purple eyes
 * are drawn bigger and lower in their frame and looked droopy beside the others.
 */
const NUDGE = { eyes: { sleepy: -8 }, mouth: {} };
/**
 * The oval of her face below her eyes, on the sheet: hair over it goes behind her face. Her
 * cheeks, not her ears (which stick out past it, with the earrings).
 */
const FACE_OVAL = { cx: 512, cy: 470, rx: 140, ry: 150 };
/** Where each princess's nose is on the sheet (measured on base_rosto), to lift it with the eyes. */
const NOSE = { '01_verde_ruiva': [516, 511], '02_rosa_castanha': [512, 527], '03_sereia_cacheada': [513, 532], '04_azul_loira': [511, 525] };

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
/** The hairstyles whose lower hair goes behind her; the braid drapes over her shoulder in front. */
const HAIR_BEHIND = { long: true, curly: true, bun: true, braids: false };

/**
 * Rosy cheeks, as the dolls have: a soft round flush on each cheek, below and outside the eyes.
 * It reddens the skin under it rather than painting pink on it, so it suits every skin tone.
 */
function blush(face, { y = 550, x = [408, 616], rx = 46, ry = 30, strength = 0.7 } = {}) {
  const o = new Uint8ClampedArray(face);
  const k = [1.0, 0.74, 0.78];
  for (const cx of x)
    for (let py = y - ry * 2; py <= y + ry * 2; py++)
      for (let px = cx - rx * 2; px <= cx + rx * 2; px++) {
        const i = (py * W + px) * 4;
        if (face[i + 3] < 200) continue;
        const d = ((px - cx) / rx) ** 2 + ((py - y) / ry) ** 2;
        const a = strength * Math.exp(-d * 1.6);
        if (a < 0.01) continue;
        for (let c = 0; c < 3; c++) o[i + c] = face[i + c] * (1 - a + a * k[c]);
      }
  return o;
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
    if (h >= h0 - 13 && h <= h0 + 6 && s >= s0 * 0.4 && s <= (h <= h0 - 2 ? 0.8 : s0 + 0.3) && v >= 0.3) near[i] = 1;
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
  const k = [0, 1, 2].map((c) => to[c] / from[c]);
  for (let i = 0; i < W * H; i++) if (!mask || mask[i]) for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * k[c];
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
    const up = {
      face: (m.chin - PLACE.chin) * SCALE,
      eyes: (m.eyes - PLACE.eyes - (NUDGE.eyes[set.eyes] ?? 0)) * SCALE,
      mouth: (m.mouth - PLACE.mouthTop - (NUDGE.mouth[set.mouth] ?? 0)) * SCALE,
    };
    const [nx, ny] = NOSE[set.dir];
    const noseAt = Math.round(ny - up.face);
    const face = await sheet(L('base_rosto'), up.face);
    const layers = {
      face: blush(liftNose(face, [nx, noseAt], Math.round(noseAt - toSheet(PLACE.nose)))),
      dress: await sheet(L('vestido')),
      hair: hairline(await sheet(L('cabelo_coroa'), up.face), HAIRLINE[set.hair]),
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
  for (const [set, layers] of loaded) {
    const mask = skinMask(layers.dress, layers.skin);
    // one neck: the face comes with its neck down to her collarbone, and the dress with another
    // neck on top of it, whose top edge showed as a line under her chin. Where the face's neck is
    // under it, the dress's neck fades out towards her chin, so the neck runs on from her chin
    // into her chest
    const dress = new Uint8ClampedArray(layers.dress);
    for (let y = NECK.from; y < NECK.to; y++)
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
      if (set.hair === 'braids') await write(`head-${t}.webp`, face);
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
    for (let i = 0; i < W * H; i++) {
      if (hair[i * 4 + 3] < 10 || layers.face[i * 4 + 3] < 200 || !ears(i % W, (i / W) | 0)) continue;
      const [h, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
      if (h < h0 - 14 || h > h0 + 8 || s < s0 * 0.35 || s > (h <= h0 - 2 ? 0.8 : s0 + 0.32) || v < v0 * 0.5) continue;
      const sure = Math.min(1, Math.max(0, (v - v0 * 0.5) / (v0 * 0.2)));
      hair[i * 4 + 3] = hair[i * 4 + 3] * (1 - sure);
    }
    // hair that falls below her chin goes behind her shoulders and dress, as in the dolls'
    // pictures (in front, long hair and curls hid her puff sleeves); a braid drapes in front
    const front = new Uint8ClampedArray(hair);
    const back = new Uint8ClampedArray(W * H * 4);
    if (HAIR_BEHIND[set.hair])
      for (let i = 0; i < W * H; i++) {
        const y = (i / W) | 0;
        // a soft change over 24 px, so there is no seam where it passes behind
        const k = Math.min(1, Math.max(0, (y - CHIN) / 24));
        if (!k) continue;
        for (let c = 0; c < 3; c++) back[i * 4 + c] = hair[i * 4 + c];
        // (whole behind, fading only in front: two half-clear layers over each other let the
        // page show through as a pale line)
        back[i * 4 + 3] = hair[i * 4 + 3];
        front[i * 4 + 3] = hair[i * 4 + 3] * (1 - k);
      }
    // no hair over her cheeks: below her eyes, whatever lies over the oval of her face goes
    // behind it (the long hair was drawn with locks over both cheeks, the opening for her face
    // only 50 px wide at her chin, and her face, eyes and mouth came out half hidden); her
    // ears and earrings are outside the oval and stay in front
    for (let y = FACE_OVAL.cy - 60; y < H; y++)
      for (let x = FACE_OVAL.cx - FACE_OVAL.rx; x <= FACE_OVAL.cx + FACE_OVAL.rx; x++) {
        const d = ((x - FACE_OVAL.cx) / FACE_OVAL.rx) ** 2 + ((y - FACE_OVAL.cy) / FACE_OVAL.ry) ** 2;
        if (d > 1) continue;
        const i = y * W + x;
        if (!front[i * 4 + 3]) continue;
        // a pearl earring (white) stays in front
        const [, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
        if (s < 0.18 && v > 0.7) continue;
        // softly at the edge of the oval
        // and softly from her eyes down, so there is no line across her face
        const k = Math.min(1, (1 - d) / 0.12) * Math.min(1, Math.max(0, (y - (FACE_OVAL.cy - 60)) / 60));
        for (let c = 0; c < 3; c++) back[i * 4 + c] = hair[i * 4 + c];
        back[i * 4 + 3] = Math.max(back[i * 4 + 3], hair[i * 4 + 3]);
        front[i * 4 + 3] = front[i * 4 + 3] * (1 - k);
      }
    await write(`hair-${set.hair}-front.webp`, front);
    await write(`hair-${set.hair}-back.webp`, back);
    const { eyes, brows } = splitBrows(dropSkin(layers.eyes, layers.skin), Math.round(layers.up.eyes));
    await write(`eyes-${set.eyes}.webp`, eyes);
    await write(`brows-${set.eyes}.webp`, brows);
    if (set.eyes === 'sparkly') await write('brows.webp', brows);
    await write(`mouth-${set.mouth}.webp`, dropSkin(layers.mouth, layers.skin));
    boxes[`hair:${set.hair}`] = box(layers.hair);
    boxes[`dress:${set.dress}`] = box(layers.dress);
    boxes[`eyes:${set.eyes}`] = box(layers.eyes);
    boxes[`mouth:${set.mouth}`] = box(layers.mouth);
    let skinPx = 0;
    for (let i = 0; i < W * H; i++) skinPx += mask[i];
    console.log(set.dir.padEnd(20), 'skin', layers.skin.join(','), '| skin on the dress', skinPx, 'px');
  }
  fs.writeFileSync(BOXES, JSON.stringify(boxes, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

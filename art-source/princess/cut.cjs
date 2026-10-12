/**
 * Cuts Clara's four princess pictures (art-source/princess/reference) into the pieces of the
 * princess game, as images, so every piece looks exactly like the picture it came from.
 *
 *   npm i --no-save sharp@0.33.5   (once: an image library this needs, not part of the site)
 *   node art-source/princess/cut.cjs [debug]
 *   node art-source/princess/cut.cjs align    (again, only if a picture changes: lines the faces up)
 *
 * The four pictures are drawn alike — the same girl, in the same pose — but not exactly in the
 * same place, so each one is first lined up with the pink one: by her face for the hair, by
 * her bodice for the dress (a search for the scale and shift that make the outlines match).
 *
 * Then each picture is split along its own outlines: every area closed by the dark outline (a
 * lock of hair, a sleeve, her face) is one region, and a region is hair, crown, skin, dress or
 * eyes by its colour and where it is. The outline itself goes with every region it borders, so
 * each piece keeps its whole outline wherever it is put. What a piece hides in its picture is
 * filled in: her face under the hair from a drawn face, a dress under a braid from the other
 * side of the same dress.
 *
 * Writes public/princess/*.png and, with "debug", art-source/princess/cut-debug/*.png.
 */
const path = require('path');
const fs = require('fs');
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(path.join(process.env.SHARP_DIR || '', 'sharp'));
}

const HERE = __dirname;
const REF = path.join(HERE, 'reference');
const OUT = path.join(HERE, '..', '..', 'public', 'princess');
const DEBUG = process.argv.includes('debug') ? path.join(HERE, 'cut-debug') : null;
const W = 1024;
const H = 1536;

/* ------------------------------------------------------------------ images as arrays */
async function load(name) {
  const { data } = await sharp(path.join(REF, name + '.webp')).ensureAlpha().resize(W, H).raw().toBuffer({ resolveWithObject: true });
  return data; // RGBA
}
async function save(file, rgba) {
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toFile(file);
}
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Samples a picture through a scale s about c and a shift t: out(p) = in((p - c) * s + c + t). */
function warp(src, s, tx, ty, bg) {
  const out = new Uint8ClampedArray(W * H * 4);
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x - cx) * s + cx + tx, sy = (y - cy) * s + cy + ty;
      const o = (y * W + x) * 4;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) {
        out[o] = bg[0]; out[o + 1] = bg[1]; out[o + 2] = bg[2]; out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0, fy = sy - y0;
      for (let k = 0; k < 4; k++) {
        const a = src[(y0 * W + x0) * 4 + k], b = src[(y0 * W + x0 + 1) * 4 + k];
        const c = src[((y0 + 1) * W + x0) * 4 + k], d = src[((y0 + 1) * W + x0 + 1) * 4 + k];
        out[o + k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      }
    }
  return out;
}

/** Where the outlines are: how dark each pixel is, at half size, for lining pictures up. */
function edges(d) {
  const w = W / 2, h = H / 2;
  const e = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) e[y * w + x] = lum(d, (y * 2 * W + x * 2) * 4) < 80 ? 1 : 0;
  return e;
}

/** The scale and shift that best line picture b's outlines up with a's, inside a box. */
function register(ea, eb, box) {
  const w = W / 2;
  const [x0, y0, x1, y1] = box.map((v) => Math.round(v / 2));
  const cx = W / 4, cy = H / 4;
  const cost = (s, tx, ty) => {
    let c = 0;
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2) {
        const sx = Math.round((x - cx) * s + cx + tx), sy = Math.round((y - cy) * s + cy + ty);
        const b = sx >= 0 && sy >= 0 && sx < w && sy < H / 2 ? eb[sy * w + sx] : 0;
        c += Math.abs(ea[y * w + x] - b);
      }
    return c;
  };
  let best = { c: Infinity };
  for (let s = 0.86; s <= 1.14; s += 0.02)
    for (let tx = -40; tx <= 40; tx += 4)
      for (let ty = -40; ty <= 40; ty += 4) {
        const c = cost(s, tx, ty);
        if (c < best.c) best = { c, s, tx, ty };
      }
  for (let s = best.s - 0.02; s <= best.s + 0.02; s += 0.004)
    for (let tx = best.tx - 4; tx <= best.tx + 4; tx += 1)
      for (let ty = best.ty - 4; ty <= best.ty + 4; ty += 1) {
        const c = cost(s, tx, ty);
        if (c < best.c) best = { c, s, tx, ty };
      }
  // back to full-size pixels
  return { s: best.s, tx: best.tx * 2, ty: best.ty * 2 };
}


/** Samples a picture so a point p of the pink picture is read at (p - a) * k + b of this one. */
function warpTo(src, k, a, b, bg) {
  // in warp()'s terms: (p - c) * k + c + t, with t = b - a * k - c * (1 - k)... spelled out here
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x - a[0]) * k + b[0], sy = (y - a[1]) * k + b[1];
      const o = (y * W + x) * 4;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) {
        out[o] = bg[0]; out[o + 1] = bg[1]; out[o + 2] = bg[2]; out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const p = src[(y0 * W + x0) * 4 + c], q = src[(y0 * W + x0 + 1) * 4 + c];
        const r = src[((y0 + 1) * W + x0) * 4 + c], s = src[((y0 + 1) * W + x0 + 1) * 4 + c];
        out[o + c] = (p * (1 - fx) + q * fx) * (1 - fy) + (r * (1 - fx) + s * fx) * fy;
      }
    }
  return out;
}

/* ---------------------------------------------------------------- what a colour is */
function hue(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h;
  if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
  else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
  else h = 60 * ((r - g) / (mx - mn) + 4);
  return h < 0 ? h + 360 : h;
}
// (g against r tells light red hair apart from skin: highlights in red hair are orange too)
const isSkin = (r, g, b) => r > 195 && g > 0.66 * r && g - b >= -8 && r - b > 25 && hue(r, g, b) <= 33;

/**
 * Each picture: its background, how her hair is told apart, and the landmarks that line its
 * dress up with the pink one's (the middle of the neckline, and how far apart the outsides of
 * the two sleeves are).
 */
const PICS = {
  pink: { bg: [255, 255, 255], neck: 703.6, span: 365.8, hair: (r, g, b, l, h) => !isSkin(r, g, b) && r < 215 && h >= 4 && h <= 36 && r - b > 35 && l < 165 },
  green: { bg: [0, 0, 0], bgTol: 30, neck: 681, span: 369.4, hairOver: [2], hairArea: [[596, 520, 800, 950]], mirrorFill: [[560, 560, 1024, 1536]], hairAreaColour: (r, g, b, h) => (r > 200 && g > 190 && b > 150) || (h >= 30 && h <= 60 && r > 190), hair: (r, g, b, l, h) => !isSkin(r, g, b) && (h <= 26 || h >= 350) && r > 95 && g < 125 && r - g > 45 },
  blue: { bg: [0, 0, 0], bgTol: 30, useBody: true, neck: 689.6, span: 363.7, body: [[200, 780, 420, 1060], [604, 780, 824, 1060]], hair: (r, g, b, l, h) => l < 120 && Math.max(r, g, b) - Math.min(r, g, b) < 40 },
  purple: {
    bg: [0, 0, 0], bgTol: 30, useBody: true, neck: 712, span: 341.4,
    // golden, its pale shine, and the honey-brown lines between its locks (not low on her face)
    hair: (r, g, b, l, h, x, y) =>
      !isSkin(r, g, b) &&
      ((h >= 28 && h <= 60 && r > 150 && b < 215) || (l > 205 && h >= 25 && h <= 65) || (l >= 60 && l < 150 && h >= 15 && h <= 45 && y < 680 && !(inFace(x, y) && y > 420))),
  },
};
const PINK = PICS.pink;
/** In the pink picture: where her eyes and mouth are, and where hair may be. */
const EYE_BOXES = [[362, 428, 492, 552], [532, 428, 662, 552]];
const MOUTH_BOX = [468, 548, 562, 594];
const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
/** Her eyes and brows, nose and mouth: never hair, whatever their colour. */
const FEATURES = [[378, 376, 456, 418], [568, 376, 646, 418], [356, 428, 494, 556], [530, 428, 668, 556], [470, 510, 556, 600]];
/** Her body: no hair there, except where a picture says so (the braid over her shoulder). */
const BODY = [[392, 682, 632, 1100], [318, 660, 442, 812], [582, 660, 706, 812]];
/** Her face, roughly: inside it, what is not hair is face. */
const inFace = (x, y) => ((x - 512) / 168) ** 2 + ((y - 470) / 168) ** 2 < 1 || (y > 470 && y < 636 && Math.abs(x - 512) < 168 - (y - 470) * 0.55);

/* --------------------------------------------------------------- splitting a picture */
const DARK = 72;
/**
 * Labels every pixel of a lined-up picture: 0 nothing, and bit flags for the pieces it goes
 * into (a pixel of outline may go into more than one).
 */
const L = { head: 1, eyes: 2, mouth: 4, hair: 8, dress: 16, skin: 32 };
/** How far into the dark outline each piece reaches from its own pixels. */
const REACH = { [L.head]: 10, [L.eyes]: 30, [L.mouth]: 10, [L.hair]: 12, [L.dress]: 10, [L.skin]: 10 };
const inInnerFace = (x, y) => ((x - 512) / 150) ** 2 + ((y - 478) / 160) ** 2 < 1;
function split(img, pic, part) {
  const n = W * H;
  const lab = new Uint8Array(n);
  const dark = new Uint8Array(n);
  const bgmask = new Uint8Array(n);
  // the background: everything of its colour that reaches the edge of the picture, and on a
  // black picture any pure black shut in by her hair
  const tol = pic.bgTol ?? 70;
  const near = (i) => img[i * 4 + 3] < 128 || Math.abs(img[i * 4] - pic.bg[0]) + Math.abs(img[i * 4 + 1] - pic.bg[1]) + Math.abs(img[i * 4 + 2] - pic.bg[2]) < tol;
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bgmask[i] || !near(i)) continue;
    bgmask[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  if (pic.bg[0] === 0) {
    const black = (i) => img[i * 4] + img[i * 4 + 1] + img[i * 4 + 2] < 24 && !bgmask[i];
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (seen[s] || !black(s)) continue;
      const blob = [s];
      seen[s] = 1;
      for (let k = 0; k < blob.length; k++) {
        const i = blob[k], x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
          if (j >= 0 && j < n && !seen[j] && black(j)) { seen[j] = 1; blob.push(j); }
      }
      if (blob.length > 600) for (const i of blob) bgmask[i] = 1;
    }
  }

  for (let i = 0; i < n; i++) {
    if (bgmask[i]) continue;
    const r = img[i * 4], g = img[i * 4 + 1], b = img[i * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const h = hue(r, g, b);
    const x = i % W, y = (i / W) | 0;
    // an outline is dark and brown or grey; a dark green, blue or purple is a dress's shadow
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const isDark = l < DARK && (h <= 50 || h >= 320 || mx - mn < 0.3 * mx);
    // her eyes are never hair (a brown iris is the colour of brown hair); her brows and the
    // line of her mouth are not either
    // (in the other pictures, only round her eyes: a lock beside an eye is still hair)
    const eyeBox = pic === PINK ? EYE_BOXES.some((bx) => inBox(x, y, bx)) : [427, 597].some((cx) => ((x - cx) / 70) ** 2 + ((y - 490) / 62) ** 2 < 1);
    const feature = eyeBox ||inBox(x, y, MOUTH_BOX) || (FEATURES.some((bx) => inBox(x, y, bx)) && isDark);
    const body = [...(pic.useBody ? BODY : []), ...(pic.body ?? [])].some((bx, k) => inBox(x, y, bx) && !(pic.hairOver ?? []).includes(k));
    if (y < 980 && !feature && !body && pic.hair(r, g, b, l, h, x, y)) { lab[i] = L.hair; continue; }
    if (!feature && (pic.hairArea ?? []).some((bx) => inBox(x, y, bx)) && !isSkin(r, g, b) && !isDark && pic.hairAreaColour(r, g, b, h)) { lab[i] = L.hair; continue; }
    if (isDark) { dark[i] = 1; continue; }
    if (EYE_BOXES.some((bx) => inBox(x, y, bx)) && !isSkin(r, g, b)) { lab[i] = L.eyes; continue; }
    if (inBox(x, y, MOUTH_BOX) && !isSkin(r, g, b)) { lab[i] = L.mouth; continue; }
    if (y < 260) { lab[i] = L.hair; continue; } // the crown
    // earrings hang by her ears
    if (y > 540 && y < 632 && (Math.abs(x - 342) < 28 || Math.abs(x - 682) < 28) && !isSkin(r, g, b)) { lab[i] = L.hair; continue; }
    if (isSkin(r, g, b)) {
      // her neck and the skin above the neckline are her head's, always: the head lies under
      // the dress, whose neckline covers it, so the skin there is one skin whatever she wears
      if (part === 'dress' && y < pic.neckAt + 60 && Math.abs(x - 512) < 190) continue;
      const neck = y < 780 && Math.abs(x - 512) < 190;
      lab[i] = (y < 640 || neck ? L.head : L.dress) | L.skin;
      continue;
    }
    if (inFace(x, y) && y > 300) { lab[i] = L.head | L.skin; continue; }
    if (y > 650 || (y > 596 && Math.abs(x - 512) > 86)) { lab[i] = L.dress; continue; }
  }

  // the outline goes with every piece it borders: each piece reaches into the dark outline
  // from its own pixels, as far as an outline is thick, so each keeps the whole of it
  const out = lab.slice();
  const dist = new Uint8Array(n);
  for (const bit of [L.head, L.eyes, L.mouth, L.hair, L.dress, L.skin]) {
    const reach = REACH[bit];
    let front = [];
    dist.fill(0);
    for (let i = 0; i < n; i++) if (lab[i] & bit) front.push(i);
    for (let d = 1; d <= reach && front.length; d++) {
      const next = [];
      for (const i of front) {
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= n || !dark[j] || bgmask[j] || dist[j] || out[j] & bit) continue;
          dist[j] = d;
          out[j] |= bit;
          next.push(j);
        }
      }
      front = next;
    }
  }
  for (let i = 0; i < n; i++) {
    if (!dark[i]) continue;
    const x = i % W, y = (i / W) | 0;
    // her lids and lashes are the eyes', the line of her smile is the mouth's
    if (EYE_BOXES.some((bx) => inBox(x, y, bx)) && out[i] & L.eyes) out[i] = L.eyes;
    else if (inBox(x, y, MOUTH_BOX)) out[i] = L.mouth;
    else if (!out[i] && inFace(x, y)) out[i] = L.head | L.skin;
  }
  return { lab: out, bg: bgmask };
}

/** The pixels of one piece, everything else clear. */
function pick(img, lab, flag) {
  const o = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++)
    if (lab[i] & flag) {
      o[i * 4] = img[i * 4]; o[i * 4 + 1] = img[i * 4 + 1]; o[i * 4 + 2] = img[i * 4 + 2]; o[i * 4 + 3] = 255;
    }
  return o;
}

/**
 * The line round her chin and cheeks: the dark within a line's width of her face's skin, low on
 * her face. Its brown is the colour of some hair, so split() may have called it hair; it is
 * her face's, and her face is in front of any hair behind it.
 */
function jawLine(img, lab) {
  const lum = (i) => 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2];
  const low = (i) => { const y = (i / W) | 0; return y > 540 && y < 680 && Math.abs((i % W) - 512) < 200; };
  const mask = new Uint8Array(W * H);
  const depth = new Uint8Array(W * H);
  let front = [];
  for (let i = 0; i < W * H; i++) if (lab[i] & L.head && lab[i] & L.skin && lum(i) >= 110 && low(i)) { depth[i] = 1; front.push(i); }
  for (let d = 1; d <= 9 && front.length; d++) {
    const next = [];
    for (const i of front) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || depth[j] || !low(j) || lum(j) >= 110) continue;
        depth[j] = d + 1;
        mask[j] = 1;
        next.push(j);
      }
    }
    front = next;
  }
  return mask;
}

module.exports = { load, save, warp, warpTo, edges, register, split, pick, PICS, L, W, H, isSkin, hue };

/* ------------------------------------------------- the two dresses made from a picture */
const INK = '#3B2314';
const GOLD = '#F6CF6E';
const svgOf = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
async function raster(body) {
  const { data } = await sharp(svgOf(body)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
}
/** a over b, both RGBA, a's alpha honoured */
function over(a, b) {
  const o = new Uint8ClampedArray(b);
  for (let i = 0; i < W * H; i++) {
    const al = a[i * 4 + 3] / 255;
    if (!al) continue;
    for (let c = 0; c < 3; c++) o[i * 4 + c] = a[i * 4 + c] * al + b[i * 4 + c] * (1 - al);
    o[i * 4 + 3] = Math.max(b[i * 4 + 3], a[i * 4 + 3]);
  }
  return o;
}
/** Clears every patch of the picture smaller than min pixels. */
function dropSpecks(img, min) {
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !img[s * 4 + 3]) continue;
    const blob = [s];
    seen[s] = 1;
    for (let k = 0; k < blob.length; k++) {
      const i = blob[k], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && !seen[j] && img[j * 4 + 3]) { seen[j] = 1; blob.push(j); }
    }
    if (blob.length < min) for (const i of blob) img[i * 4 + 3] = 0;
  }
  return img;
}

/** Grows a mask by r pixels, only onto pixels allowed. */
function grow(mask, r, allowed) {
  let front = [];
  for (let i = 0; i < W * H; i++) if (mask[i]) front.push(i);
  for (let d = 0; d < r && front.length; d++) {
    const next = [];
    for (const i of front) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && !mask[j] && allowed(j)) { mask[j] = 1; next.push(j); }
    }
    front = next;
  }
  return mask;
}
function flood(seeds, ok) {
  const m = new Uint8Array(W * H);
  const st = seeds.map(([x, y]) => y * W + x);
  while (st.length) {
    const i = st.pop();
    if (m[i] || !ok(i)) continue;
    m[i] = 1;
    const x = i % W;
    if (x > 0) st.push(i - 1);
    if (x < W - 1) st.push(i + 1);
    if (i >= W) st.push(i - W);
    if (i < W * (H - 1)) st.push(i + W);
  }
  return m;
}

/**
 * The mermaid dress, from the blue one: its bodice, sleeves, her arms and the first drapes she
 * holds stay; under them, instead of the ball gown, a blue tail with scales, a gold band and a
 * fin.
 */
const TAIL = 'M440 880 C420 930 384 980 380 1040 C378 1120 420 1190 446 1250 C456 1272 460 1290 456 1300 L568 1300 C564 1290 568 1272 578 1250 C604 1190 646 1120 644 1040 C640 980 604 930 584 880 Z';
const FIN = 'M456 1296 C420 1340 360 1390 296 1442 C330 1474 384 1488 432 1480 C462 1476 492 1462 512 1440 C532 1462 562 1476 592 1480 C640 1488 694 1474 728 1442 C664 1390 604 1340 568 1296 Z';
function tailSvg() {
  const scales = [];
  for (let row = 0, y = 900; y < 1300; y += 22, row++)
    for (let x = 360 + (row % 2) * 13; x < 670; x += 26) scales.push(`M${x - 13} ${y} Q${x} ${y + 15} ${x + 13} ${y}`);
  const ribs = [];
  for (let k = -5; k <= 5; k++) ribs.push(`M512 1320 L${512 + k * 42} ${1470 - Math.abs(k) * 8}`);
  return `
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1D3E9E"/><stop offset="0.45" stop-color="#3466DE"/><stop offset="1" stop-color="#1D3E9E"/></linearGradient>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FC0FF"/><stop offset="1" stop-color="#CFE6FF"/></linearGradient>
    <clipPath id="ct"><path d="${TAIL}"/></clipPath>
    <clipPath id="cf"><path d="${FIN}"/></clipPath>
  </defs>
  <path d="${FIN}" fill="url(#f)"/>
  <g clip-path="url(#cf)" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.85"><path d="${ribs.join(' ')}"/></g>
  <path d="M310 1440 C340 1466 388 1478 432 1472 C462 1468 492 1454 512 1432 C532 1454 562 1468 592 1472 C636 1478 684 1466 714 1440" fill="none" stroke="${GOLD}" stroke-width="7"/>
  <path d="${FIN}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="${TAIL}" fill="url(#t)"/>
  <g clip-path="url(#ct)" fill="none" stroke="#7FA6F5" stroke-width="3" stroke-linecap="round"><path d="${scales.join(' ')}"/></g>
  <path d="M420 960 C410 1040 430 1140 470 1240" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.35"/>
  <path d="${TAIL}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M448 1282 C480 1298 544 1298 576 1282 L580 1304 C548 1322 476 1322 444 1304 Z" fill="${GOLD}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="512" cy="1304" r="11" fill="#2F7BF0" stroke="${INK}" stroke-width="5"/>`;
}
async function mermaid(img, mask) {
  const isDarkBlue = (i) => img[i * 4 + 3] && img[i * 4 + 2] > 140 && img[i * 4] < 120 && img[i * 4 + 1] < 160;
  const tier = flood([[300, 990], [724, 990], [330, 1010], [694, 1010]], isDarkBlue);
  // the gold trim and the outline round the drapes go with them
  const near = grow(new Uint8Array(tier), 20, (j) => {
    const r = img[j * 4], g = img[j * 4 + 1], b = img[j * 4 + 2];
    return img[j * 4 + 3] && (hue(r, g, b) < 60 || r + g + b < 260) && !isDarkBlue(j);
  });
  const keep = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    if (y < 902 || tier[i] || near[i] || mask[i]) for (let c = 0; c < 4; c++) keep[i * 4 + c] = img[i * 4 + c];
  }
  return over(dropSpecks(keep, 1500), await raster(tailSvg()));
}

/**
 * The short dress, from the purple one: cut above her knees along a scalloped hem with a gold
 * trim and a little lace under it; her legs and her shoes show below.
 */
const HEM_Y = 1184;
const hemPoints = () => {
  const cusps = [];
  for (let x = 120; x <= 904; x += 784 / 8) cusps.push(x);
  return cusps;
};
const hemPath = (dy = 0) => {
  const c = hemPoints();
  let d = `M${c[0]} ${HEM_Y + dy}`;
  for (let k = 1; k < c.length; k++) d += ` Q${(c[k - 1] + c[k]) / 2} ${HEM_Y + 46 + dy} ${c[k]} ${HEM_Y + dy}`;
  return d;
};
const below = (x, y) => {
  // under the scalloped hem
  const c = hemPoints();
  for (let k = 1; k < c.length; k++)
    if (x >= c[k - 1] && x <= c[k]) {
      const t = (x - c[k - 1]) / (c[k] - c[k - 1]);
      const yy = HEM_Y + 2 * t * (1 - t) * 46;
      return y > yy;
    }
  return y > HEM_Y;
};
const LEG = 'M466 1150 C460 1260 458 1360 462 1444 L498 1444 C502 1360 502 1260 500 1150 Z';
const mirrorX = (d) => { let i = 0; return d.replace(/-?\d+(\.\d+)?/g, (n) => (i++ % 2 === 0 ? String(1024 - +n) : n)); };
function legsSvg(tone) {
  const [r, g, b] = TONES[tone];
  const skin = `rgb(${r},${g},${b})`;
  const shoe = (cx) => `<path d="M${cx - 34} 1458 C${cx - 34} 1436 ${cx + 34} 1436 ${cx + 34} 1458 C${cx + 34} 1476 ${cx - 34} 1476 ${cx - 34} 1458 Z" fill="#B48CF0" stroke="${INK}" stroke-width="6"/>
    <path d="M${cx - 12} 1442 L${cx} 1450 L${cx + 12} 1442 L${cx + 10} 1458 L${cx} 1452 L${cx - 10} 1458 Z" fill="${GOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<path d="${LEG}" fill="${skin}" stroke="${INK}" stroke-width="6"/><path d="${mirrorX(LEG)}" fill="${skin}" stroke="${INK}" stroke-width="6"/>${shoe(480)}${shoe(544)}`;
}
function hemSvg() {
  const c = hemPoints();
  const lace = c.slice(1).map((x, k) => `M${c[k]} ${HEM_Y + 14} Q${(c[k] + x) / 2} ${HEM_Y + 76} ${x} ${HEM_Y + 14}`).join(' ');
  return `<path d="${lace} Z" fill="#F4ECFF" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${hemPath()}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
    <path d="${hemPath()}" fill="none" stroke="${GOLD}" stroke-width="11" stroke-linecap="round"/>`;
}
async function short(img, mask, tone) {
  const cut = new Uint8ClampedArray(img);
  for (let i = 0; i < W * H; i++) if (below(i % W, (i / W) | 0) && !(mask[i] && i / W < 1100)) cut[i * 4 + 3] = 0;
  // the lace and the trim over the cut, then the cut dress over her legs
  const legs = await raster(legsSvg(tone));
  const lace = await raster(hemSvg());
  // lace sits under the dress but over the legs; the gold trim is on top of the dress's edge
  return over(await raster(hemSvg().split('\n').slice(1).join('\n')), over(cut, over(lace, legs)));
}

/* ------------------------------------------- eyes, mouths and powers made to match */
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  return [hue(r * 255, g * 255, b * 255), s, l];
}
function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
/** Her irises and pupils turned another colour; the white, the lid and the lashes stay. */
function recolour(img, h2, s2) {
  const o = new Uint8ClampedArray(img);
  for (let i = 0; i < W * H; i++) {
    if (!img[i * 4 + 3]) continue;
    const [h, s, l] = hsl(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
    if (s < 0.2 || l > 0.86 || h > 70) continue;
    const y = (i / W) | 0;
    if (y < 462) continue; // the lid and lashes above the iris keep their brown
    const [r, g, b] = rgb(h2, Math.max(s2, s * 0.9), l < 0.16 ? l * 1.15 : l);
    o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = b;
  }
  return o;
}
/** The round highlights painted over with the eye under them, for a different shine. */
function unshine(img, spots) {
  const o = new Uint8ClampedArray(img);
  for (const [cx, cy, r] of spots)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const i = y * W + x;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || !o[i * 4 + 3]) continue;
        if (o[i * 4] + o[i * 4 + 1] + o[i * 4 + 2] > 600) o[i * 4 + 3] = 0;
      }
  fillFrom(o, (x, y) => spots.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= (r + 1) ** 2));
  return o;
}
const SHINE = [[448, 481, 15], [577, 481, 15]];
const star4 = (x, y, s, fill = '#FFFFFF') =>
  `<path d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z" fill="${fill}"/>`;
const heart = (cx, cy, s, fill, stroke = '') => {
  const P = (x, y) => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return `<path d="M${P(0, 0.45)} C${P(-0.1, 0.35)} ${P(-0.55, 0.05)} ${P(-0.5, -0.2)} C${P(-0.45, -0.5)} ${P(-0.05, -0.5)} ${P(0, -0.22)} C${P(0.05, -0.5)} ${P(0.45, -0.5)} ${P(0.5, -0.2)} C${P(0.55, 0.05)} ${P(0.1, 0.35)} ${P(0, 0.45)} Z" fill="${fill}" ${stroke}/>`;
};

async function eyesVariants(eyes) {
  const plain = unshine(eyes, SHINE);
  // 2: blue, with stars shining in them
  const blue = over(await raster([star4(448, 482, 17), star4(577, 482, 17), star4(417, 526, 7), star4(608, 526, 7)].join('')), recolour(plain, 212, 0.72));
  // 3: green, and a wink: her right eye (on the right of the picture) shut in a happy curve
  const green = recolour(eyes, 138, 0.6);
  for (let i = 0; i < W * H; i++) if (i % W > 512) green[i * 4 + 3] = 0;
  const wink = await raster(`<path d="M544 512 Q589 470 636 510" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M630 503 L648 494 M622 494 L636 480 M612 487 L620 472" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`);
  // 4: purple, with hearts for a shine
  const purple = over(await raster([heart(447, 484, 30, '#FFFFFF'), heart(577, 484, 30, '#FFFFFF'), heart(416, 526, 12, '#FFD6EE'), heart(608, 526, 12, '#FFD6EE')].join('')), recolour(plain, 276, 0.6));
  return { 2: blue, 3: over(wink, green), 4: purple };
}

const MOUTH_COLOUR = '#B4553A';
async function mouths() {
  return {
    // 2: a big laugh, with teeth and a tongue
    2: await raster(`<path d="M480 554 Q514 562 548 554 Q546 596 514 600 Q482 596 480 554 Z" fill="#9C3434" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M486 559 Q514 566 542 559 L540 571 Q514 577 488 571 Z" fill="#FFFFFF"/>
      <path d="M494 590 Q514 576 534 590 Q526 598 514 598 Q502 598 494 590 Z" fill="#F2899B"/>`),
    // 3: "wow!": a little round mouth
    3: await raster(`<ellipse cx="514" cy="572" rx="14" ry="17" fill="#9C3434" stroke="${INK}" stroke-width="5"/>
      <path d="M504 582 Q514 574 524 582 Q520 588 514 588 Q508 588 504 582 Z" fill="#F2899B"/>`),
    // 4: silly, with her tongue out
    4: await raster(`<path d="M500 570 Q500 600 514 600 Q528 600 528 570 Z" fill="#F2899B" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M514 574 L514 592" stroke="#D85F74" stroke-width="3" stroke-linecap="round"/>
      <path d="M482 562 Q514 586 546 562" fill="none" stroke="${MOUTH_COLOUR}" stroke-width="6" stroke-linecap="round"/>`),
  };
}

/* ------------------------------------------------------------------------ powers */
const snowflake = (x, y, s, w = 5) => {
  const arms = [0, 60, 120].map((a) => {
    const c = Math.cos((a * Math.PI) / 180) * s, d = Math.sin((a * Math.PI) / 180) * s;
    return `M${x - c} ${y - d} L${x + c} ${y + d}`;
  });
  const twigs = [0, 60, 120, 180, 240, 300].map((a) => {
    const r = (a * Math.PI) / 180, px = x + Math.cos(r) * s * 0.6, py = y + Math.sin(r) * s * 0.6;
    const l1 = r + 0.7, l2 = r - 0.7, t = s * 0.28;
    return `M${px} ${py} L${px + Math.cos(l1) * t} ${py + Math.sin(l1) * t} M${px} ${py} L${px + Math.cos(l2) * t} ${py + Math.sin(l2) * t}`;
  });
  const d = [...arms, ...twigs].join(' ');
  return `<path d="${d}" fill="none" stroke="#3E7FD6" stroke-width="${w + 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${w}" stroke-linecap="round"/>`;
};
const flower = (x, y, s, petal, centre = '#FFD54A') =>
  [0, 72, 144, 216, 288]
    .map((a) => {
      const r = (a * Math.PI) / 180;
      return `<ellipse cx="${x + Math.cos(r) * s * 0.62}" cy="${y + Math.sin(r) * s * 0.62}" rx="${s * 0.5}" ry="${s * 0.5}" fill="${petal}" stroke="${INK}" stroke-width="5"/>`;
    })
    .join('') + `<circle cx="${x}" cy="${y}" r="${s * 0.38}" fill="${centre}" stroke="${INK}" stroke-width="5"/>`;
const leaf = (x, y, s, a) => `<path d="M${x} ${y} Q${x + s * 0.5} ${y - s * 0.6} ${x + s} ${y} Q${x + s * 0.5} ${y + s * 0.6} ${x} ${y} Z" transform="rotate(${a} ${x} ${y})" fill="#7CCB5B" stroke="${INK}" stroke-width="5"/>`;
async function powers() {
  return {
    // 1: she talks to animals: a bluebird singing on her shoulder, a bunny at her feet
    1: await raster(`
      <g transform="translate(-130 300) translate(360 630) scale(1.9) translate(-360 -630)" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M300 640 C300 606 330 590 356 600 C372 584 400 590 404 612 C424 618 430 636 418 648 C404 670 360 676 330 668 C312 664 300 654 300 640 Z" fill="#6EC3FF"/>
        <path d="M404 612 L430 604 L414 622 Z" fill="#FFB347"/>
        <path d="M330 640 C340 620 360 624 368 640 C358 652 340 654 330 640 Z" fill="#B9E4FF"/>
        <circle cx="384" cy="610" r="5" fill="${INK}" stroke="none"/>
        <path d="M300 642 L270 630 L282 652 Z" fill="#4AA3E8"/>
        <path d="M440 560 C436 540 456 532 464 548 M464 548 L464 584 M464 584 C452 576 440 584 446 594 C452 604 466 598 464 584" fill="none" stroke="#FF6FA8" stroke-width="6"/>
      </g>
      <g transform="translate(240 1430) scale(1.9) translate(-240 -1430) translate(-30 0)" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M188 1446 C178 1410 196 1388 216 1392 C214 1350 238 1336 246 1376 C254 1340 276 1350 270 1392 C292 1394 304 1420 292 1452 C284 1478 196 1478 188 1446 Z" fill="#FFFFFF"/>
        <path d="M228 1366 C226 1350 232 1344 236 1352 M258 1366 C262 1352 266 1350 266 1360" fill="none" stroke="#FFB3CF" stroke-width="5"/>
        <circle cx="228" cy="1420" r="5" fill="${INK}" stroke="none"/><circle cx="256" cy="1420" r="5" fill="${INK}" stroke="none"/>
        <path d="M238 1432 Q242 1438 246 1432" fill="none" stroke-width="4"/>
        <ellipse cx="216" cy="1434" rx="8" ry="5" fill="#FFB3CF" stroke="none"/><ellipse cx="268" cy="1434" rx="8" ry="5" fill="#FFB3CF" stroke="none"/>
      </g>
      ${heart(250, 1290, 40, '#FF6FA8', `stroke="${INK}" stroke-width="5"`)}
      <g transform="translate(830 520) rotate(-14)" stroke="${INK}" stroke-width="6" stroke-linejoin="round">
        <path d="M0 0 C-40 -60 -96 -50 -88 -6 C-82 22 -40 24 0 0 Z M0 0 C40 -60 96 -50 88 -6 C82 22 40 24 0 0 Z" fill="#FFB347"/>
        <path d="M0 4 C-30 30 -70 50 -58 70 C-46 86 -16 60 0 10 Z M0 4 C30 30 70 50 58 70 C46 86 16 60 0 10 Z" fill="#FF8FBF"/>
        <path d="M0 -14 L0 30" stroke-width="10"/><path d="M-4 -14 C-14 -40 -26 -50 -34 -50 M4 -14 C14 -40 26 -50 34 -50" fill="none" stroke-width="4"/>
      </g>`),
    // 2: snow: snowflakes swirling round her
    2: await raster(`
      <path d="M150 1030 C110 900 170 760 290 700 M874 1030 C914 900 854 760 734 700" fill="none" stroke="#BFE3FF" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/>
      ${snowflake(150, 880, 52, 7)}${snowflake(876, 840, 60, 7)}${snowflake(250, 690, 34, 5)}${snowflake(780, 660, 36, 5)}
      ${snowflake(110, 1150, 40, 6)}${snowflake(916, 1210, 46, 7)}${snowflake(300, 540, 24, 4)}${snowflake(730, 500, 26, 4)}
      ${star4(200, 1040, 14, '#E6F6FF')}${star4(830, 990, 16, '#E6F6FF')}${star4(140, 780, 10, '#E6F6FF')}${star4(900, 760, 12, '#E6F6FF')}`),
    // 3: space: a ringed planet, a moon and stars round her
    3: await raster(`
      <g stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
      </g>
      <g transform="translate(180 760) scale(1.45) translate(-180 -760)" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="180" cy="760" rx="96" ry="26" fill="none" stroke="#F6CF6E" stroke-width="14" transform="rotate(-18 180 760)"/>
        <circle cx="180" cy="760" r="58" fill="#9B7BFF"/>
        <path d="M134 742 C150 726 176 722 198 730 M128 774 C156 790 196 790 226 772" fill="none" stroke="#C9B6FF" stroke-width="6"/>
        <path d="M94 778 C130 796 220 786 268 744" fill="none" stroke="#F6CF6E" stroke-width="14"/>
      </g>
      <g transform="translate(860 745) scale(1.5) translate(-860 -745)" stroke="${INK}" stroke-width="5">
        <path d="M884 700 A60 60 0 1 0 900 790 A46 46 0 0 1 884 700 Z" fill="#FFE27A"/>
      </g>
      ${star4(120, 600, 18, '#FFE27A')}${star4(300, 560, 12, '#FFFFFF')}${star4(900, 560, 16, '#FFE27A')}${star4(760, 600, 10, '#FFFFFF')}
      ${star4(130, 1000, 14, '#FFE27A')}${star4(890, 1000, 18, '#FFE27A')}${star4(220, 920, 9, '#FFFFFF')}${star4(820, 900, 9, '#FFFFFF')}`),
    // 4: flowers: flowers growing round her feet and floating by her hands
    4: await raster(`
      ${leaf(150, 1476, 60, -40)}${leaf(860, 1476, 60, -140)}${leaf(220, 1490, 46, -70)}${leaf(800, 1490, 46, -110)}
      ${flower(140, 1420, 66, '#FF8FBF')}${flower(262, 1480, 50, '#FFD54A', '#FF8F5A')}${flower(882, 1420, 66, '#B48CF0')}${flower(760, 1480, 50, '#FF8FBF')}
      ${flower(160, 880, 44, '#FFB3D9')}${flower(864, 860, 44, '#FFD54A', '#FF8F5A')}${flower(110, 1070, 34, '#B48CF0')}${flower(914, 1060, 34, '#FF8FBF')}
      ${leaf(230, 940, 34, 20)}${leaf(800, 920, 34, 160)}`),
  };
}

/* --------------------------------------------------------------------- finishing */
/** The skin the child can pick, as how much each of red, green and blue is kept. */
const BASE_SKIN = [253, 197, 155];
const TONES = {
  light: [253, 197, 155],
  tan: [228, 160, 116],
  brown: [178, 114, 74],
  dark: [114, 70, 44],
};
function toned(img, mask, tone) {
  const o = new Uint8ClampedArray(img);
  const k = TONES[tone].map((v, c) => v / BASE_SKIN[c]);
  for (let i = 0; i < W * H; i++) if (mask[i]) for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * k[c];
  return o;
}

/** Fills the clear pixels of a region with the colour of the nearest filled pixel. */
function fillFrom(img, inside) {
  let front = [];
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (img[i * 4 + 3]) { seen[i] = 1; front.push(i); }
  while (front.length) {
    const next = [];
    for (const i of front) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j]) continue;
        const jx = j % W, jy = (j / W) | 0;
        if (!inside(jx, jy)) continue;
        seen[j] = 1;
        for (let c = 0; c < 4; c++) img[j * 4 + c] = img[i * 4 + c];
        next.push(j);
      }
    }
    front = next;
  }
}

/**
 * Makes a box of a piece the mirror of the other side of it: where a braid lay over the dress,
 * the dress under it (and the outlines the braid left on it) is replaced by the other side's.
 */
function mirrorFill(img, box) {
  for (let y = box[1]; y < box[3]; y++)
    for (let x = box[0]; x < box[2]; x++) {
      const i = y * W + x, m = y * W + (1023 - x);
      for (let c = 0; c < 4; c++) img[i * 4 + c] = img[m * 4 + c];
    }
}

async function write(file, img) {
  await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, file));
  if (DEBUG) await save(path.join(DEBUG, file.replace('.webp', '.png')), img);
}

/** Which of the cut pieces is which option, in card order: 1 the green, 2 the pink... */
const HAIRS = { green: 'braids', pink: 'long', blue: 'curly', purple: 'bun' };
const DRESSES = { green: 'gown', pink: 'aline', blue: 'mermaid', purple: 'star' };
const EYES = { 1: 'sparkly', 2: 'happy', 3: 'wink', 4: 'sleepy' };
const MOUTHS = { 1: 'smile', 2: 'laugh', 3: 'oh', 4: 'tongue' };
const POWERS = { 1: 'kitten', 2: 'wand', 3: 'scepter', 4: 'book' };
/** Each piece's box [x, y, width, height] in the 1024 by 1536 picture, for its card. */
const boxes = {};
function boxOf(...imgs) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const img of imgs)
    for (let i = 0; i < W * H; i++)
      if (img[i * 4 + 3] > 40) {
        const x = i % W, y = (i / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

if (require.main === module && process.argv.includes('align'))
  (async () => {
    // each picture's face lined up with the pink one's: the scale and shift that make the
    // outlines of the eyes, nose and mouth match (her hair is lined up by this)
    const pink = edges(await load('pink'));
    const T = {};
    for (const n of ['green', 'blue', 'purple']) T[n] = { head: register(pink, edges(await load(n)), [360, 380, 670, 600]) };
    fs.writeFileSync(path.join(REF, 'align.json'), JSON.stringify(T, null, 2));
    console.log(T);
  })();
else if (require.main === module)
  (async () => {
    const T = JSON.parse(fs.readFileSync(path.join(REF, 'align.json'), 'utf8'));
    fs.mkdirSync(OUT, { recursive: true });
    if (DEBUG) fs.mkdirSync(DEBUG, { recursive: true });
    for (const name of Object.keys(PICS)) {
      const pic = PICS[name];
      pic.neckAt = PINK.neck;
      const src = await load(name);
      // the hair: lined up by her face; the dress: by its neckline and sleeves
      const t = T[name]?.head;
      const headImg = t ? warp(src, t.s, t.tx, t.ty, pic.bg) : src;
      const k = pic.span / PINK.span;
      const dressImg = warpTo(src, k, [512, PINK.neck], [512, pic.neck], pic.bg);
      const head = split(headImg, pic, 'head');
      const dress = split(dressImg, pic, 'dress');

      // her hair in two layers: round her face, in front of it; down her back, behind her
      // arms and dress (but a braid over her shoulder stays in front)
      const front = (x, y) => y < 640 || (pic.hairArea ?? []).some((bx) => inBox(x, y, bx));
      const hair = pick(headImg, head.lab, L.hair);
      // the line of her jaw and cheeks is her face's: her face is in front of the hair behind it
      const jaw = jawLine(headImg, head.lab);
      for (let i = 0; i < W * H; i++) if (jaw[i]) hair[i * 4 + 3] = 0;
      const hairFront = new Uint8ClampedArray(hair), hairBack = new Uint8ClampedArray(hair);
      // the two layers overlap a little where they meet, so no seam shows between them
      for (let i = 0; i < W * H; i++) {
        const x = i % W, y = (i / W) | 0;
        if (!front(x, y - 10)) hairFront[i * 4 + 3] = 0;
        if (front(x, y + 10)) hairBack[i * 4 + 3] = 0;
      }
      const n = HAIRS[name];
      dropSpecks(hairBack, 300);
      dropSpecks(hairFront, 300);
      await write(`hair-${n}-back.webp`, hairBack);
      await write(`hair-${n}-front.webp`, hairFront);
      boxes[`hair:${n}`] = boxOf(hairBack, hairFront);

      // the dress, with her arms and hands; what her braid hid is the other side's mirror
      const dressImgOnly = pick(dressImg, dress.lab, L.dress);
      for (const bx of pic.mirrorFill ?? []) mirrorFill(dressImgOnly, bx);
      const skinMask = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) if (dress.lab[i] & L.skin && dress.lab[i] & L.dress) skinMask[i] = 1;
      // the mirrored part keeps its own skin flags
      for (const bx of pic.mirrorFill ?? [])
        for (let y = bx[1]; y < bx[3]; y++) for (let x = bx[0]; x < bx[2]; x++) skinMask[y * W + x] = skinMask[y * W + 1023 - x];
      // the blue one becomes the mermaid dress, the purple one the short dress
      const made = name === 'blue' ? await mermaid(dressImgOnly, skinMask) : dressImgOnly;
      for (const tone of Object.keys(TONES)) {
        let out = toned(made, skinMask, tone);
        if (name === 'purple') out = await short(out, skinMask, tone);
        await write(`dress-${DRESSES[name]}-${tone}.webp`, out);
        if (tone === 'light') boxes[`dress:${DRESSES[name]}`] = boxOf(out);
      }

      if (name === 'pink') {
        // her head: without the lines of the hair over her forehead, filled in under the hair
        // and under her eyes and mouth, so any hair and any eyes sit on a whole face
        const headOnly = pick(headImg, head.lab, L.head);
        for (let i = 0; i < W * H; i++) {
          const x = i % W, y = (i / W) | 0;
          const r = headImg[i * 4], g = headImg[i * 4 + 1], b = headImg[i * 4 + 2];
          const isDark = 0.299 * r + 0.587 * g + 0.114 * b < DARK;
          if (isDark && head.lab[i] & L.hair && y < 560 && !inBox(x, y, [566, 372, 650, 422])) headOnly[i * 4 + 3] = 0;
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          if (!isDark && PICS.pink.hair(r, g, b, l, hue(r, g, b)) && !EYE_BOXES.some((bx) => inBox(x, y, bx)) && !inBox(x, y, MOUTH_BOX)) headOnly[i * 4 + 3] = 0;
          // and the dark of her hair below her chin, where only her neck is hers
          if (isDark && head.lab[i] & L.hair && y >= 650 && !(head.lab[i] & L.skin)) headOnly[i * 4 + 3] = 0;
        }
        // the line round her chin is hers
        for (let i = 0; i < W * H; i++)
          if (jaw[i]) {
            for (let c = 0; c < 3; c++) headOnly[i * 4 + c] = headImg[i * 4 + c];
            headOnly[i * 4 + 3] = 255;
          }
        // and nothing of her face is filled in below it
        const chinAt = new Int32Array(W).fill(H);
        for (let i = 0; i < W * H; i++) {
          const x = i % W, y = (i / W) | 0;
          if (jaw[i] && y > 590 && y < chinAt[x]) chinAt[x] = y;
        }
        // a lock of the pink one's hair lies over her left brow: that brow is the right one's mirror
        const BROW_R = [566, 372, 650, 422];
        for (let y = BROW_R[1]; y < BROW_R[3]; y++)
          for (let x = 1024 - BROW_R[2]; x < 1024 - BROW_R[0]; x++) {
            const i = y * W + x, m = y * W + (1024 - x);
            for (let c = 0; c < 4; c++) headOnly[i * 4 + c] = headOnly[m * 4 + c];
          }
        // under her eyes and her mouth, plain skin: the colour of her face between her eyes
        const sample = [0, 0, 0];
        let count = 0;
        for (let y = 430; y < 470; y++)
          for (let x = 486; x < 538; x++) {
            const i = y * W + x;
            if (!headOnly[i * 4 + 3]) continue;
            for (let c = 0; c < 3; c++) sample[c] += headOnly[i * 4 + c];
            count++;
          }
        const plain = sample.map((v) => v / count);
        const under = (x, y) =>
          ((x - 427) / 72) ** 2 + ((y - 494) / 64) ** 2 < 1 || ((x - 597) / 72) ** 2 + ((y - 494) / 64) ** 2 < 1 || ((x - 514) / 44) ** 2 + ((y - 572) / 26) ** 2 < 1;
        const hole = [];
        for (let i = 0; i < W * H; i++) {
          const x = i % W, y = (i / W) | 0;
          if (!under(x, y)) continue;
          // keep her cheeks, which reach under her eyes
          const r = headOnly[i * 4], g = headOnly[i * 4 + 1], b = headOnly[i * 4 + 2];
          if (headOnly[i * 4 + 3] && isSkin(r, g, b) && hue(r, g, b) < 14) continue;
          headOnly[i * 4] = plain[0]; headOnly[i * 4 + 1] = plain[1]; headOnly[i * 4 + 2] = plain[2]; headOnly[i * 4 + 3] = 255;
          hole.push(i);
        }
        // then blended into the skin round it, so it carries on the face's shading
        const isHole = new Uint8Array(W * H);
        for (const i of hole) isHole[i] = 1;
        for (let it = 0; it < 500; it++)
          for (const i of hole) {
            let s0 = 0, s1 = 0, s2 = 0, k = 0;
            for (const j of [i - 1, i + 1, i - W, i + W]) {
              if (!headOnly[j * 4 + 3]) continue;
              s0 += headOnly[j * 4]; s1 += headOnly[j * 4 + 1]; s2 += headOnly[j * 4 + 2]; k++;
            }
            if (k) { headOnly[i * 4] = s0 / k; headOnly[i * 4 + 1] = s1 / k; headOnly[i * 4 + 2] = s2 / k; }
          }
        fillFrom(headOnly, (x, y) => inFace(x, y) && y < chinAt[x]);
        const all = new Uint8Array(W * H).fill(1);
        for (const tone of Object.keys(TONES)) await write(`head-${tone}.webp`, toned(headOnly, all, tone));
        const eyes = pick(headImg, head.lab, L.eyes);
        const mouth = pick(headImg, head.lab, L.mouth);
        const allEyes = { 1: eyes, ...(await eyesVariants(eyes)) };
        const allMouths = { 1: mouth, ...(await mouths()) };
        for (const [k, img] of Object.entries(allEyes)) { await write(`eyes-${EYES[k]}.webp`, img); boxes[`eyes:${EYES[k]}`] = boxOf(img); }
        for (const [k, img] of Object.entries(allMouths)) { await write(`mouth-${MOUTHS[k]}.webp`, img); boxes[`mouth:${MOUTHS[k]}`] = boxOf(img); }
        for (const [k, img] of Object.entries(await powers())) { await write(`power-${POWERS[k]}.webp`, img); boxes[`accessory:${POWERS[k]}`] = boxOf(img); }
      }
      console.log(name, 'done');
    }
    fs.writeFileSync(path.join(HERE, '..', '..', 'src', 'characters', 'princess', 'pieces.json'), JSON.stringify(boxes, null, 2));
  })();

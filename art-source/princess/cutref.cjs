/**
 * The flat princess cut straight from Clara's pictures of her four princesses, seen from the
 * front (reference/v2 and trellis/input): "faz direito", identical to them, chin, eyes and hair.
 *
 *   node art-source/princess/cutref.cjs        (needs sharp)
 *
 * Each picture is taken off its background, scaled and moved so her eyes and chin fall where the
 * game puts them, and cut into the five layers the game is built from, in the format of
 * reference/v3 (768 by 1152): base_rosto (her face, ears and neck, without eyes, brows or mouth,
 * on a plain skin dome under her hair), vestido (dress, arms, legs, shoes), cabelo_coroa (hair,
 * crown, earrings), olhos (eyes with brows) and boca (mouth). They are written to reference/v4,
 * and layers2d.cjs (with FROM_REF) turns them into the game's pictures without moving anything.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);

const REF = path.join(__dirname, 'reference');
const OUT = path.join(REF, 'v4');
const DEBUG = process.env.CUTREF_DEBUG;
/** The small canvas of the layers, and where her eyes (middle of the irises) and chin go on it. */
const W = 768;
const H = 1152;
const AT = { x: 384, eyes: 336, chin: 420 };

/**
 * The four pictures: the front view (a box of the picture; where the floor starts, if her skirt
 * shines on it), and where things are on it, measured by eye on a grid (pixels of the box): the
 * middle of each iris, the bottom of her chin, boxes round each eye (with its lashes), each brow
 * and her mouth. `hair` tells her hair from her dress below her chin.
 */
const PRINCESSES = [
  {
    dir: '01_verde_ruiva',
    file: 'v2/green-front.webp',
    eyes: [[480, 400], [622, 387]],
    chin: 522,
    // (her left brow is mostly under her hair: it is her right one, mirrored)
    mirrorBrow: true,
    // (her head leans: her eyes and mouth are turned upright, or they sat crooked on another face)
    level: true,
    // (her braid hides her left shoulder: it is her right one, mirrored about the jewel on her
    // bodice, from her shoulders to the cuffs of her sleeves)
    shoulder: { cx: 549, y0: 512, y1: 692 },
    // (her neck, as wide as this much of the space between her eyes, is not her hair: see p.neck)
    neck: 0.42,
    // (the checkerboard behind her shows between her arms and her waist)
    checker: true,
    // (hers is the face with no hair: a round head, with ears)
    bald: true,
    boxes: { eyes: [[412, 338, 520, 448], [575, 326, 690, 434]], brows: [[466, 304, 500, 325], [588, 288, 664, 313]], mouth: [512, 440, 592, 488] },
    hair: (h, s, v) => (h >= 340 || h <= 22) && s > 0.62 && v > 0.15,
  },
  {
    dir: '02_rosa_castanha',
    file: '../trellis/input/pink-turnaround.webp',
    box: [10, 0, 501, 1086],
    floor: 960,
    eyes: [[209, 326], [309, 328]],
    chin: 414,
    // (her left brow is half under her hair)
    mirrorBrow: true,
    // (her view from behind: x from, to, the middle of her tiara, and where her hair ends)
    back: { x0: 940, x1: 1420, cx: 1179, end: 760 },
    // (between her arms and her waist, her hair: it goes)
    gaps: [[176, 500, 245, 615], [295, 495, 365, 615]],
    boxes: { eyes: [[160, 284, 242, 360], [272, 286, 356, 360]], brows: [[198, 258, 222, 273], [293, 258, 338, 283]], mouth: [229, 359, 285, 396] },
    hair: (h, s, v) => (h <= 34 || h >= 350) && s > 0.45 && v < 0.64,
  },
  {
    dir: '03_sereia_cacheada',
    file: 'v2/mermaid-turnaround.webp',
    box: [32, 0, 506, 1086],
    floor: 980,
    // (her view from behind; not the dark red of her bodice under her curls)
    back: { x0: 940, x1: 1420, cx: 1179, end: 660, not: (h, s) => (h >= 330 || h <= 10) && s > 0.6 },
    // (between her arms and her waist, her curls: they go)
    gaps: [[150, 495, 198, 600], [285, 495, 335, 600], [360, 495, 410, 585]],
    // (her curls are dark, or grey where they shine: not the gold of her cuffs, which went too)
    gapTest: (h, s, v) => v < 0.3 || s < 0.25,
    eyes: [[169, 311], [289, 311]],
    chin: 400,
    // (kept off her curls: bits of them came with her eyes and brows)
    boxes: { eyes: [[136, 272, 208, 352], [244, 283, 338, 346]], brows: [[141, 242, 196, 268], [266, 244, 327, 268]], mouth: [210, 346, 245, 393] },
    hair: (h, s, v) => v < 0.32 || (h >= 15 && h <= 45 && s < 0.6 && v < 0.42),
  },
  {
    dir: '04_azul_loira',
    file: '../trellis/input/blue-turnaround.webp',
    box: [0, 0, 560, 1086],
    legs: true,
    // (her left brow is half under her hair)
    mirrorBrow: true,
    // (her skirt's right edge touches her side view: from x 498 down from her waist, it is her
    // skirt's left edge mirrored about her middle)
    mirror: { x: 498, y: 560, cx: 280 },
    eyes: [[227, 336], [333, 336]],
    chin: 426,
    // (kept off the edge of her face, whose dark rim came with her eyes)
    boxes: { eyes: [[176, 290, 260, 366], [300, 290, 386, 366]], brows: [[216, 253, 239, 271], [318, 253, 366, 280]], mouth: [247, 369, 311, 416] },
    // (her skin is as yellow as her hair, hue 26-29, but paler: s 0.31-0.43 against 0.55 and up)
    hair: (h, s, v) => h >= 18 && h <= 55 && s > 0.52 && v > 0.4,
  },
];

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

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The picture's pixels (RGB), its front view only. */
async function load(p) {
  let img = sharp(fs.readFileSync(path.join(REF, p.file))).removeAlpha();
  if (p.box) img = img.extract({ left: p.box[0], top: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1] });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (p.mirror)
    for (let y = 0; y < info.height; y++)
      for (let x = p.mirror.x; x < info.width; x++) {
        // (above her waist, the background: the bun of her side view was there)
        const sx = y < p.mirror.y ? -1 : 2 * p.mirror.cx - x;
        for (let c = 0; c < 3; c++) data[(y * info.width + x) * 3 + c] = sx >= 0 ? data[(y * info.width + sx) * 3 + c] : data[y * info.width * 3 + c];
      }
  return { d: data, w: info.width, h: info.height };
}

/**
 * Her, off the background: the background is grey or white (a checkerboard on the green one),
 * colourless and light, and reached from the edges of the picture; her outline is softened by
 * how far its colour is from the background next to it.
 */
function cutOut({ d, w, h }, floor) {
  const bg = new Uint8Array(w * h);
  const plain = (i) => {
    const [, s, v] = hsv(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
    return s < 0.07 && v > 0.55;
  };
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !plain(i)) continue;
    bg[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  // the shine of her skirt on the floor under her (pink): light and pale, below her hem,
  // reached from the bottom of the picture; the gold rim of her hem stops it
  if (floor) {
    const pale = (i) => {
      const [, s, v] = hsv(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
      // (and her grey shadow on it)
      return ((i / w) | 0) > floor && ((s < 0.25 && v > 0.7) || (s < 0.12 && v > 0.4));
    };
    for (let x = 0; x < w; x++) stack.push((h - 1) * w + x);
    for (let y = floor; y < h; y++) stack.push(y * w, y * w + w - 1);
    const seen = new Uint8Array(w * h);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      if (!bg[i] && !pale(i)) continue;
      bg[i] = 1;
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < w * (h - 1)) stack.push(i + w);
    }
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = d[i * 3 + c];
    rgba[i * 4 + 3] = bg[i] ? 0 : 255;
  }
  // a soft rim: a pixel of hers next to the background is as clear as it is close to it
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      let n = null;
      for (const j of [i - 1, i + 1, i - w, i + w]) if (bg[j]) n = j;
      if (n === null) continue;
      let dist = 0;
      for (let c = 0; c < 3; c++) dist += Math.abs(d[i * 3 + c] - d[n * 3 + c]);
      rgba[i * 4 + 3] = Math.min(255, Math.round((dist / 60) * 255));
    }
  return rgba;
}

/** Connected parts of a mask (4-neighbours): a label for each pixel and each part's size. */
function components(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    let top = 0;
    stack[top++] = s;
    label[s] = id;
    while (top) {
      const i = stack[--top];
      n++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && mask[j] && label[j] < 0) {
          label[j] = id;
          stack[top++] = j;
        }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/** The middle colour of the pixels in a box. */
function median(fig, w, [x0, y0, x1, y1]) {
  const vals = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (fig[(y * w + x) * 4 + 3] > 250) vals.push([0, 1, 2].map((c) => fig[(y * w + x) * 4 + c]));
  return [0, 1, 2].map((c) => vals.map((v) => v[c]).sort((a, b) => a - b)[vals.length >> 1]);
}

/**
 * Fills the pixels marked in `hole` from their rim inwards, each with the average of the known
 * pixels round it: skin grown over where her eyes, brows and mouth were.
 */
function fill(img, hole, w, h, good = () => true) {
  const known = new Uint8Array(w * h);
  let todo = [];
  for (let i = 0; i < w * h; i++) {
    if (hole[i]) todo.push(i);
    // (grown only from clean skin: from the shade by her hair it came in as dark smears)
    else known[i] = img[i * 4 + 3] > 200 && good(i) ? 1 : 0;
  }
  while (todo.length) {
    const rest = [];
    const done = [];
    for (const i of todo) {
      const x = i % w;
      const sum = [0, 0, 0];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * w + dx;
          if (x + dx < 0 || x + dx >= w || j < 0 || j >= w * h || !known[j]) continue;
          for (let c = 0; c < 3; c++) sum[c] += img[j * 4 + c];
          n++;
        }
      if (n >= 3) done.push([i, sum.map((v) => v / n)]);
      else rest.push(i);
    }
    if (!done.length) break;
    for (const [i, c] of done) {
      for (let k = 0; k < 3; k++) img[i * 4 + k] = c[k];
      img[i * 4 + 3] = 255;
      known[i] = 1;
    }
    todo = rest;
  }
  // a little blur over what was filled, so it is as smooth as skin
  for (let pass = 0; pass < 6; pass++) {
    const copy = new Uint8ClampedArray(img);
    for (let i = 0; i < w * h; i++) {
      if (!hole[i]) continue;
      const x = i % w;
      const sum = [0, 0, 0];
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = i + dy * w + dx;
          if (x + dx < 0 || x + dx >= w || j < 0 || j >= w * h || copy[j * 4 + 3] < 200) continue;
          for (let c = 0; c < 3; c++) sum[c] += copy[j * 4 + c];
          n++;
        }
      if (n) for (let c = 0; c < 3; c++) img[i * 4 + c] = sum[c] / n;
    }
  }
}

/**
 * Smooths what was filled as a stretched sheet: each filled pixel, again and again, becomes the
 * average of the four round it, the skin round the hole held as it is. No streaks or patches.
 */
function smoothIn(img, hole, w, h) {
  const list = [];
  for (let i = 0; i < w * h; i++) if (hole[i]) list.push(i);
  // (only from her skin: the clear pixels round her face are black, and averaged in they left
  // dark smears at her temples, where another princess's eyes did not cover them)
  for (let pass = 0; pass < 400; pass++)
    for (const i of list) {
      const sum = [0, 0, 0];
      let n = 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || img[j * 4 + 3] < 200) continue;
        for (let c = 0; c < 3; c++) sum[c] += img[j * 4 + c];
        n++;
      }
      if (n) for (let c = 0; c < 3; c++) img[i * 4 + c] = sum[c] / n;
    }
}

/** Cuts one picture into its five layers (pixels of the box). */
function cut(p, fig, w, h) {
  const [[lx, ly], [rx, ry]] = p.eyes;
  const eyeY = (ly + ry) / 2;
  const midX = (lx + rx) / 2;
  const D = p.chin - eyeY;
  const at = (x, y) => (y * w + x) * 4;
  const inBox = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const { eyes: eyeBoxes, brows: browBoxes, mouth: mouthBox } = p.boxes;
  const inCore = (x, y) =>
    [...eyeBoxes.map((b) => [b, 0.92]), ...browBoxes.map((b) => [b, 0.8]), [mouthBox, 0.8]].some(
      ([b, r]) => ((x - (b[0] + b[2]) / 2) / ((b[2] - b[0]) / 2)) ** 2 + ((y - (b[1] + b[3]) / 2) / ((b[3] - b[1]) / 2)) ** 2 < r,
    );
  const inAnyBoxAt = (x, y) => [...eyeBoxes, ...browBoxes, mouthBox].some((b) => inBox(b, x, y));

  // her skin, from her forehead above her brows
  const skin = median(fig, w, [Math.round(midX - 10), Math.round(eyeY - D * 0.85), Math.round(midX + 10), Math.round(eyeY - D * 0.7)]);
  const [h0, s0, v0] = hsv(...skin);
  const skinLike = (i) => {
    if (fig[i * 4 + 3] < 30) return false;
    const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
    // (blush and the shade under her chin are redder: allowed further to the red side)
    const dh = ((hh - h0 + 540) % 360) - 180;
    // (and not her hair: blonde is yellower, red and brown hair stronger or darker)
    // (lips and tongue are as red, but stronger: only a little redder may be stronger)
    const red = dh >= -16 || (dh >= -24 && s <= s0 + 0.08);
    return red && dh <= 5 && s >= s0 * 0.4 && s <= s0 + 0.35 && v >= v0 * 0.45 && !p.hair(hh, s, v);
  };

  const neckEnd = p.chin + D * 0.45;
  const spread = rx - lx;
  const inAnyBox = (x, y) => [...eyeBoxes, ...browBoxes, mouthBox].some((b) => inBox(b, x, y));
  const faceZone = (x, y) =>
    y < neckEnd &&
    // (wide enough for her ears: left with her hair, they kept the light skin on a dark face)
    (((x - midX) / (spread * 1.5)) ** 2 + ((y - (eyeY - D * 0.1)) / (D * 1.35)) ** 2 <= 1 || (y > eyeY && Math.abs(x - midX) < spread * 0.45));
  // eyes, brows and mouth: what in their boxes is not her skin (her skin in light or shade is the
  // face's, painted in the chosen skin; left half-clear on the eyes, it showed as a pale box; and
  // by how far its colour was from her skin, the shaded whites of her eyes stayed on her face)
  const feature = new Float32Array(w * h);
  const featureOf = new Int8Array(w * h).fill(-1); // 0 eyes and brows, 1 mouth
  for (const [k, list] of [[0, [...eyeBoxes, ...browBoxes]], [1, [mouthBox]]])
    for (const b of list)
      for (let y = b[1]; y <= b[3]; y++)
        for (let x = b[0]; x <= b[2]; x++) {
          const i = y * w + x;
          if (fig[i * 4 + 3] < 30 || skinLike(i)) continue;
          // (her hair reaching into a corner of the box is hair, not eye: carried with the eyes, it
          // showed as dark smudges on another princess)
          if (!inCore(x, y) && p.hair(...hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]))) continue;
          // (the pink of her lower lid and the top of her blush, under her eye, are skin: carried
          // with her eye, they showed as a shadow under it on another face)
          if (eyeBoxes.includes(b)) {
            const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
            const dh = ((hh - h0 + 540) % 360) - 180;
            const eyeAt = p.eyes[eyeBoxes.indexOf(b)][1];
            if (y > eyeAt + (b[3] - eyeAt) * 0.6 && dh >= -40 && dh <= 12 && s > 0.12 && s < 0.55 && v > 0.6) continue;
          }
          // softly towards the edge of the box, so no straight edge is cut (over 3 px for a brow:
          // over 8, her thin brows came out pale)
          const r = browBoxes.includes(b) ? 3 : 8;
          const a = Math.min(1, (x - b[0]) / r, (b[2] - x) / r, (y - b[1]) / r, (b[3] - y) / r);
          if (a > feature[i]) {
            feature[i] = a;
            featureOf[i] = k;
          }
        }

  // a soft edge (a pixel's own and its neighbours', averaged)
  {
    const copy = new Float32Array(feature);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (featureOf[i] < 0 && !inAnyBoxAt(x, y)) continue;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += copy[i + dy * w + dx];
        feature[i] = Math.min(copy[i] || 1, sum / 9);
        if (featureOf[i] < 0 && feature[i] > 0) featureOf[i] = inBox(mouthBox, x, y) ? 1 : 0;
      }
  }

  // her head's skin: the skin joined to her forehead, inside the oval round her face (with her
  // ears) and down to the middle of her neck, and all of the boxes of her eyes, brows and mouth
  // but hair (taken by colour alone, red hair and the shade of brown hair came in with it)
  const skinMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = (i / w) | 0;
    if (!faceZone(x, y) || fig[i * 4 + 3] < 30) continue;
    if (skinLike(i) || (feature[i] > 0 && (inCore(x, y) || !p.hair(...hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]))))) skinMask[i] = 1;
  }
  const c = components(skinMask, w, h);
  const seed = c.label[Math.round(eyeY - D * 0.78) * w + Math.round(midX)];
  const head = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (skinMask[i] && c.label[i] === seed) head[i] = 1;
  // and the holes in it (her eyes, mouth, the dark of her nostrils): pixels it closes round
  {
    const outside = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) outside[i] = head[i] ? 0 : 1;
    const o = components(outside, w, h);
    const border = new Set();
    for (let x = 0; x < w; x++) border.add(o.label[x]).add(o.label[(h - 1) * w + x]);
    for (let y = 0; y < h; y++) border.add(o.label[y * w]).add(o.label[y * w + w - 1]);
    for (let i = 0; i < w * h; i++)
      if (outside[i] && !border.has(o.label[i]) && o.sizes[o.label[i]] < D * D * 1.5 && ((i / w) | 0) > eyeY - D * 0.7) head[i] = 1;
  }

  // small bits inside her face that are not her skin (the white shine on her forehead, tips of
  // lashes and brows, a speck of a curl): they are her face, painted over with skin (left to the
  // hair, they showed as specks on her face beside another princess's eyes)
  const speck = new Uint8Array(w * h);
  {
    const loose = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (!head[i] && fig[i * 4 + 3] > 10 && faceZone(i % w, (i / w) | 0) && (i / w) < p.chin) loose[i] = 1;
    const lc = components(loose, w, h);
    const inside = new Uint8Array(lc.sizes.length).fill(1);
    for (let i = 0; i < w * h; i++) if (loose[i] && !faceZone((i % w) + 6, (i / w) | 0) | !faceZone((i % w) - 6, (i / w) | 0)) inside[lc.label[i]] = 0;
    for (let i = 0; i < w * h; i++)
      if (loose[i] && inside[lc.label[i]] && lc.sizes[lc.label[i]] < D * D * 0.08) {
        speck[i] = 1;
        head[i] = 1;
      }
  }
  const face = new Uint8ClampedArray(w * h * 4);
  const eyesL = new Uint8ClampedArray(w * h * 4);
  const mouthL = new Uint8ClampedArray(w * h * 4);
  const hole = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (feature[i] > 0) {
      const dst = featureOf[i] ? mouthL : eyesL;
      for (let k = 0; k < 3; k++) dst[i * 4 + k] = fig[i * 4 + k];
      dst[i * 4 + 3] = fig[i * 4 + 3] * feature[i];
    }
    if (!head[i]) continue;
    for (let k = 0; k < 4; k++) face[i * 4 + k] = fig[i * 4 + k];
    // her neck fades out just under her chin: her dress, laid over it, has her neck (a longer
    // one, of another princess, showed its straight sides beside the dress's on dark skin)
    face[i * 4 + 3] *= 1 - smooth(p.chin + D * 0.12, p.chin + D * 0.22, (i / w) | 0);
  }
  // under her eyes, brows and mouth: her skin, smoothed in from round them, over the whole oval
  // in each box (taken out only where they were not skin, rims of lashes and lips were left, and
  // grown in from those rims, they came back as smudges; another princess's eyes or mouth, of
  // another shape, showed them)
  for (const b of [...eyeBoxes, ...browBoxes, mouthBox]) {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    // (wider for her mouth: the dimples at the corners of a smile stayed on a face with none)
    const ax = (b[2] - b[0]) / 2 + (b === mouthBox ? D * 0.1 : 3);
    const ay = (b[3] - b[1]) / 2 + 3;
    for (let y = Math.floor(cy - ay); y <= cy + ay; y++)
      for (let x = Math.floor(cx - ax); x <= cx + ax; x++)
        if (((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 <= 1 && head[y * w + x]) hole[y * w + x] = 1;
    // (and the tips of lashes beyond the oval)
    // (and anything in the box, or just round it, that is on her face but not skin: curls
    // and lashes there were smeared into the skin grown over the hole)
    for (let y = b[1] - 10; y <= b[3] + 10; y++) for (let x = b[0] - 10; x <= b[2] + 10; x++) if (head[y * w + x] && (feature[y * w + x] > 0.05 || !skinLike(y * w + x) || hsv(fig[(y * w + x) * 4], fig[(y * w + x) * 4 + 1], fig[(y * w + x) * 4 + 2])[2] < v0 * 0.8)) hole[y * w + x] = 1;
  }
  // and the shade her own hair casts on her face, and stray bits of hair or brow: under another
  // princess's hair, of another shape, they showed as dark smears by her temples
  for (let i = 0; i < w * h; i++) {
    if (!head[i] || ((i / w) | 0) > p.chin - D * 0.3) continue;
    if (!skinLike(i) || hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2])[2] < v0 * 0.8) hole[i] = 1;
  }
  for (let i = 0; i < w * h; i++) if (speck[i]) hole[i] = 1;
  fill(face, hole, w, h, (i) => skinLike(i) && hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2])[2] > v0 * 0.8);
  smoothIn(face, hole, w, h);
  if (DEBUG) {
    const m = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      m[i * 4] = hole[i] ? 255 : 0;
      m[i * 4 + 1] = head[i] ? 200 : 0;
      m[i * 4 + 2] = feature[i] * 255;
      m[i * 4 + 3] = 255;
    }
    sharp(Buffer.from(m), { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(DEBUG, p.dir + '-masks.png'));
  }

  // hair, crown and earrings: whatever of her is above her chin and not her face; below it,
  // hair-coloured parts joined to that (with what they close round, as the flowers in a braid)
  const hairMask = new Uint8Array(w * h);
  const chinLine = p.chin + D * 0.05;
  for (let i = 0; i < w * h; i++) {
    if (fig[i * 4 + 3] < 10 || head[i]) continue;
    // (hair reaching into the boxes of her eyes and brows stays hair, out of the oval they lie
    // in: cut out, it left square holes in her hair under another princess's eyes)
    if (feature[i] > 0.5 && (inCore(i % w, (i / w) | 0) || !p.hair(...hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2])))) continue;
    if (((i / w) | 0) < chinLine) hairMask[i] = 1;
  }
  const hairy = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (fig[i * 4 + 3] < 10 || head[i]) continue;
    if (hairMask[i] || (((i / w) | 0) >= chinLine && !skinLike(i) && p.hair(...hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2])))) hairy[i] = 1;
  }
  const hc = components(hairy, w, h);
  const top = new Set();
  for (let i = 0; i < w * h; i++) if (hairMask[i]) top.add(hc.label[i]);
  for (let i = 0; i < w * h; i++) if (hairy[i] && top.has(hc.label[i]) && hc.sizes[hc.label[i]] > 50) hairMask[i] = 1;
  {
    // what the hair closes round, below her chin
    const not = new Uint8Array(w * h);
    // (not her skin: her neck and shoulders between her hair and her braid are her dress's skin)
    for (let i = 0; i < w * h; i++) not[i] = fig[i * 4 + 3] > 10 && !hairMask[i] && !head[i] && !skinLike(i) && ((i / w) | 0) >= chinLine ? 1 : 0;
    const nc = components(not, w, h);
    const touches = new Float32Array(nc.sizes.length);
    const rim = new Float32Array(nc.sizes.length);
    for (let i = 0; i < w * h; i++) {
      if (!not[i]) continue;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || not[j]) continue;
        rim[nc.label[i]]++;
        if (hairMask[j]) touches[nc.label[i]]++;
      }
    }
    for (let i = 0; i < w * h; i++) if (not[i] && nc.sizes[nc.label[i]] < D * D * 0.5 && touches[nc.label[i]] > rim[nc.label[i]] * 0.6) hairMask[i] = 1;
  }
  // her ears stay in her hair, which is drawn in front of her face, and are painted in the chosen
  // skin there (layers2d.cjs: EARS). (Moved to her face, ears half in and half out of the hair
  // came out patchy on dark skin, and her pearls, as pale, with them.)
  // the rim of her hair against her face is half skin: it goes with her face, to be painted in
  // her skin (left with the hair, it was a pale line round a darker face)
  {
    const near = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!head[i]) continue;
      const x = i % w;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) near[i + dy * w + dx] = 1;
    }
    for (let i = 0; i < w * h; i++) {
      // (not her pearls, as pale: they came out in pieces)
      if (!near[i] || head[i] || !hairMask[i] || fig[i * 4 + 3] < 10) continue;
      const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
      if (s < 0.12) continue;
      const dh = ((hh - h0 + 540) % 360) - 180;
      if (dh < -20 || dh > 8 || s > s0 + 0.2 || v < v0 * 0.6) continue;
      hairMask[i] = 0;
      for (let k = 0; k < 4; k++) face[i * 4 + k] = fig[i * 4 + k];
    }
  }
  // her neck under her chin, in the shade, is as red as red hair: it is her dress's neck, not
  // her hair (taken for hair, there was a gap under her chin, and light skin on a dark neck)
  if (p.neck)
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const y = (i / w) | 0;
      if (!hairMask[i] || head[i] || y < p.chin - D * 0.1 || y > p.chin + D * 0.7 || Math.abs(x - midX) > spread * p.neck) continue;
      const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
      const dh = ((hh - h0 + 540) % 360) - 180;
      if (dh >= -30 && dh <= 10 && s < 0.85 && v > 0.3) hairMask[i] = 0;
    }
  const hair = new Uint8ClampedArray(w * h * 4);
  const dress = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (fig[i * 4 + 3] < 1) continue;
    const y = (i / w) | 0;
    if (hairMask[i]) for (let k = 0; k < 4; k++) hair[i * 4 + k] = fig[i * 4 + k];
    else if (y >= p.chin - D * 0.1 && (!head[i] || y > p.chin)) for (let k = 0; k < 4; k++) dress[i * 4 + k] = fig[i * 4 + k];
  }
  // thin lines left of her hair's outline (an opening: worn away 3 px and grown back, they go),
  // and small bits held in her hair, as the flowers of a braid: those go to her hair
  {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = dress[i * 4 + 3] > 0 ? 1 : 0;
    const er = new Uint8Array(w * h);
    const R = 3;
    for (let y = R; y < h - R; y++)
      for (let x = R; x < w - R; x++) {
        let all = 1;
        for (let dy = -R; all && dy <= R; dy++) for (let dx = -R; all && dx <= R; dx++) if (!m[(y + dy) * w + x + dx]) all = 0;
        er[y * w + x] = all;
      }
    const op = new Uint8Array(w * h);
    for (let y = R; y < h - R; y++)
      for (let x = R; x < w - R; x++) {
        if (!er[y * w + x]) continue;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) op[(y + dy) * w + x + dx] = 1;
      }
    const c = components(op, w, h);
    let big = 0;
    for (let k = 1; k < c.sizes.length; k++) if (c.sizes[k] > c.sizes[big]) big = k;
    // (only bits touching her hair: her shadow on the floor went to her hair too, and showed
    // under another princess's dress)
    const byHair = new Uint8Array(c.sizes.length);
    for (let i = 0; i < w * h; i++) {
      if (!op[i] || c.label[i] === big) continue;
      for (let dy = -6; dy <= 6; dy += 3) for (let dx = -6; dx <= 6; dx += 3) if (hairMask[i + dy * w + dx]) byHair[c.label[i]] = 1;
    }
    for (let i = 0; i < w * h; i++) {
      if (!m[i]) continue;
      if (!op[i]) dress[i * 4 + 3] = 0;
      else if (c.label[i] !== big && c.sizes[c.label[i]] < D * D * 0.3) {
        if (byHair[c.label[i]]) for (let k = 0; k < 4; k++) hair[i * 4 + k] = dress[i * 4 + k];
        dress[i * 4 + 3] = 0;
      }
    }
  }
  // the soft rim of her hair against the background, pale and half clear, is not her dress (it
  // showed as a pale outline of her curls round another princess)
  {
    const nearHair = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!hairMask[i]) continue;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const j = i + dy * w + dx;
        if (j >= 0 && j < w * h) nearHair[j] = 1;
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (!nearHair[i] || dress[i * 4 + 3] === 0) continue;
      const [, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
      if (dress[i * 4 + 3] < 250 || (s < 0.2 && v > 0.6)) dress[i * 4 + 3] = 0;
    }
  }
  // bits of her hair seen between her arms and her waist, cut off from the rest of her hair by
  // her arms: they go (dark brown or black, against the background; not the dark red of a skirt)
  {
    const bit = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (dress[i * 4 + 3] < 10 || i / w > p.chin + D * 3) continue;
      const [hh, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
      if (p.hair(hh, s, v) && v < 0.3 && !skinLike(i) && ((hh >= 10 && hh <= 60) || s < 0.25)) bit[i] = 1;
    }
    const c = components(bit, w, h);
    const out = new Uint8Array(c.sizes.length);
    for (let i = 0; i < w * h; i++) if (bit[i]) for (const j of [i - 1, i + 1, i - w, i + w]) if (fig[j * 4 + 3] < 10 || dress[j * 4 + 3] === 0) out[c.label[i]] = 1;
    for (let i = 0; i < w * h; i++) {
      if (!bit[i] || !out[c.label[i]] || c.sizes[c.label[i]] < 30) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dress[(i + dy * w + dx) * 4 + 3] = 0;
    }
  }
  // and her hair between her arms and her waist, where it is not cut off from the rest
  for (const [x0, y0, x1, y1] of p.gaps ?? [])
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!dress[i * 4 + 3] || skinLike(i)) continue;
        const [hh, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
        // (and the brown of her hair mixed into the rim of her arm, and grey of the background)
        const gone = p.gapTest ? p.gapTest(hh, s, v) : (p.hair(hh, s, v) && (hh <= 60 || s < 0.3)) || (s < 0.3 && v < 0.65) || s < 0.12 || (hh >= 5 && hh <= 36 && s > 0.35 && v < 0.7);
        if (!gone) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dress[(i + dy * w + dx) * 4 + 3] = 0;
      }
  // the checkerboard of her picture, closed in between her arms and her waist: grey and white
  // with no colour at all (her satin's palest shine has a little green)
  if (p.checker) {
    const grey = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!dress[i * 4 + 3]) continue;
      const [, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
      if (s < 0.04 && v > 0.7) grey[i] = 1;
    }
    const g = components(grey, w, h);
    for (let i = 0; i < w * h; i++) {
      if (!grey[i] || g.sizes[g.label[i]] < 30) continue;
      // (and its rim, half her colour and half grey)
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) dress[(i + dy * w + dx) * 4 + 3] = 0;
    }
  }
  // her shoulder under her braid: the other side's, mirrored (only what was missing filled in,
  // the two halves met in steps); softly over the middle of her bodice and her cuffs
  if (p.shoulder) {
    const { cx, y0, y1 } = p.shoulder;
    for (let y = y0; y <= y1 + 8; y++)
      for (let x = cx - 4; x < w; x++) {
        const i = y * w + x;
        const j = y * w + Math.round(2 * cx - x);
        // (below her cuffs, only over what is there: her other arm is further out, and showed as
        // a pale ghost beside this one)
        if (y > y1 && dress[i * 4 + 3] < 200) {
          dress[i * 4 + 3] = 0;
          continue;
        }
        // (where the other side has nothing, as beside her neck, where her other lock of hair is,
        // what is here stays)
        if (dress[j * 4 + 3] < 10) continue;
        const k = smooth(cx - 4, cx + 4, x) * (1 - smooth(y1, y1 + 8, y));
        const a = dress[i * 4 + 3] * (1 - k) + dress[j * 4 + 3] * k;
        if (a > 0) for (let c = 0; c < 3; c++) dress[i * 4 + c] = (dress[i * 4 + c] * dress[i * 4 + 3] * (1 - k) + dress[j * 4 + c] * dress[j * 4 + 3] * k) / a;
        dress[i * 4 + 3] = a;
      }
  }

  let bald = null;
  if (p.bald) {
    // (upright, as her eyes and mouth are: mirrored as it leant, her cheeks did not meet)
    const a = p.level ? Math.atan2(ry - ly, rx - lx) : 0;
    const headImg = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) headImg[i * 4 + 3] = head[i] ? 255 : 0;
    const upright = rotate(face, w, h, midX, eyeY, a);
    const headUp = rotate(headImg, w, h, midX, eyeY, a).filter((_, k) => k % 4 === 3).map((v) => (v > 250 ? 1 : 0));
    bald = baldHead(upright, headUp, w, h, { midX, eyeY, D, chin: p.chin, skin });
  }

  // a plain skin dome under her hair, so the edge of her hair lies on skin
  const dome = { cx: midX, cy: eyeY - D * 0.2, rx: (rx - lx) * 1.35, ry: D * 1.75 };
  for (let y = 0; y < p.chin; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (face[i * 4 + 3] > 250) continue;
      if (((x - dome.cx) / dome.rx) ** 2 + ((y - dome.cy) / dome.ry) ** 2 > 1 || !hairMask[i]) continue;
      for (let k = 0; k < 3; k++) face[i * 4 + k] = skin[k];
      face[i * 4 + 3] = 255;
    }
  // the soft rim of her hair against the background of her picture is half that pale background:
  // over a neck or another dress it was a white line, and goes
  for (let i = 0; i < w * h; i++) {
    if (!hair[i * 4 + 3] || hair[i * 4 + 3] > 250) continue;
    const [, s, v] = hsv(hair[i * 4], hair[i * 4 + 1], hair[i * 4 + 2]);
    if (s < 0.2 && v > 0.65) hair[i * 4 + 3] = 0;
  }
  // the soft rim of her hair over her face, half skin, goes (the face under it is painted in the
  // chosen skin; left in the hair, which is the same for every skin, it was a light dotted line
  // round a dark face). Her ears stay in her hair and are painted there (layers2d.cjs): moved to
  // her face, ears half in and half out came out patchy, and her pearls with them
  {
    const near = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!head[i]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) near[i + dy * w + dx] = 1;
    }
    for (let i = 0; i < w * h; i++) {
      if (!hair[i * 4 + 3] || !near[i] || face[i * 4 + 3] < 250) continue;
      const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
      if (s < 0.12) continue;
      if (hair[i * 4 + 3] < 250 || (!p.hair(hh, s, v) && v > v0 * 0.8 && s < s0 + 0.1)) hair[i * 4 + 3] = 0;
    }
  }

  // specks round her eyes and brows, apart from them: bits of curls and of the edge of her face
  {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = eyesL[i * 4 + 3] > 40 ? 1 : 0;
    const c = components(m, w, h);
    const keep = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (m[i] && c.sizes[c.label[i]] >= D * D * 0.006) keep[i] = 1;
    // (with their soft rims: pixels near what is kept)
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        if (!eyesL[i * 4 + 3] || keep[i]) continue;
        let near = false;
        for (let dy = -2; !near && dy <= 2; dy++) for (let dx = -2; !near && dx <= 2; dx++) near = keep[i + dy * w + dx] === 1;
        if (!near) eyesL[i * 4 + 3] = 0;
      }
  }
  if (p.mirrorBrow) {
    const [L, R] = browBoxes;
    const dy = Math.round(ly - ry);
    for (let y = L[1] - 12; y <= L[3] + 12; y++) for (let x = L[0] - 30; x <= L[2] + 12; x++) eyesL[(y * w + x) * 4 + 3] = 0;
    for (let y = R[1]; y <= R[3]; y++)
      for (let x = R[0]; x <= R[2]; x++) {
        const s = (y * w + x) * 4;
        const d = ((y + dy) * w + Math.round(2 * midX - x)) * 4;
        for (let k = 0; k < 4; k++) eyesL[d + k] = eyesL[s + k];
      }
  }
  // her eyes and mouth turned upright about the middle of her eyes, if her head leans
  let eyesOut = eyesL;
  let mouthOut = mouthL;
  if (p.level) {
    const a = Math.atan2(ry - ly, rx - lx);
    eyesOut = rotate(eyesL, w, h, midX, eyeY, a);
    mouthOut = rotate(mouthL, w, h, midX, eyeY, a);
  }
  // where her dress layer is her skin (neck, chest, arms, hands, legs), for painting it in the
  // chosen tone: found here by her own skin's colour (found again on the dress alone, the shaded
  // neck under her chin and the shine on her shoulders were missed and stayed light)
  const dressSkin = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    // (on a long skirt, no skin below her hands: the mermaid's pink fin and gold in shade are
    // her skin's colour)
    if (dress[i * 4 + 3] < 10 || (i / w) > p.chin + D * (p.legs ? 99 : 2.7)) continue;
    const [hh, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
    const dh = ((hh - h0 + 540) % 360) - 180;
    // (gold in shade is close to skin from the yellow side: kept off it)
    if (dh < -24 || dh > 3 || s > 0.78 || s < s0 * 0.2 || v < 0.25) continue;
    for (let k = 0; k < 3; k++) dressSkin[i * 4 + k] = 255;
    dressSkin[i * 4 + 3] = dress[i * 4 + 3];
  }
  {
    // (only her skin in big patches: specks of the same colour in gold and satin stay)
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = dressSkin[i * 4 + 3] > 0 ? 1 : 0;
    const c = components(m, w, h);
    for (let i = 0; i < w * h; i++) if (m[i] && c.sizes[c.label[i]] < D * D * 0.15) dressSkin[i * 4 + 3] = 0;
  }
  {
    // (and the shine on her skin, too pale to tell by its colour: pale bits mostly closed round by
    // her skin, left light on dark skin as specks on her chest, shoulders and arms)
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = dressSkin[i * 4 + 3] > 0 ? 1 : 0;
    const pale = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (m[i] || dress[i * 4 + 3] < 10) continue;
      const [hh, s, v] = hsv(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
      const dh = ((hh - h0 + 540) % 360) - 180;
      if (v > 0.45 && (s < 0.15 || (dh >= -30 && dh <= 12 && s < 0.5))) pale[i] = 1;
    }
    const c = components(pale, w, h);
    const byskin = new Float32Array(c.sizes.length);
    const rim = new Float32Array(c.sizes.length);
    for (let i = 0; i < w * h; i++) {
      if (!pale[i]) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (pale[j]) continue;
        rim[c.label[i]]++;
        if (m[j]) byskin[c.label[i]]++;
      }
    }
    for (let i = 0; i < w * h; i++) {
      const k = c.label[i];
      if (!pale[i] || c.sizes[k] > D * D * 0.1 || byskin[k] < rim[k] * 0.6) continue;
      for (let q = 0; q < 3; q++) dressSkin[i * 4 + q] = 255;
      dressSkin[i * 4 + 3] = dress[i * 4 + 3];
    }
  }
  return { face, bald, dress, hair, eyes: eyesOut, mouth: mouthOut, dressSkin, eyeY, midX, D };
}

/** A picture turned by `a` (radians) about (cx, cy): each pixel read from where it was turned from. */
function rotate(img, w, h, cx, cy, a) {
  const out = new Uint8ClampedArray(w * h * 4);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = cx + (x - cx) * cos - (y - cy) * sin;
      const sy = cy + (x - cx) * sin + (y - cy) * cos;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      // (colours weighed by how solid each pixel is, so clear black pixels do not darken the rim)
      let al = 0;
      const col = [0, 0, 0];
      for (const [dx, dy, k] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const j = ((y0 + dy) * w + x0 + dx) * 4;
        const wa = img[j + 3] * k;
        al += wa;
        for (let c = 0; c < 3; c++) col[c] += img[j + c] * wa;
      }
      const i = (y * w + x) * 4;
      if (al > 0) for (let c = 0; c < 3; c++) out[i + c] = col[c] / al;
      out[i + 3] = al;
    }
  return out;
}

/**
 * Her head with no hair: round over the top, as wide as her cheeks are, the same on both sides
 * (one side of her face was under a lock of hair), its skin grown in from her face and shaded
 * towards its edge so it looks round, and a small ear on each side.
 */
function baldHead(face, head, w, h, { midX, eyeY, D, chin, skin }) {
  // how wide her face is on each row, below her eyes: the wider side, on both
  const half = new Float32Array(h);
  for (let y = Math.round(eyeY); y <= chin; y++) {
    let l = 0;
    let r = 0;
    for (let x = 0; x < w; x++) {
      if (!head[y * w + x] || face[(y * w + x) * 4 + 3] < 200) continue;
      l = Math.max(l, midX - x);
      r = Math.max(r, x - midX);
    }
    half[y] = Math.max(l, r);
  }
  // (smoothed, and never wider going down)
  for (let pass = 0; pass < 3; pass++)
    for (let y = Math.round(eyeY) + 1; y < chin; y++) half[y] = (half[y - 1] + half[y] + half[y + 1]) / 3;
  for (let y = Math.round(eyeY) + 1; y <= chin; y++) half[y] = Math.min(half[y], half[y - 1]);
  // over her eyes, an oval as wide as her face at her eyes
  const A = half[Math.round(eyeY)] * 1.02;
  const B = D * 1.3;
  const cy = eyeY;
  for (let y = 0; y < Math.round(eyeY); y++) {
    const t = (cy - y) / B;
    half[y] = t >= 1 ? 0 : A * Math.sqrt(1 - t * t);
  }
  const top = Math.ceil(cy - B);
  const out = new Uint8ClampedArray(w * h * 4);
  const known = new Uint8Array(w * h);
  const list = [];
  for (let y = top; y <= chin; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // (a soft edge, a pixel and a half wide)
      const a = Math.min(1, Math.max(0, (half[y] - Math.abs(x - midX) + 0.75) / 1.5));
      if (!a) continue;
      out[i * 4 + 3] = a * 255;
      const m = y * w + Math.round(2 * midX - x);
      // her own skin, or the other side's mirrored, or grown in
      // (only the middle of her face, from her brows down: towards its edges her face had the
      // shade of her hair on it, and a strand drawn across her forehead)
      const inner = y > eyeY - D * 0.4 && Math.abs(x - midX) < half[y] * 0.78;
      const from = !inner ? -1 : head[i] && face[i * 4 + 3] > 250 ? i : head[m] && face[m * 4 + 3] > 250 ? m : -1;
      if (from >= 0) {
        for (let c = 0; c < 3; c++) out[i * 4 + c] = face[from * 4 + c];
        known[i] = 1;
      } else list.push(i);
    }
  // grown in from her face first (started from one skin colour, the top of her head stayed
  // darker than her forehead, with a line between)
  {
    const tmp = new Uint8ClampedArray(out);
    const hole = new Uint8Array(w * h);
    for (const i of list) hole[i] = 1;
    for (let i = 0; i < w * h; i++) if (!known[i]) tmp[i * 4 + 3] = 0;
    fill(tmp, hole, w, h);
    for (const i of list) for (let c = 0; c < 3; c++) out[i * 4 + c] = tmp[i * 4 + c];
  }
  for (let pass = 0; pass < 600; pass++)
    for (const i of list) {
      const sum = [0, 0, 0];
      let n = 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (!out[j * 4 + 3]) continue;
        for (let c = 0; c < 3; c++) sum[c] += out[j * 4 + c];
        n++;
      }
      if (n) for (let c = 0; c < 3; c++) out[i * 4 + c] = sum[c] / n;
    }
  // round: darker towards the edge of the top of her head
  for (let y = top; y < eyeY + D * 0.1; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!out[i * 4 + 3]) continue;
      const r = Math.sqrt(((x - midX) / A) ** 2 + (Math.min(0, y - cy) / B) ** 2);
      const k = 1 - 0.14 * smooth(0.55, 1, r) * smooth(eyeY + D * 0.1, eyeY - D * 0.3, y);
      for (let c = 0; c < 3; c++) out[i * 4 + c] *= k;
    }
  // and towards the sides of her cheeks
  for (let y = Math.round(eyeY - D * 0.3); y <= chin; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!out[i * 4 + 3] || !half[y]) continue;
      const k = 1 - 0.1 * smooth(0.7, 1, Math.abs(x - midX) / half[y]) * smooth(eyeY - D * 0.3, eyeY + D * 0.1, y);
      for (let c = 0; c < 3; c++) out[i * 4 + c] *= k;
    }
  // her ears, behind her face at the height of her nose
  const ey = eyeY + D * 0.28;
  const erx = D * 0.15;
  const ery = D * 0.25;
  for (const side of [-1, 1]) {
    const ex = midX + side * (half[Math.round(ey)] + erx * 0.25);
    for (let y = Math.floor(ey - ery - 2); y <= ey + ery + 2; y++)
      for (let x = Math.floor(ex - erx - 2); x <= ex + erx + 2; x++) {
        const d = Math.sqrt(((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2);
        const a = Math.min(1, Math.max(0, (1 - d) * erx));
        const i = y * w + x;
        if (!a || out[i * 4 + 3] >= 255) continue;
        // the hollow of the ear, a little inwards, darker
        const hd = Math.sqrt(((x - ex + side * erx * 0.1) / (erx * 0.55)) ** 2 + ((y - ey) / (ery * 0.6)) ** 2);
        const k = 0.93 - 0.12 * (1 - smooth(0.5, 1, hd)) - 0.06 * smooth(0.7, 1, d);
        const under = out[i * 4 + 3] / 255;
        for (let c = 0; c < 3; c++) out[i * 4 + c] = out[i * 4 + c] * under + skin[c] * k * (1 - under);
        out[i * 4 + 3] = Math.max(out[i * 4 + 3], a * 255);
      }
  }
  return out;
}

/**
 * Her hair as it hangs down her back, from the view of her from behind in her picture: cut from
 * the background and from her dress and hands, turned round (seen through her, from the front) and
 * laid where her head is in the front view (the middle of her tiara on the middle of her eyes), from
 * her eyes down (fading in). Behind another dress, her hair then goes on down her back as in her
 * picture, wavy ends and all: the hair of the front view stops where her own dress and arms were
 * over it, and filled in, it was a painted patch (Clara: "serviço de preguiçoso").
 */
async function backHair(p, src, { eyeY, midX, D }) {
  const { x0, x1, cx, end, not } = p.back;
  const { data, info } = await sharp(fs.readFileSync(path.join(REF, p.file)))
    .removeAlpha()
    .extract({ left: x0, top: 0, width: x1 - x0, height: src.h })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bw = info.width;
  const view = cutOut({ d: data, w: bw, h: src.h });
  const w = src.w;
  const h = src.h;
  const out = new Uint8ClampedArray(w * h * 4);
  // (the front view's middle, in the picture: the box starts at p.box[0])
  const front = midX + (p.box ? p.box[0] : 0);
  for (let y = Math.round(eyeY); y < Math.min(h, end); y++)
    for (let x = 0; x < w; x++) {
      const bx = Math.round(cx - (x + (p.box ? p.box[0] : 0) - front)) - x0;
      if (bx < 0 || bx >= bw) continue;
      const j = (y * bw + bx) * 4;
      if (view[j + 3] < 10) continue;
      const [hh, s, v] = hsv(view[j], view[j + 1], view[j + 2]);
      if (!p.hair(hh, s, v) || (not && not(hh, s, v))) continue;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = view[j + c];
      // (fading in under her eyes, where it comes out from behind her head; and her ends soft)
      out[i + 3] = view[j + 3] * smooth(eyeY, eyeY + D * 0.4, y) * (1 - smooth(end - 12, end, y));
    }
  // only her hair, in one piece: not specks of her dress or hands of the same colour
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = out[i * 4 + 3] > 0 ? 1 : 0;
  const c = components(m, w, h);
  let big = 0;
  for (let k = 1; k < c.sizes.length; k++) if (c.sizes[k] > c.sizes[big]) big = k;
  for (let i = 0; i < w * h; i++) if (m[i] && c.label[i] !== big && c.sizes[c.label[i]] < D * D * 0.5) out[i * 4 + 3] = 0;
  return out;
}

/** A layer of the picture moved and scaled onto the small canvas: eyes on AT.eyes, chin on AT.chin. */
async function place(img, w, h, { eyeY, midX, D }) {
  const k = (AT.chin - AT.eyes) / D;
  const sw = Math.round(w * k);
  const sh = Math.round(h * k);
  const big = await sharp(Buffer.from(img), { raw: { width: w, height: h, channels: 4 } }).resize(sw, sh, { kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(AT.x - midX * k);
  const top = Math.round(AT.eyes - eyeY * k);
  // (cropped to the canvas first: sharp will not lay a picture past the edge)
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const cw = Math.min(sw - x0, W - Math.max(0, left));
  const ch = Math.min(sh - y0, H - Math.max(0, top));
  const part = await sharp(big).extract({ left: x0, top: y0, width: cw, height: ch }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();
}

(async () => {
  for (const p of PRINCESSES) {
    const src = await load(p);
    const fig = cutOut(src, p.floor);
    const layers = cut(p, fig, src.w, src.h);
    const dir = path.join(OUT, p.dir);
    fs.mkdirSync(dir, { recursive: true });
    const list = [['base_rosto', layers.face], ['vestido', layers.dress], ['vestido_pele', layers.dressSkin], ['cabelo_coroa', layers.hair], ['olhos', layers.eyes], ['boca', layers.mouth]];
    // (the head with no hair, for a princess with none chosen)
    if (layers.bald) list.push(['base_careca', layers.bald]);
    // (her hair seen from behind, to hang behind her)
    if (p.back) list.push(['cabelo_costas', await backHair(p, src, layers)]);
    for (const [name, img] of list) {
      const buf = await place(img, src.w, src.h, layers);
      fs.writeFileSync(path.join(dir, `${name}.png`), buf);
      if (DEBUG) fs.writeFileSync(path.join(DEBUG, `${p.dir}-${name}.png`), buf);
    }
    console.log(p.dir, 'scale', ((AT.chin - AT.eyes) / layers.D).toFixed(3));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

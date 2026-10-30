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
    boxes: { eyes: [[160, 284, 242, 360], [272, 286, 356, 360]], brows: [[198, 258, 222, 273], [293, 258, 338, 283]], mouth: [229, 359, 285, 396] },
    hair: (h, s, v) => (h <= 34 || h >= 350) && s > 0.45 && v < 0.64,
  },
  {
    dir: '03_sereia_cacheada',
    file: 'v2/mermaid-turnaround.webp',
    box: [32, 0, 506, 1086],
    floor: 980,
    eyes: [[169, 311], [289, 311]],
    chin: 400,
    boxes: { eyes: [[118, 270, 208, 350], [244, 283, 332, 338]], brows: [[132, 236, 189, 263], [266, 237, 322, 267]], mouth: [210, 346, 245, 393] },
    hair: (h, s, v) => v < 0.32 || (h >= 15 && h <= 45 && s < 0.6 && v < 0.42),
  },
  {
    dir: '04_azul_loira',
    file: '../trellis/input/blue-turnaround.webp',
    box: [0, 0, 560, 1086],
    legs: true,
    // (her skirt's right edge touches her side view: from x 498 down from her waist, it is her
    // skirt's left edge mirrored about her middle)
    mirror: { x: 498, y: 560, cx: 280 },
    eyes: [[227, 336], [333, 336]],
    chin: 426,
    boxes: { eyes: [[166, 288, 260, 366], [300, 288, 396, 366]], brows: [[216, 253, 239, 271], [318, 253, 370, 276]], mouth: [247, 369, 311, 416] },
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
          // softly towards the edge of the box, so no straight edge is cut
          const a = Math.min(1, (x - b[0]) / 8, (b[2] - x) / 8, (y - b[1]) / 8, (b[3] - y) / 8);
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
    // her neck fades out at its end, under the dress's (no line across it)
    // (her dress, laid over it, has the rest of her neck)
    face[i * 4 + 3] *= 1 - smooth(neckEnd - 4, neckEnd, (i / w) | 0);
  }
  // under her eyes, brows and mouth: her skin, smoothed in from round them, over the whole oval
  // in each box (taken out only where they were not skin, rims of lashes and lips were left, and
  // grown in from those rims, they came back as smudges; another princess's eyes or mouth, of
  // another shape, showed them)
  for (const b of [...eyeBoxes, ...browBoxes, mouthBox]) {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const ax = (b[2] - b[0]) / 2 + 3;
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
  // her ears: skin in her hair beside her face, joined to it (outside the oval of her face, they
  // stayed with her hair, half in the light skin)
  {
    const pale = (i) => {
      const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
      const dh = ((hh - h0 + 540) % 360) - 180;
      // (not her pearls: whiter)
      return dh >= -22 && dh <= 5 && s <= s0 + 0.15 && s >= s0 * 0.55 && v >= v0 * 0.55;
    };
    const band = (x, y) => y > eyeY - D * 0.15 && y < p.chin && Math.abs(x - midX) < spread * 1.75;
    let grow = [];
    for (let i = 0; i < w * h; i++) if (head[i]) grow.push(i);
    const seen = new Uint8Array(head);
    while (grow.length) {
      const next = [];
      for (const i of grow)
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (j < 0 || j >= w * h || seen[j]) continue;
          seen[j] = 1;
          if (!hairMask[j] || fig[j * 4 + 3] < 10 || !band(j % w, (j / w) | 0) || !pale(j)) continue;
          hairMask[j] = 0;
          for (let k = 0; k < 4; k++) face[j * 4 + k] = fig[j * 4 + k];
          next.push(j);
        }
      grow = next;
    }
    // (and ears a lock of hair cuts off from her face: big skin patches beside it)
    const ear = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const y = (i / w) | 0;
      if (hairMask[i] && fig[i * 4 + 3] > 10 && band(x, y) && Math.abs(x - midX) > spread * 0.8 && pale(i)) ear[i] = 1;
    }
    const ec = components(ear, w, h);
    for (let i = 0; i < w * h; i++)
      if (ear[i] && ec.sizes[ec.label[i]] > D * D * 0.02) {
        hairMask[i] = 0;
        for (let k = 0; k < 4; k++) face[i * 4 + k] = fig[i * 4 + k];
      }
  }
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
      if (!near[i] || head[i] || !hairMask[i] || fig[i * 4 + 3] < 10) continue;
      const [hh, s, v] = hsv(fig[i * 4], fig[i * 4 + 1], fig[i * 4 + 2]);
      const dh = ((hh - h0 + 540) % 360) - 180;
      if (dh < -20 || dh > 8 || s > s0 + 0.2 || v < v0 * 0.6) continue;
      hairMask[i] = 0;
      for (let k = 0; k < 4; k++) face[i * 4 + k] = fig[i * 4 + k];
    }
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
    for (let i = 0; i < w * h; i++) {
      if (!m[i]) continue;
      if (!op[i]) dress[i * 4 + 3] = 0;
      else if (c.label[i] !== big && c.sizes[c.label[i]] < D * D * 0.3) {
        for (let k = 0; k < 4; k++) hair[i * 4 + k] = dress[i * 4 + k];
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
  return { face, dress, hair, eyes: eyesL, mouth: mouthL, dressSkin, eyeY, midX, D };
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
    for (const [name, img] of [['base_rosto', layers.face], ['vestido', layers.dress], ['vestido_pele', layers.dressSkin], ['cabelo_coroa', layers.hair], ['olhos', layers.eyes], ['boca', layers.mouth]]) {
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

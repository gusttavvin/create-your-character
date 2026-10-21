/**
 * The princesses as Clara's doll pictures (13 October 2026): she sent each princess drawn as
 * a glossy doll from the front, the side and the back (reference/v2/<name>-turnaround.webp;
 * the green one as reference/v2/green-front.webp and green-turnaround.webp) and asked for the
 * game to be identical to them, in 2D and 3D.
 *
 * This takes each view out of its picture (a grey studio background, a gradient with a floor
 * shadow) and lines it up with the game's 1024 by 1536 canvas: her eyes on the line the
 * shared head's eyes are on (y 492, between them at x 512) and her chin where its chin is
 * (y 633), so every princess is the same size and her pieces fit any other's.
 *
 *   node art-source/princess/dolls.cjs [debug folder]     (needs sharp, like cut.cjs)
 */
const path = require('path');
const sharp = require('sharp');

const REF = path.join(__dirname, 'reference', 'v2');
const W = 1024;
const H = 1536;
/** On the canvas: the middle between her eyes, and her chin. */
const EYES_AT = [512, 492];
const CHIN_AT = 633;

/**
 * Each princess's picture and, for each view, its columns in the picture; and for the front
 * view the middle between her eyes and her chin, measured on the picture (for the mermaid,
 * who winks, the middle of her face is the middle of her mouth).
 */
const DOLLS = {
  pink: { file: 'pink-turnaround.webp', front: [0, 510], side: [510, 935], back: [935, 1448], eyes: [266.5, 319.3], chin: 413, maxScale: 1.4 },
  mermaid: { file: 'mermaid-turnaround.webp', front: [0, 503], side: [503, 935], back: [935, 1448], eyes: [267.8, 304.3], chin: 407 },
  blue: { file: 'blue-turnaround.webp', front: [0, 534], side: [534, 908], back: [908, 1448], eyes: [279.2, 325.7], chin: 425 },
};

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = 60 * (((g - b) / d) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s, l];
}

/**
 * One view out of its picture: RGBA, the background clear, her edge soft and in her own colours
 * (its pixels were mixed with the grey behind her). The background is a light grey, a little
 * lighter or darker from place to place, reached from the edge of the view; and the same grey
 * shut in by her (between an arm and her dress, between curls).
 */
async function cutView(file, [x0, x1]) {
  const { data, info } = await sharp(path.join(REF, file)).raw().toBuffer({ resolveWithObject: true });
  const tw = info.width, th = info.height, c = info.channels;
  const w = x1 - x0, h = th, n = w * h;
  const px = (i) => { const k = (((i / w) | 0) * tw + (i % w) + x0) * c; return [data[k], data[k + 1], data[k + 2]]; };
  const grey = (i, tol = 20, lo = 135) => { const [r, g, b] = px(i); return Math.max(r, g, b) - Math.min(r, g, b) <= tol && Math.min(r, g, b) >= lo; };
  const bg = new Uint8Array(n);
  const st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const i = st.pop();
    if (bg[i] || !grey(i)) continue;
    bg[i] = 1;
    const x = i % w;
    if (x > 0) st.push(i - 1);
    if (x < w - 1) st.push(i + 1);
    if (i >= w) st.push(i - w);
    if (i < n - w) st.push(i + w);
  }
  // pockets of the background: flat grey (not a white shine, not a pearl), a fair size
  {
    const seen = new Uint8Array(n);
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0] || bg[s0] || !grey(s0, 10, 175)) continue;
      const blob = [s0];
      seen[s0] = 1;
      let bright = 0, sum = 0, sum2 = 0, tint = 0;
      for (let k = 0; k < blob.length; k++) {
        const i = blob[k], x = i % w;
        const [pr, pg, pb] = px(i);
        if (pr > 238) bright++;
        sum += pr; sum2 += pr * pr; tint += Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
          if (j >= 0 && j < n && !seen[j] && !bg[j] && grey(j, 10, 175)) { seen[j] = 1; blob.push(j); }
      }
      // (the background is flat and grey; a pearl's shading varies and is a little pink)
      const sd = Math.sqrt(Math.max(0, sum2 / blob.length - (sum / blob.length) ** 2));
      if (blob.length >= 60 && bright / blob.length < 0.3 && sd < 6 && tint / blob.length < 6) for (const i of blob) bg[i] = 1;
    }
  }
  // the floor shadow under her feet: grey, low down, touching the background
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = px(i);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
    out[i * 4 + 3] = bg[i] ? 0 : 255;
  }
  // her edge: how much of each edge pixel is her, from how far it is from the grey behind it
  // to the colour inside her; and its colour is hers
  for (let i = 0; i < n; i++) {
    if (bg[i]) continue;
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].filter((j) => j >= 0 && j < n);
    const back = nb.find((j) => bg[j]);
    if (back === undefined) continue;
    // the nearest pixel wholly inside her, two or three pixels in
    let inner = -1;
    for (let d = 2; d <= 4 && inner < 0; d++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const xx = x + dx * d, yy = ((i / w) | 0) + dy * d;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (bg[j]) continue;
        const ok = [xx > 0 ? j - 1 : -1, xx < w - 1 ? j + 1 : -1, j - w, j + w].every((q) => q < 0 || q >= n || !bg[q]);
        if (ok) { inner = j; break; }
      }
    if (inner < 0) continue;
    const P = px(i), B = px(back), F = px(inner);
    let num = 0, den = 0;
    for (let k = 0; k < 3; k++) { num += (P[k] - B[k]) * (F[k] - B[k]); den += (F[k] - B[k]) ** 2; }
    const a = den > 50 ? Math.max(0.1, Math.min(1, num / den)) : 1;
    out[i * 4 + 3] = Math.round(a * 255);
    for (let k = 0; k < 3; k++) out[i * 4 + k] = F[k];
  }
  return { img: out, w, h };
}

/** A view on the canvas: scaled by s about the picture's point `from`, which goes to `to`. */
function place({ img, w, h }, from, to, s) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x - to[0]) / s + from[0], sy = (y - to[1]) / s + from[1];
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const fx = sx - x0, fy = sy - y0;
      let a = 0;
      const acc = [0, 0, 0];
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const k = ((y0 + dy) * w + x0 + dx) * 4;
        const al = (img[k + 3] / 255) * wt;
        a += al;
        for (let q = 0; q < 3; q++) acc[q] += img[k + q] * al;
      }
      if (a <= 0.004) continue;
      const o = (y * W + x) * 4;
      for (let q = 0; q < 3; q++) out[o + q] = acc[q] / a;
      out[o + 3] = Math.min(255, a * 255);
    }
  return out;
}

/** How much each princess's pictures are scaled onto the canvas. */
function scaleOf(doll) {
  return Math.min(doll.maxScale ?? Infinity, (CHIN_AT - EYES_AT[1]) / (doll.chin - doll.eyes[1]));
}
/** Her front view on the canvas. */
async function front(name) {
  const d = DOLLS[name];
  const v = await cutView(d.file, d.front);
  return place(v, d.eyes, EYES_AT, scaleOf(d));
}

/* --------------------------------------------------------------- her pieces */
const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
const inEllipse = (x, y, [cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
/** Her skin: peach, light; a blush on it is pinker but as light. */
// (her skin is very saturated and light; a light lock of brown or blonde hair is less of both)
const isSkin = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return (h >= 5 && h <= 36) && l > 0.62 && s > 0.78 && r > g && g > b; };
const isBlush = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return (h <= 12 || h >= 345) && l > 0.62 && s > 0.7; };

/**
 * On the canvas (each measured on her once placed): her eyes [x, y, rx, ry], her brows, her
 * mouth, her earrings, where her face is, the line her tiara is above, and what colour her
 * hair is. Where her hair ends below (her body is below it).
 */
const FACES = {
  pink: {
    eyes: [[428, 497, 56, 46], [594, 497, 56, 46]],
    brows: [[426, 398, 488, 426], [562, 398, 630, 434]],
    mouth: [476, 552, 548, 598],
    earrings: [[364, 566, 23, 28], [654, 566, 23, 28]],
    face: [512, 500, 160, 150],
    tiara: 330,
    hairEnd: 1040,
    skinEnd: 1100,
    hair: (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 8 && h <= 38 && s > 0.28 && l < 0.6 && l > 0.08; },
  },
  mermaid: {
    eyes: [[428, 494, 58, 50], [602, 500, 64, 36]],
    brows: [[394, 396, 458, 434], [562, 400, 646, 438]],
    mouth: [490, 553, 532, 600],
    earrings: [[349, 592, 23, 44], [672, 592, 23, 44]],
    face: [512, 500, 162, 150],
    tiara: 300,
    hairEnd: 820,
    skinEnd: 900,
    hair: (r, g, b) => { const [h, s, l] = hsl(r, g, b); return (l < 0.36 && (s < 0.45 || (h >= 15 && h <= 60))) || (l < 0.5 && s < 0.25); },
  },
  blue: {
    eyes: [[420, 496, 58, 50], [610, 496, 62, 50]],
    brows: [[396, 390, 458, 416], [566, 386, 642, 422]],
    mouth: [472, 553, 554, 628],
    earrings: [[358, 589, 23, 41], [673, 589, 23, 41]],
    face: [514, 502, 162, 150],
    tiara: 330,
    hairEnd: 730,
    skinEnd: 1500,
    hair: (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 30 && h <= 60 && s > 0.3 && l > 0.2 && l < 0.93; },
  },
};

/** Keeps the biggest patch of a picture (her), drops the rest (a floor shadow, a speck). */
function keepBiggest(img) {
  const seen = new Uint32Array(W * H);
  let best = 0, bestId = 0, id = 0;
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || img[s0 * 4 + 3] < 30) continue;
    id++;
    const blob = [s0];
    seen[s0] = id;
    for (let k = 0; k < blob.length; k++) {
      const i = blob[k], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && !seen[j] && img[j * 4 + 3] >= 30) { seen[j] = id; blob.push(j); }
    }
    if (blob.length > best) { best = blob.length; bestId = id; }
  }
  for (let i = 0; i < W * H; i++) if (seen[i] !== bestId && img[i * 4 + 3] >= 30) img[i * 4 + 3] = 0;
  return img;
}

/** Her plain skin, peach (not a blush, not lips). */
const isPeach = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 14 && h <= 36 && l > 0.6 && s > 0.2 && r > g && g > b; };
const mouthEllipse = ([x0, y0, x1, y1]) => [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 2, (y1 - y0) / 2 + 2];
const L = { face: 1, eyes: 2, brow: 4, mouth: 8, hair: 16, dress: 32, skin: 64 };
/**
 * Where each feature of her face is (on the canvas), a little wider than drawn: the eyes and
 * their lashes, the brows, the mouth. Inside these the feature is taken as the difference
 * between her picture and her plain skin under it (see features()).
 */
function featureZones(F) {
  return {
    eyes: (x, y) => F.eyes.some((e) => inEllipse(x, y, [e[0], e[1], e[2] + 16, e[3] + 14])),
    brows: (x, y) => F.brows.some(([x0, y0, x1, y1]) => inEllipse(x, y, [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 12, (y1 - y0) / 2 + 12])),
    mouth: (x, y) => inEllipse(x, y, mouthEllipse(F.mouth).map((v, k) => (k < 2 ? v : v + 12))),
  };
}
/**
 * What each pixel of her front view is. Above her shoulders, anything that is not her skin is
 * her hair (whatever its colour: its shine, its deepest shadow), except her eyes, brows and
 * mouth; lower down, her hair is what has her hair's colour, or is as dark as its shadows.
 */
function label(img, F) {
  const lab = new Uint8Array(W * H);
  const Z = featureZones(F);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (img[i * 4 + 3] < 20) continue;
      const r = img[i * 4], g = img[i * 4 + 1], b = img[i * 4 + 2];
      const [hh, ss, ll] = hsl(r, g, b);
      const skin = isSkin(r, g, b) || isBlush(r, g, b);
      const inFace = inEllipse(x, y, F.face);
      if (F.earrings.some((e) => inEllipse(x, y, e))) { lab[i] = L.hair; continue; }
      if (inFace && Z.eyes(x, y)) { lab[i] = L.eyes; continue; }
      if (inFace && Z.brows(x, y)) { lab[i] = L.brow; continue; }
      if (inFace && Z.mouth(x, y)) { lab[i] = L.mouth; continue; }
      if (y < F.tiara) { lab[i] = L.hair; continue; }
      if (y < SHOULDERS) {
        // (her ears too; a light lock of brown or blonde hair is as peach as skin, so only inside
        // her face's outline, her ears and her neck)
        const ear = F.earrings.some((e) => inEllipse(x, y, [e[0] + (e[0] < 512 ? -4 : 4), e[1] - e[3] - 26, 26, 38]));
        if (skin && (inFace || ear || (y > 560 && Math.abs(x - 512) < 72))) { lab[i] = L.face | L.skin; continue; }
        // the shade under her chin and down her neck is her skin's, not hair
        // (and the lines of her neckline and necklace there are her dress's)
        if (y > 560 && Math.abs(x - 512) < 72 && !F.hair(r, g, b) && ll > 0.25) { lab[i] = L.face; continue; }
        if (y > 590 && Math.abs(x - 512) < 150 && !F.hair(r, g, b) && ll > 0.1 && !(hh >= 4 && hh <= 40 && ss > 0.4)) { lab[i] = L.dress; continue; }
        // shaded skin round her face (less bright than her skin test asks)
        if ((inFace || y > 560) && hh >= 4 && hh <= 40 && ss > 0.55 && ll > 0.45 && !F.hair(r, g, b)) { lab[i] = L.face | L.skin; continue; }
        // (and her chest above her neckline, pale and less saturated in the light)
        if (y > 560 && Math.abs(x - 512) < 170 && ll > 0.55 && !F.hair(r, g, b) && !(hh > 40 && hh < 330 && ss > 0.3)) { lab[i] = L.face | (hh >= 4 && hh <= 40 ? L.skin : 0); continue; }
        lab[i] = L.hair;
        continue;
      }
      // (and its deepest shadows, almost black)
      // (round her shoulders, a dark that is not one of her dress's colours is her hair's shadow)
      const darkHair = Math.abs(x - 512) > 110 && (ll < 0.1 || (ll < 0.3 && y < 780 && (ss < 0.55 || (hh >= 15 && hh <= 60))));
      if (y < F.hairEnd && (F.hair(r, g, b) || darkHair)) { lab[i] = L.hair; continue; }
      const body = hh >= 14 && hh <= 34 && ll > 0.55 && ss > 0.25 && r > g && g > b && y < F.skinEnd;
      lab[i] = L.dress | (body ? L.skin : 0);
    }
  // her hair reaching into the zones of her eyes and brows (at her temples) is hair: followed
  // in from the hair round them, through hair-coloured pixels, at most 30 pixels
  {
    let front = [];
    const depth = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (lab[i] === L.hair) front.push(i);
    for (let d = 1; d <= 30 && front.length; d++) {
      const next = [];
      for (const i of front) {
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || depth[j] || !(lab[j] === L.eyes || lab[j] === L.brow)) continue;
          if (!F.hair(img[j * 4], img[j * 4 + 1], img[j * 4 + 2])) continue;
          depth[j] = d;
          lab[j] = L.hair;
          next.push(j);
        }
      }
      front = next;
    }
  }
  return lab;
}
/** Above this every princess's shoulders begin (her neckline is below it). */
const SHOULDERS = 640;
const pick = (img, lab, test) => {
  const o = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (test(lab[i])) for (let c = 0; c < 4; c++) o[i * 4 + c] = img[i * 4 + c];
  return o;
};

/** Clears every patch of a picture smaller than min pixels. */
function dropSpecks(img, min) {
  const seen = new Uint8Array(W * H);
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || img[s0 * 4 + 3] < 20) continue;
    const blob = [s0];
    seen[s0] = 1;
    for (let k = 0; k < blob.length; k++) {
      const i = blob[k], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && !seen[j] && img[j * 4 + 3] >= 20) { seen[j] = 1; blob.push(j); }
    }
    if (blob.length < min) for (const i of blob) img[i * 4 + 3] = 0;
  }
  return img;
}
/** Keeps only the patches of a picture that reach into the places given. */
function keepTouching(img, at) {
  const seen = new Uint8Array(W * H);
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || !img[s0 * 4 + 3]) continue;
    const blob = [s0];
    seen[s0] = 1;
    let hit = false;
    for (let k = 0; k < blob.length; k++) {
      const i = blob[k], x = i % W;
      if (!hit && at(x, (i / W) | 0)) hit = true;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && !seen[j] && img[j * 4 + 3]) { seen[j] = 1; blob.push(j); }
    }
    if (!hit) for (const i of blob) img[i * 4 + 3] = 0;
  }
  return img;
}
/** A Gaussian blur of a W by H plane, in place (three box blurs). */
function blur(a, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  const tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = s / (2 * r + 1);
        s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / (2 * r + 1);
        s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/** Where her neck meets the dresses (as the shared head's neck): below it each dress's own. */
const NECK_CUT = 648;
/** Below this her hair is behind her (behind her dress and arms), above it in front. */
const HAIR_CUT = 650;

/** All of one princess's pieces, from her front view. */
async function pieces(name) {
  const F = FACES[name];
  const her = keepBiggest(await front(name));
  const lab = label(her, F);
  const head = headOf(her, lab, F);
  const { eyes, brows, mouth } = features(her, head, F);
  // her hair: all of it behind her; in front of her, only what lies over her head (her fringe,
  // the hair at her temples), her tiara and her earrings, softly at its edge
  const hair = pick(her, lab, (l) => l === L.hair);
  dropSpecks(hair, 300);
  const back = new Uint8ClampedArray(hair);
  // (well inside her head: at its edge the hair's shadow is drawn round her face, and left in
  // the front layer it was a ring round any face)
  const over = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) if (head[i * 4 + 3] > 128) over[i] = 1;
  blur(over, 4);
  // (all of it that lies on her head, to its very edge, or her skin showed in a ring between
  // the two layers)
  for (let i = 0; i < W * H; i++) over[i] = smooth(over[i] / 0.15);
  const hf = new Uint8ClampedArray(hair);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    const [rr, gg, bb] = [hf[i * 4], hf[i * 4 + 1], hf[i * 4 + 2]];
    const jewel = y < F.tiara + 20 && (hsl(rr, gg, bb)[1] > 0.5 && (hsl(rr, gg, bb)[0] < 60 || hsl(rr, gg, bb)[0] > 180)) && !F.hair(rr, gg, bb);
    const keep = jewel || F.earrings.some((e) => inEllipse(x, y, [e[0], e[1], e[2] + 4, e[3] + 4])) ? 1 : over[i];
    hf[i * 4 + 3] *= keep;
  }
  dropSpecks(hf, 60);
  // her dress, with her arms, hands, chest (and legs and shoes); from her neck down
  const dress = pick(her, lab, (l) => (l & L.dress) !== 0 || l === (L.face | L.skin));
  const skin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    if (lab[i] === (L.dress | L.skin) || (lab[i] === (L.face | L.skin) && y >= NECK_CUT - 8)) skin[i] = 1;
    if (y < NECK_CUT - 8) dress[i * 4 + 3] = 0;
    else if (y < NECK_CUT + 6 && skin[i]) dress[i * 4 + 3] *= (y - NECK_CUT + 8) / 14;
  }
  keepTouching(dress, (x, y) => y > 800);
  dropSpecks(dress, 400);
  for (let i = 0; i < W * H; i++) {
    if (((i / W) | 0) < 1440 || !dress[i * 4 + 3]) continue;
    const [, s0, l0] = hsl(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
    if (s0 < 0.22 && l0 > 0.55) dress[i * 4 + 3] = 0;
  }
  return { her, lab, eyes, brows, mouth, hairFront: hf, hairBack: back, dress, skin, head };
}

/**
 * Her eyes, brows and mouth, as soft as drawn: in each zone, how much her picture differs from
 * her plain skin under it is how much of the feature is there (its alpha), and its colour is
 * what, laid over that skin, gives her picture back exactly.
 */
function features(her, head, F) {
  const Z = featureZones(F);
  // her hair at her temples is not part of them: hair-coloured pixels joined to her hair
  // outside the zones (followed into a zone at most 30 pixels) are left out
  const enclosed = new Uint8Array(W * H).fill(1);
  {
    const inZone = (x, y) => Z.eyes(x, y) || Z.brows(x, y) || Z.mouth(x, y);
    const hairy = (i) => F.hair(her[i * 4], her[i * 4 + 1], her[i * 4 + 2]);
    const depth = new Uint8Array(W * H);
    let front = [];
    for (let y = 300; y < 700; y++)
      for (let x = 250; x < 780; x++) {
        const i = y * W + x;
        if (!inZone(x, y) && hairy(i) && !inEllipse(x, y, [F.face[0], F.face[1], F.face[2] - 40, F.face[3] - 30])) { enclosed[i] = 0; front.push(i); }
      }
    for (let d = 1; d <= 30 && front.length; d++) {
      const next = [];
      for (const i of front) {
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || !enclosed[j] || !hairy(j)) continue;
          enclosed[j] = 0;
          next.push(j);
        }
      }
      front = next;
    }
  }
  const out = { eyes: new Uint8ClampedArray(W * H * 4), brows: new Uint8ClampedArray(W * H * 4), mouth: new Uint8ClampedArray(W * H * 4) };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const zone = Z.eyes(x, y) ? 'eyes' : Z.brows(x, y) ? 'brows' : Z.mouth(x, y) ? 'mouth' : null;
      if (!zone || !enclosed[i] || her[i * 4 + 3] < 128 || head[i * 4 + 3] < 128) continue;
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(her[i * 4 + c] - head[i * 4 + c]));
      let a = smooth((d - 16) / 40);
      // her skin's own shading round her eyes and lips is her face's, not theirs
      {
        const [hh, ss, ll] = hsl(her[i * 4], her[i * 4 + 1], her[i * 4 + 2]);
        const from = zone === 'brows' ? 0.5 : 0.4;
        if (hh >= 8 && hh <= 40 && ll > from && ss < 0.85) a *= 1 - smooth((ll - from) / 0.12);
      }
      if (a <= 0.01) continue;
      const o = out[zone];
      // (its own colour; unmixed from the skin, a faint edge came out blue)
      for (let c = 0; c < 3; c++) o[i * 4 + c] = a > 0.5 ? Math.max(0, Math.min(255, head[i * 4 + c] + (her[i * 4 + c] - head[i * 4 + c]) / a)) : her[i * 4 + c];
      o[i * 4 + 3] = a * 255;
    }
  // only the patches that make up each feature (not a crease of her skin)
  keepTouching(out.eyes, (x, y) => F.eyes.some((e) => inEllipse(x, y, [e[0], e[1], e[2] * 0.6, e[3] * 0.6])));
  dropSpecks(out.brows, 40);
  keepTouching(out.mouth, (x, y) => inEllipse(x, y, mouthEllipse(F.mouth).map((v, k) => (k < 2 ? v : v * 0.6))));
  return out;
}

/**
 * Her own head, exactly her face, cheeks, ears, jaw and neck as drawn; where her eyes, brows
 * and mouth are (any eyes and mouth go on it) and where her hair lay on it, her skin filled in
 * from the skin round it, softly (a blur of her own skin, wider where it has further to reach).
 */
function headOf(her, lab, F) {
  const n = W * H;
  const [cx, cy, rx, ry] = F.face;
  const isFace = (l) => (l & L.face) !== 0;
  // the parts of her face that are not her skin, a little wider
  const feature = new Float32Array(n);
  // (in the zones of her eyes, brows and mouth, only what is not her skin's colour: the skin round
  // them keeps its own shading, so no patch shows round a feature)
  for (let i = 0; i < n; i++) {
    if (!(lab[i] === L.eyes || lab[i] === L.brow || lab[i] === L.mouth)) continue;
    const r = her[i * 4], g = her[i * 4 + 1], b = her[i * 4 + 2];
    // (her lips are as pink as a blush: in her mouth, anything not her plain peach skin)
    if (!(isSkin(r, g, b) || isBlush(r, g, b)) || (lab[i] === L.mouth && !isPeach(r, g, b))) feature[i] = 1;
  }
  blur(feature, 2);
  const hairNear = new Float32Array(n);
  for (let i = 0; i < n; i++) if (lab[i] === L.hair) hairNear[i] = 1;
  blur(hairNear, 2);
  // her skin she shows, to fill from
  const known = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = her[i * 4], g = her[i * 4 + 1], b = her[i * 4 + 2];
    const skinCol = isSkin(r, g, b) || isBlush(r, g, b);
    if ((isFace(lab[i]) || ((lab[i] === L.eyes || lab[i] === L.brow || lab[i] === L.mouth) && skinCol)) && feature[i] < 0.02 && hairNear[i] < 0.02 && her[i * 4 + 3] > 250) known[i] = 1;
  }
  // what her head is: her face and neck as drawn, and her skull under her hair
  const shape = new Float32Array(n);
  for (let y = 0; y < NECK_CUT + 14; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (isFace(lab[i]) || lab[i] === L.eyes || lab[i] === L.brow || lab[i] === L.mouth || (inEllipse(x, y, [cx, cy - 10, rx + 6, ry + 20]) && y < cy)) shape[i] = 1;
    }
  const out = new Uint8ClampedArray(n * 4);
  const fill = [];
  for (let i = 0; i < n; i++) {
    if (!shape[i]) continue;
    if (known[i]) { for (let c = 0; c < 3; c++) out[i * 4 + c] = her[i * 4 + c]; out[i * 4 + 3] = 255; }
    else fill.push(i);
  }
  const done = new Uint8Array(n);
  for (const sigma of [5, 12, 28, 60]) {
    const num = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    const den = new Float32Array(known);
    for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) num[c][i] = known[i] * her[i * 4 + c];
    for (const p of [...num, den]) blur(p, sigma);
    for (const i of fill) {
      if (done[i] || den[i] < (sigma === 60 ? 1e-5 : 0.12)) continue;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = num[c][i] / den[i];
      out[i * 4 + 3] = 255;
      done[i] = 1;
    }
  }
  // its edge as soft as her picture's
  for (let i = 0; i < n; i++) if (shape[i] && known[i]) out[i * 4 + 3] = her[i * 4 + 3];
  return out;
}
{
  // (nothing)
}

async function save(file, rgba) {
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toFile(file);
}

module.exports = { DOLLS, FACES, cutView, place, scaleOf, front, pieces, save, hsl, isPeach, W, H, EYES_AT, CHIN_AT, REF, NECK_CUT: 648 };


/* --------------------------------------------------------------- into the game */
/** Which of her pieces is which option (the ids are the game's). */
const IDS = {
  green: { hair: 'braids', dress: 'gown', eyes: 'sparkly', mouth: 'smile' },
  pink: { hair: 'long', dress: 'aline', eyes: 'happy', mouth: 'laugh' },
  mermaid: { hair: 'curly', dress: 'mermaid', eyes: 'wink', mouth: 'oh' },
  blue: { hair: 'bun', dress: 'star', eyes: 'sleepy', mouth: 'tongue' },
};
const BASE_SKIN = [253, 197, 155];
const TONES = { light: [253, 197, 155], tan: [228, 160, 116], brown: [178, 114, 74], dark: [114, 70, 44] };
function toned(img, mask, tone) {
  const o = new Uint8ClampedArray(img);
  const k = TONES[tone].map((v, c) => v / BASE_SKIN[c]);
  for (let i = 0; i < W * H; i++) if (!mask || mask[i]) for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * k[c];
  return o;
}
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
async function writeAll() {
  const fs = require('fs');
  const OUT = path.join(__dirname, '..', '..', 'public', 'princess');
  // (through a buffer, and again if Windows refuses the file for a moment)
  const write = async (file, img) => {
    const buf = await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    for (let k = 0; ; k++) {
      try { fs.writeFileSync(path.join(OUT, file), buf); return; } catch (e) { if (k > 20) throw e; await new Promise((r) => setTimeout(r, 300)); }
    }
  };
  const boxesFile = path.join(__dirname, '..', '..', 'src', 'characters', 'princess', 'pieces.json');
  const boxes = JSON.parse(fs.readFileSync(boxesFile, 'utf8'));
  // the green princess, from v2.cjs (her front picture; her head is the one with no hair too)
  const V2 = await require('./v2.cjs').build();
  const all = {
    green: { head: V2.head, eyes: V2.eyes, brows: V2.brows, mouth: V2.mouth, hairFront: V2.hairFront, hairBack: V2.hairBack, dress: V2.dress, skin: V2.skinMask },
  };
  for (const name of Object.keys(DOLLS)) all[name] = await pieces(name);
  for (const [name, p] of Object.entries(all)) {
    const id = IDS[name];
    for (const tone of Object.keys(TONES)) {
      await write(`head-${id.hair}-${tone}.webp`, toned(p.head, null, tone));
      if (name === 'green') await write(`head-${tone}.webp`, toned(p.head, null, tone));
      await write(`dress-${id.dress}-${tone}.webp`, toned(p.dress, p.skin, tone));
    }
    await write(`hair-${id.hair}-front.webp`, p.hairFront);
    await write(`hair-${id.hair}-back.webp`, p.hairBack);
    await write(`eyes-${id.eyes}.webp`, p.eyes);
    await write(`brows-${id.eyes}.webp`, p.brows);
    await write(`mouth-${id.mouth}.webp`, p.mouth);
    if (name === 'green') await write('brows.webp', p.brows);
    boxes[`hair:${id.hair}`] = boxOf(p.hairFront, p.hairBack);
    boxes[`dress:${id.dress}`] = boxOf(p.dress);
    boxes[`eyes:${id.eyes}`] = boxOf(p.eyes, p.brows);
    boxes[`mouth:${id.mouth}`] = boxOf(p.mouth);
    console.log(name, 'written');
  }
  fs.writeFileSync(boxesFile, JSON.stringify(boxes, null, 2));
}
module.exports.writeAll = writeAll;

if (require.main === module)
  (async () => {
    if (process.argv[2] === 'write') return writeAll();
    const dbg = process.argv[2];
    for (const name of Object.keys(DOLLS)) {
      const f = keepBiggest(await front(name));
      const lab = label(f, FACES[name]);
      if (dbg) {
        await save(path.join(dbg, `front-${name}.png`), f);
        const col = { [L.hair]: [220, 30, 30], [L.eyes]: [30, 30, 230], [L.brow]: [0, 200, 255], [L.mouth]: [255, 0, 200], [L.face]: [255, 220, 0], [L.face | L.skin]: [255, 200, 0], [L.dress]: [0, 150, 0], [L.dress | L.skin]: [255, 140, 0] };
        const o = new Uint8ClampedArray(W * H * 4);
        for (let i = 0; i < W * H; i++) {
          const c = col[lab[i]];
          if (!c) continue;
          for (let k = 0; k < 3; k++) o[i * 4 + k] = c[k] * 0.6 + f[i * 4 + k] * 0.4;
          o[i * 4 + 3] = 255;
        }
        await save(path.join(dbg, `labels-${name}.png`), o);
      }
      if (dbg) {
        const p = await pieces(name);
        for (const k of ['eyes', 'brows', 'mouth', 'hairFront', 'hairBack', 'dress', 'head']) await save(path.join(dbg, `${name}-${k}.png`), p[k]);
      }
      console.log(name, 'scale', scaleOf(DOLLS[name]).toFixed(3));
    }
  })();

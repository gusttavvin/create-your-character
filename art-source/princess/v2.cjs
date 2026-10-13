/**
 * The princess's second look (Clara, 13 October 2026): her green princess drawn again as a
 * glossy doll, with a nose, lips and soft shading, and a turnaround of her from every side
 * (art-source/princess/reference/v2/). "Use this image so the princesses look like her."
 *
 * This first takes her out of her picture (its background is a grey and white checkerboard,
 * painted in, not transparent) and lines her up with the game's 1024 by 1536 canvas.
 *
 *   node art-source/princess/v2.cjs            (needs sharp, like cut.cjs)
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const HERE = __dirname;
const REF = path.join(HERE, 'reference', 'v2');
const W = 1024;
const H = 1536;

/** Her picture without its checkerboard: RGBA, with soft edges. */
async function cutOut(file) {
  const { data, info } = await sharp(path.join(REF, file)).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, c = info.channels;
  const n = w * h;
  // the checkerboard: light and grey, reached from the edge of the picture
  const isBg = (i) => {
    const r = data[i * c], g = data[i * c + 1], b = data[i * c + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= 12 && Math.min(r, g, b) >= 222;
  };
  const bg = new Uint8Array(n);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !isBg(i)) continue;
    bg[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < n - w) stack.push(i + w);
  }
  // and the checkerboard shut in by her (between an arm and her dress, between locks of hair):
  // a patch of light grey and white squares both, which a flower or the white of an eye is not
  {
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (seen[s] || bg[s] || !isBg(s)) continue;
      const blob = [s];
      seen[s] = 1;
      let grey = 0, white = 0, between = 0;
      for (let k = 0; k < blob.length; k++) {
        const i = blob[k], x = i % w;
        const l = data[i * c];
        // (the checkerboard has two flat greys, about 240 and 255; a flower's or an eye's
        // white is shaded, all the values between)
        if (l >= 235 && l <= 245) grey++;
        else if (l >= 251) white++;
        else between++;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
          if (j >= 0 && j < n && !seen[j] && !bg[j] && isBg(j)) { seen[j] = 1; blob.push(j); }
      }
      if (blob.length >= 30 && grey / blob.length > 0.2 && white / blob.length > 0.2 && between / blob.length < 0.25) for (const i of blob) bg[i] = 1;
    }
  }
  // her edge was painted over the checkerboard: the pixels on it are part her, part
  // background. How much of each, from how far the colour is from the background's.
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = data[i * c];
    out[i * 4 + 1] = data[i * c + 1];
    out[i * 4 + 2] = data[i * c + 2];
    out[i * 4 + 3] = bg[i] ? 0 : 255;
  }
  for (let i = 0; i < n; i++) {
    if (bg[i]) continue;
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].filter((j) => j >= 0 && j < n);
    if (!nb.some((j) => bg[j])) continue;
    // on the edge: the background behind it is about 248, her colour is her neighbour's inside
    const inner = nb.find((j) => !bg[j] && !nb.includes(j - 1)) ?? i;
    const lum = (k) => 0.299 * data[k * c] + 0.587 * data[k * c + 1] + 0.114 * data[k * c + 2];
    const a = Math.min(1, Math.max(0.15, (248 - lum(i)) / Math.max(1, 248 - lum(inner))));
    out[i * 4 + 3] = Math.round(255 * a);
  }
  // and the colour of an edge pixel is hers, not hers mixed with the white of the background
  // (its alpha says how much of it is her): the colour of the nearest pixel wholly inside
  {
    const solid = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (!bg[i]) solid[i] = 1;
    for (let i = 0; i < n; i++) {
      if (bg[i]) continue;
      const x = i % w;
      if (![x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].some((j) => j >= 0 && j < n && bg[j])) continue;
      solid[i] = 0;
    }
    for (let i = 0; i < n; i++) {
      if (bg[i] || solid[i]) continue;
      const x = i % w, y = (i / w) | 0;
      let best = -1, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!solid[j]) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = j; }
        }
      if (best >= 0) for (let k = 0; k < 3; k++) out[i * 4 + k] = data[best * c + k];
    }
  }
  return { img: out, w, h };
}

/**
 * Where she goes on the canvas: her face exactly where the other princesses' face is (between
 * her eyes at 512, 492; the old pieces are all lined up with it), and as big — her eyes are
 * 167.5 pixels apart in her picture, theirs 170. Her head and her body stay one picture.
 */
const PLACE = { from: [553.5, 383], to: [512, 492], s: 170 / 167.5 };
function place(src, w, h) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x - PLACE.to[0]) / PLACE.s + PLACE.from[0];
      const sy = (y - PLACE.to[1]) / PLACE.s + PLACE.from[1];
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const fx = sx - x0, fy = sy - y0;
      const o = (y * W + x) * 4;
      // weighted by how much of each pixel is her, so her edges do not darken
      let a = 0;
      const acc = [0, 0, 0];
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const k = ((y0 + dy) * w + x0 + dx) * 4;
        const al = (src[k + 3] / 255) * wt;
        a += al;
        for (let c = 0; c < 3; c++) acc[c] += src[k + c] * al;
      }
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) out[o + c] = acc[c] / a;
      out[o + 3] = a * 255;
    }
  return out;
}

/* --------------------------------------------------------------- what is what */
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
const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
const inEllipse = (x, y, [cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
/** Her face's features on the canvas (measured on her, once placed). */
const FACE = {
  eyes: [[421, 497, 66, 52], [598, 487, 62, 54]],
  brows: [[374, 408, 470, 446], [544, 392, 632, 430]],
  mouth: [470, 552, 552, 596],
  nose: [494, 518, 532, 552],
  skull: [515, 470, 160, 178],
  chin: 637,
};
/** Her skin: warm and light, and not her lips or her hair. */
function isSkin(r, g, b) {
  const [h, s, l] = hsl(r, g, b);
  return h >= 8 && h <= 38 && l > 0.42 && g > 0.56 * r && r - b > 25;
}
/** Her red hair, from its shine down to its shadows. */
function isRedHair(r, g, b) {
  const [h, s, l] = hsl(r, g, b);
  return (h <= 16 || h >= 340) && s > 0.35 && g < 0.55 * r && l < 0.75;
}
const isGold = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 30 && h <= 58 && s > 0.35 && l > 0.3; };
const isGem = (r, g, b) => { const [h, s] = hsl(r, g, b); return h >= 120 && h <= 185 && s > 0.25; };

/** Labels: bit flags, as cut.cjs's. */
const L = { head: 1, eyes: 2, mouth: 4, hair: 8, dress: 16, skin: 32, brow: 64 };
function label(img) {
  const lab = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (img[i * 4 + 3] < 40) continue;
      const r = img[i * 4], g = img[i * 4 + 1], b = img[i * 4 + 2];
      const skin = isSkin(r, g, b);
      // her tiara, high on her head
      if (y < 300 && (isGold(r, g, b) || isGem(r, g, b) || !skin)) { lab[i] = L.hair; continue; }
      // her eyes: anything not skin in them; round them (her lashes) anything not hair either
      // (her hair's red, lighter than her lashes, is her hair's even there)
      // (the white of her eye is pinkish where her lid shades it: pale, not as strong as skin)
      const white = hsl(r, g, b)[2] > 0.88 || hsl(r, g, b)[1] < 0.45;
      if (x >= 356 && x <= 642 && FACE.eyes.some((e) => inEllipse(x, y, e)) && (!skin || white) && !(isRedHair(r, g, b) && hsl(r, g, b)[2] > 0.22)) { lab[i] = L.eyes; continue; }
      // her lashes, round them; not the shadows of her hair beyond her lashes' tips
      if (x >= 368 && x <= 640 && FACE.eyes.some((e) => inEllipse(x, y, [e[0], e[1], e[2] + 14, e[3] + 12])) && !skin && !isRedHair(r, g, b) && hsl(r, g, b)[2] < 0.3) { lab[i] = L.eyes; continue; }
      // her brows: brown, darker than the skin round them (and as red as her hair can be)
      if (FACE.brows.some((bx) => inBox(x, y, bx)) && hsl(r, g, b)[2] < 0.66 && !skin) { lab[i] = L.brow; continue; }
      if (inBox(x, y, FACE.mouth) && !skin) { lab[i] = L.mouth; continue; }
      if (isRedHair(r, g, b)) { lab[i] = L.hair; continue; }
      // her earrings hang by her ears
      if (y > 540 && y < 640 && (Math.abs(x - 353) < 26 || Math.abs(x - 665) < 26) && (isGold(r, g, b) || isGem(r, g, b))) { lab[i] = L.hair; continue; }
      if (skin) {
        lab[i] = (y < FACE.chin + 14 && Math.abs(x - 512) < 200 && y > 250 ? L.head : L.dress) | L.skin;
        continue;
      }
      // a flower in her braid, a shadow in her hair
      if (y < 660 || FLOWERS.some((f) => inEllipse(x, y, f))) { lab[i] = L.hair; continue; }
      lab[i] = L.dress;
    }
  // what was taken for a brow but is part of a lock of her hair (it touches the hair beyond
  // the brow's box) is hair
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || lab[s] !== L.brow) continue;
    const blob = [s];
    seen[s] = 1;
    let hair = 0;
    for (let k = 0; k < blob.length; k++) {
      const i = blob[k], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H) continue;
        if (lab[j] === L.hair) hair++;
        if (!seen[j] && lab[j] === L.brow) { seen[j] = 1; blob.push(j); }
      }
    }
    if (hair > 6) for (const i of blob) lab[i] = L.hair;
  }
  return lab;
}
/** The three flowers in her braid. */
const FLOWERS = [[691, 711, 27, 27], [702, 800, 27, 27], [740, 904, 27, 27]];

/* --------------------------------------------------------------- her head */
/**
 * Her whole head, for every princess, as smooth as a doll's: her skin from the picture, with
 * what her hair hid (her forehead, her temples) and where eyes, brows and a mouth go filled in
 * from the skin round it, softly (a blur of the skin she shows, wider where it has further to
 * reach); the fine detail of her face (her nose, her cheeks' shading) kept where she shows it.
 * Her outline: a round skull, her own jaw and chin, her ears (the one she shows, mirrored),
 * and her neck down under the dresses' necklines.
 */
function head(her, lab) {
  const [cx, cy, rx, ry] = FACE.skull;
  const n = W * H;
  // the skin she shows, not right by her hair (part hair there) nor her features
  const skinLab = (l) => l === (L.head | L.skin);
  const nearHair = distanceTo(lab, (l) => l === L.hair, 18);
  const nearFeature = distanceTo(lab, (l) => l === L.eyes || l === L.brow || l === L.mouth, 10);
  const known = new Float32Array(n);
  for (let i = 0; i < n; i++) if (skinLab(lab[i]) && nearHair[i] >= 18 && nearFeature[i] >= 10) known[i] = 1;

  // her outline
  const mask = new Float32Array(n);
  // her cheeks, jaw and chin, measured on her picture: the middle of her face leans a little
  // (515 at her cheekbones, 497 at her chin), and [y, half its width] down to her chin
  const JAW = [[470, 160], [540, 148], [552, 140], [570, 131], [594, 112], [606, 95], [612, 82], [618, 66], [624, 44], [630, 16], [633, 0]];
  const chin = 633;
  const halfAt = (y) => {
    for (let k = 1; k < JAW.length; k++)
      if (y <= JAW[k][0]) {
        const [y0, h0] = JAW[k - 1], [y1, h1] = JAW[k];
        return h0 + ((h1 - h0) * (y - y0)) / (y1 - y0);
      }
    return 0;
  };
  for (let y = 470; y < chin; y++) {
    const mid = 515 + (497 - 515) * Math.max(0, Math.min(1, (y - 540) / 90));
    const half = halfAt(y);
    for (let x = Math.round(mid - half); x <= mid + half; x++) mask[y * W + x] = 1;
  }
  // the skull
  for (let y = 0; y < 540; y++)
    for (let x = 0; x < W; x++) if (inEllipse(x, y, [cx, cy, rx, ry])) mask[y * W + x] = 1;
  // her neck: down from her chin to under the necklines, a little wider at the bottom
  for (let y = 600; y < NECK_CUT + 16; y++) {
    const half = 30 + Math.max(0, y - 645) * 0.8;
    for (let x = Math.round(512 - half); x <= 512 + half; x++) mask[y * W + x] = 1;
  }
  // her ear (on the left of the picture), and its mirror
  const ear = [352, 532, 26, 38];
  for (let y = ear[1] - ear[3]; y <= ear[1] + ear[3]; y++)
    for (let x = ear[0] - ear[2]; x <= ear[0] + ear[2]; x++)
      if (inEllipse(x, y, ear)) { mask[y * W + x] = 1; mask[y * W + (2 * 512 - x)] = 1; }

  // colour: the skin she shows, spread smoothly over all of it
  const field = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const den = new Float32Array(known);
  for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) field[c][i] = known[i] * her[i * 4 + c];
  const wide = [field.map((f) => new Float32Array(f)), new Float32Array(den)];
  for (const f of field) blur(f, 16);
  blur(den, 16);
  for (const f of wide[0]) blur(f, 60);
  blur(wide[1], 60);
  // and its fine detail, where she shows it: the picture less its own blur
  const fine = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const fden = new Float32Array(known);
  for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) fine[c][i] = known[i] * her[i * 4 + c];
  for (const f of fine) blur(f, 3);
  blur(fden, 3);
  const keepFine = distanceTo(new Uint8Array(known.map((v) => (v ? 0 : 1))), (v) => v === 1, 12);

  const out = new Uint8ClampedArray(n * 4);
  const soft = new Float32Array(mask);
  blur(soft, 1.2);
  for (let i = 0; i < n; i++) {
    if (soft[i] < 0.02) continue;
    const near = Math.min(1, den[i] / 0.5);
    for (let c = 0; c < 3; c++) {
      const smoothC = den[i] > 0.02 ? field[c][i] / den[i] : 0;
      const wideC = wide[1][i] > 1e-4 ? wide[0][c][i] / wide[1][i] : smoothC;
      let v = smoothC * near + wideC * (1 - near);
      // where she shows her skin, the picture's own detail on top of the smooth colour
      if (known[i] && fden[i] > 0.5) {
        const w = Math.min(1, keepFine[i] / 12);
        v = v * (1 - w) + (her[i * 4 + c] - fine[c][i] / fden[i] + v) * w;
      }
      out[i * 4 + c] = v;
    }
    out[i * 4 + 3] = Math.min(255, soft[i] * 255);
  }
  // above her brows, her forehead and the top of her head all one smooth skin: the picture's
  // had the shadow of her hairline on it, which showed as the ghost of hair on a bare head
  {
    const base = [0, 0, 0];
    let nb = 0;
    for (let y = 450; y < 480; y++)
      for (let x = 480; x < 545; x++) {
        const i = y * W + x;
        if (!out[i * 4 + 3]) continue;
        for (let c = 0; c < 3; c++) base[c] += out[i * 4 + c];
        nb++;
      }
    for (let c = 0; c < 3; c++) base[c] /= nb;
    for (let y = 0; y < 500; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!out[i * 4 + 3] || !inEllipse(x, y, [cx, cy, rx + 2, ry + 2])) continue;
        const w = 1 - smooth((y - 430) / 60);
        if (!w) continue;
        for (let c = 0; c < 3; c++) out[i * 4 + c] = out[i * 4 + c] * (1 - w) + base[c] * w;
      }
  }
  // round, like the doll she is: lit from above and in front, a little darker to the edge
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!out[i * 4 + 3]) continue;
      // (fading out towards her chin, where the picture has its own shading: stopped at a
      // row, it left a line across her face)
      const fade = 1 - smooth((y - 560) / 70);
      if (fade > 0) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        const k = 1 + fade * ((1 - 0.14 * Math.max(0, Math.min(1, (d - 0.65) / 0.35)) ** 1.5) * (1 + 0.04 * Math.max(0, -ny)) - 1);
        for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, out[i * 4 + c] * k);
      }
    }
  return out;
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
/** How far each pixel is from the labels that pass, up to max. */
function distanceTo(lab, test, max) {
  const d = new Uint8Array(W * H).fill(max);
  let front = [];
  for (let i = 0; i < W * H; i++) if (test(lab[i])) { d[i] = 0; front.push(i); }
  for (let k = 1; k < max && front.length; k++) {
    const next = [];
    for (const i of front) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < W * H && d[j] > k) { d[j] = k; next.push(j); }
    }
    front = next;
  }
  return d;
}

/** A piece: the pixels of the labels given, everything else clear. */
function pick(her, lab, test) {
  const o = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (test(lab[i])) for (let c = 0; c < 4; c++) o[i * 4 + c] = her[i * 4 + c];
  return o;
}

/** Keeps only the patches of a piece that reach into the places given. */
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

/** Where her neck meets the dresses (cut.cjs's NECK_CUT): her head down to it, a dress from it. */
const NECK_CUT = 648;
/** The middle of her eyes, which her face is mirrored about. */
const MID = 512;

/**
 * Every piece of the green princess, on the canvas: her head (for every princess), brows,
 * eyes, smile, her hair in two layers and her dress with her arms and her skin flagged.
 */
async function build() {
  const { img, w, h } = await cutOut('green-front.webp');
  const her = place(img, w, h);
  const lab = label(her);

  const headImg = head(her, lab);
  // below her neck, every dress brings its own chest and shoulders
  for (let i = (NECK_CUT + 14) * W; i < W * H; i++) headImg[i * 4 + 3] = 0;

  // her eyes, and nothing round them that is not part of them
  const eyes = keepTouching(pick(her, lab, (l) => l === L.eyes), (x, y) => FACE.eyes.some((e) => inEllipse(x, y, [e[0], e[1], e[2] * 0.8, e[3] * 0.8])));

  // her brows: a lock of hair lies on her right one (on the left of the picture), so it is
  // her other brow's mirror, a little lower, as her head leans
  const brows = pick(her, lab, (l) => l === L.brow);
  for (let i = 0; i < W * H; i++) if (i % W < MID) brows[i * 4 + 3] = 0;
  for (let y = 0; y < H - 10; y++)
    for (let x = MID; x < W; x++) {
      const i = y * W + x;
      if (!brows[i * 4 + 3]) continue;
      const m = (y + 10) * W + (2 * MID - x);
      for (let c = 0; c < 4; c++) brows[m * 4 + c] = brows[i * 4 + c];
    }

  const mouth = pick(her, lab, (l) => l === L.mouth);

  // her hair: round her face and her braid over her shoulder in front; what falls behind her
  // shoulders behind her dress. The two overlap a little where they meet.
  const hair = pick(her, lab, (l) => l === L.hair);
  // on her face only her hair is hair: bits of her lashes and brows taken for hair go
  for (let i = 0; i < W * H; i++) {
    if (!hair[i * 4 + 3]) continue;
    const x = i % W, y = (i / W) | 0;
    if (!inEllipse(x, y, [512, 500, 150, 150]) || y < 380) continue;
    const r = hair[i * 4], g = hair[i * 4 + 1], b = hair[i * 4 + 2];
    if (!isRedHair(r, g, b) && !isGold(r, g, b) && !isGem(r, g, b)) hair[i * 4 + 3] = 0;
  }
  keepTouching(hair, (x, y) => y < 300 || FLOWERS.some((f) => inEllipse(x, y, f)) || x < 300 || x > 724);
  const braid = (x, y) => x >= 560 && y >= 590 && y < 1100;
  // (the curl on her right hangs over her shoulder, in front of it)
  const front = (x, y) => y < 650 || braid(x, y) || (x < 440 && y < 800);
  const hairFront = new Uint8ClampedArray(hair), hairBack = new Uint8ClampedArray(hair);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!front(x, y - 10)) hairFront[i * 4 + 3] = 0;
    if (front(x, y + 10)) hairBack[i * 4 + 3] = 0;
  }

  // her dress, with her arms and hands and the skin of her chest; below her neck only
  const dress = pick(her, lab, (l) => (l & L.dress) !== 0);
  const skinMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (lab[i] === (L.dress | L.skin) || lab[i] === (L.head | L.skin)) skinMask[i] = 1;
  // (her neck down to NECK_CUT is her head's; below it the dress's skin fades in over it)
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    // (only where her neck is: her shoulders beside it are the dress's)
    if (y < NECK_CUT - 4 && headImg[i * 4 + 3] > 200) dress[i * 4 + 3] = 0;
    else if (lab[i] === (L.head | L.skin) && y >= NECK_CUT - 4) for (let c = 0; c < 4; c++) dress[i * 4 + c] = her[i * 4 + c];
    if (y >= NECK_CUT - 4 && y < NECK_CUT + 10 && skinMask[i]) dress[i * 4 + 3] *= (y - NECK_CUT + 4) / 14;
  }
  // what her braid hid of it (her left shoulder, sleeve and side) is the other side's mirror
  let axis = 0, rows = 0;
  for (let y = 1150; y < 1400; y += 10) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (dress[(y * W + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    if (l >= 0) { axis += (l + r) / 2; rows++; }
  }
  axis = Math.round(axis / rows);
  // (only where the braid lay, and a little round it: the dress is not quite the same on both
  // sides, and mirroring all its right half left a seam down the middle of the skirt)
  const under = distanceTo(lab, (l) => l === L.hair, 14);
  for (let y = 600; y < 1110; y++)
    for (let x = axis + 30; x < W; x++) {
      const i = y * W + x;
      if (!braid(x, y) || under[i] >= 14) continue;
      const m = 2 * axis - x;
      if (m < 0) continue;
      const j = y * W + m;
      for (let c = 0; c < 4; c++) dress[i * 4 + c] = dress[j * 4 + c];
      skinMask[i] = skinMask[j];
    }
  // and nothing loose: wisps at the edge of her hair taken for skin, ends of hair on her shoulders
  keepTouching(dress, (x, y) => y > 760);
  for (let i = 0; i < (720 * W); i++) {
    if (!dress[i * 4 + 3]) continue;
    const [hh, ss, ll] = hsl(dress[i * 4], dress[i * 4 + 1], dress[i * 4 + 2]);
    if ((hh <= 25 || hh >= 335) && ss > 0.25 && ll < 0.5) dress[i * 4 + 3] = 0;
  }
  // the other dresses and hairs, made from hers
  const dresses = {
    gown: { img: dress, skin: skinMask },
    aline: pinkDress(dress, skinMask, axis),
    mermaid: await mermaidDress(dress, skinMask, axis),
    star: await shortDress(dress, skinMask, axis),
  };
  const long = longHair(hair);
  const bun = bunHair(hair, her);
  const curly = curlyHair(hair, her);
  const hairs = {
    braids: { front: hairFront, back: hairBack },
    long: {
      front: hairColour(long.front, 24, 0.85, (l) => l * 0.82, 330),
      back: hairColour(long.back, 24, 0.85, (l) => l * 0.82, 330),
    },
    bun: {
      front: hairColour(bun.front, 42, 1.05, (l) => 0.3 + l * 0.85, 275),
      back: bun.back,
    },
    // black, with dark blue lights where hers shines
    curly: {
      front: hairColour(curly.front, 222, 0.8, (l) => (l < 0.3 ? l * 0.35 : 0.105 + (l - 0.3) * 1.15), 205),
      back: hairColour(curly.back, 222, 0.8, (l) => (l < 0.3 ? l * 0.35 : 0.105 + (l - 0.3) * 1.15), 205),
    },
  };
  for (const h of Object.values(hairs)) { dropSpecks(h.front, 400); dropSpecks(h.back, 400); }
  return { her, lab, head: headImg, eyes, brows, mouth, hairFront, hairBack, dress, skinMask, axis, dresses, hairs, eyeOptions: await eyeOptions(eyes), mouthOptions: await mouthOptions(mouth), rear: await rear() };
}

/* --------------------------------------------------------------- eyes and mouths */
const svgOf = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
async function raster(body) {
  const { data } = await sharp(svgOf(body)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
}
/** a over b, both RGBA */
function over(a, b) {
  const o = new Uint8ClampedArray(b);
  for (let i = 0; i < W * H; i++) {
    const al = a[i * 4 + 3] / 255;
    if (!al) continue;
    const bl = (b[i * 4 + 3] / 255) * (1 - al), out = al + bl;
    for (let c = 0; c < 3; c++) o[i * 4 + c] = (a[i * 4 + c] * al + b[i * 4 + c] * bl) / out;
    o[i * 4 + 3] = out * 255;
  }
  return o;
}
function rgbOf(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
/** Her irises, measured on her (she looks a little towards her nose): [x, y, radius]. */
const IRIS = [[435.5, 509.5, 36], [579, 493, 35]];
/** Her irises in another colour: the brown of them turned, their shading kept. */
function irisTo(eyes, hue, sat = 1) {
  const o = new Uint8ClampedArray(eyes);
  for (let i = 0; i < W * H; i++) {
    if (!o[i * 4 + 3]) continue;
    const x = i % W, y = (i / W) | 0;
    if (!IRIS.some(([ix, iy, r]) => Math.hypot(x - ix, y - iy) < r + 1)) continue;
    const [h, s, l] = hsl(o[i * 4], o[i * 4 + 1], o[i * 4 + 2]);
    // her shines stay white
    if (l > 0.82) continue;
    const c = rgbOf(hue, Math.min(1, Math.max(s, 0.35) * sat), Math.min(0.8, l * 1.12 + 0.02));
    for (let k = 0; k < 3; k++) o[i * 4 + k] = c[k];
  }
  return o;
}
/** The big shine on each eye: where it is and how big. */
function shines(eyes) {
  // the biggest white patch in each iris
  return IRIS.map(([ix, iy, r]) => {
    const seen = new Set();
    let best = [];
    for (let y = Math.floor(iy - r); y < iy + r; y++)
      for (let x = Math.floor(ix - r); x < ix + r; x++) {
        const i = y * W + x;
        const white = (j) => eyes[j * 4 + 3] && Math.min(eyes[j * 4], eyes[j * 4 + 1], eyes[j * 4 + 2]) > 225 && Math.hypot((j % W) - ix, ((j / W) | 0) - iy) < r;
        if (seen.has(i) || !white(i)) continue;
        const blob = [i];
        seen.add(i);
        for (let k = 0; k < blob.length; k++)
          for (const j of [blob[k] - 1, blob[k] + 1, blob[k] - W, blob[k] + W]) if (!seen.has(j) && white(j)) { seen.add(j); blob.push(j); }
        if (blob.length > best.length) best = blob;
      }
    const x = best.reduce((a, i) => a + (i % W), 0) / best.length, y = best.reduce((a, i) => a + ((i / W) | 0), 0) / best.length;
    return { x, y, r: Math.max(5, Math.sqrt(best.length / Math.PI)) };
  });
}
const star = (x, y, r, fill) => {
  const p = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, rr = k % 2 ? r * 0.32 : r;
    p.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}"/>`;
};
const heart = (x, y, r, fill) =>
  `<path d="M${x} ${y + r * 0.9} C${x - r * 1.6} ${y - r * 0.1} ${x - r * 0.7} ${y - r * 1.3} ${x} ${y - r * 0.4} C${x + r * 0.7} ${y - r * 1.3} ${x + r * 1.6} ${y - r * 0.1} ${x} ${y + r * 0.9} Z" fill="${fill}"/>`;

/** The four eyes: 1 hers; 2 blue with star shines; 3 green, winking; 4 purple with hearts. */
async function eyeOptions(eyes) {
  const sh = shines(eyes);
  const glow = `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>`;
  const blue = over(await raster(glow + sh.map((s) => `<g filter="url(#g)">${star(s.x, s.y, s.r * 2.1, '#ffffff')}</g>${star(s.x, s.y, s.r * 1.9, '#ffffff')}`).join('') + sh.map((s, k) => star(IRIS[k][0] - (s.x - IRIS[k][0]) * 0.7, IRIS[k][1] + IRIS[k][2] * 0.45, s.r * 0.75, '#ffffff')).join('')), irisTo(eyes, 212, 1.1));
  const purple = over(await raster(sh.map((s, k) => heart(s.x, s.y, s.r * 1.25, '#ffffff') + heart(IRIS[k][0] - (s.x - IRIS[k][0]) * 0.7, IRIS[k][1] + IRIS[k][2] * 0.45, s.r * 0.6, '#ffe6f6')).join('')), irisTo(eyes, 282, 1.05));
  // the wink: her left eye (on the right of the picture) closed, a smiling curve with lashes
  const green = irisTo(eyes, 135, 0.95);
  const [, right] = FACE.eyes;
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (x > 520 && inEllipse(x, y, [right[0], right[1], right[2] + 22, right[3] + 20])) green[i * 4 + 3] = 0;
  }
  // a happy closed eye, curving up, its lashes sweeping out at the corner, like her open ones
  const [ex, ey] = [right[0] - 4, right[1] + 6];
  const P = (t) => [(1 - t) ** 2 * (ex - 50) + 2 * (1 - t) * t * ex + t * t * (ex + 50), (1 - t) ** 2 * (ey + 10) + 2 * (1 - t) * t * (ey - 30) + t * t * (ey + 4)];
  const lid = `M${ex - 50} ${ey + 10} Q${ex} ${ey - 30} ${ex + 50} ${ey + 4}`;
  const lashes = [[0.7, -2, -1.1], [0.82, 0.2, -1.2], [0.94, 0.9, -0.9], [1, 1.3, -0.35]]
    .map(([t, ux, uy]) => {
      const [px, py] = P(t);
      const len = 15 + t * 6;
      return `<path d="M${px.toFixed(1)} ${py.toFixed(1)} q${(ux * len * 0.3).toFixed(1)} ${(uy * len * 0.6).toFixed(1)} ${(ux * len * 0.55 + 6).toFixed(1)} ${(uy * len).toFixed(1)}" stroke="#2b1a14" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    })
    .join('');
  const wink = await raster(
    `<defs><filter id="s" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
      // the soft shadow of her closed lid, then the line of her lashes
      `<path d="${lid}" stroke="#c98a72" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#s)"/>` +
      `<path d="${lid}" stroke="#2b1a14" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      lashes,
  );
  return { 1: eyes, 2: blue, 3: over(wink, green), 4: purple };
}

/**
 * The four mouths, in her lips' own colours, soft and shiny like hers: 1 her smile; 2 a big
 * laugh; 3 a little "wow"; 4 silly, her tongue out.
 */
async function mouthOptions(mouth) {
  const cx = 511, cy = 573;
  const defs = `<defs>
    <linearGradient id="lip" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9798a"/><stop offset="1" stop-color="#c94f66"/></linearGradient>
    <linearGradient id="lipLow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9566e"/><stop offset="1" stop-color="#f08a9b"/></linearGradient>
    <radialGradient id="inside" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#8a2a36"/><stop offset="1" stop-color="#5a1620"/></radialGradient>
    <radialGradient id="tongue" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#ff9fb0"/><stop offset="1" stop-color="#e5687f"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.8"/></filter>
    <filter id="shine" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>`;
  const laugh = `<g filter="url(#soft)">
    <path d="M${cx - 40} ${cy - 13} Q${cx} ${cy - 4} ${cx + 40} ${cy - 15} Q${cx + 36} ${cy + 30} ${cx} ${cy + 34} Q${cx - 36} ${cy + 30} ${cx - 40} ${cy - 13} Z" fill="url(#inside)"/>
    <path d="M${cx - 33} ${cy - 9} Q${cx} ${cy - 2} ${cx + 33} ${cy - 11} L${cx + 31} ${cy + 1} Q${cx} ${cy + 7} ${cx - 31} ${cy + 2} Z" fill="#fbf7f2"/>
    <path d="M${cx - 20} ${cy + 26} Q${cx} ${cy + 10} ${cx + 20} ${cy + 25} Q${cx} ${cy + 35} ${cx - 20} ${cy + 26} Z" fill="url(#tongue)"/>
    <path d="M${cx - 44} ${cy - 13} Q${cx - 22} ${cy - 24} ${cx - 4} ${cy - 18} Q${cx} ${cy - 21} ${cx + 4} ${cy - 18} Q${cx + 22} ${cy - 25} ${cx + 44} ${cy - 15} Q${cx + 20} ${cy - 6} ${cx} ${cy - 6} Q${cx - 20} ${cy - 6} ${cx - 44} ${cy - 13} Z" fill="url(#lip)"/>
    <path d="M${cx - 44} ${cy - 13} Q${cx - 40} ${cy + 36} ${cx} ${cy + 41} Q${cx + 40} ${cy + 36} ${cx + 44} ${cy - 15} Q${cx + 37} ${cy + 30} ${cx} ${cy + 34} Q${cx - 37} ${cy + 30} ${cx - 44} ${cy - 13} Z" fill="url(#lipLow)"/>
  </g>
  <ellipse cx="${cx - 8}" cy="${cy + 37}" rx="10" ry="2.5" fill="#ffd9df" filter="url(#shine)"/>`;
  const wow = `<g filter="url(#soft)">
    <ellipse cx="${cx}" cy="${cy + 4}" rx="17" ry="20" fill="url(#lipLow)"/>
    <ellipse cx="${cx}" cy="${cy + 4}" rx="10" ry="13" fill="url(#inside)"/>
    <path d="M${cx - 7} ${cy + 12} Q${cx} ${cy + 6} ${cx + 7} ${cy + 12} Q${cx} ${cy + 17} ${cx - 7} ${cy + 12} Z" fill="url(#tongue)"/>
  </g>
  <ellipse cx="${cx - 4}" cy="${cy + 20}" rx="5" ry="2" fill="#ffd9df" filter="url(#shine)"/>`;
  // silly: her own smile with her tongue out under it
  const tongue = `<g filter="url(#soft)">
    <path d="M${cx - 12} ${cy + 6} Q${cx - 14} ${cy + 38} ${cx + 2} ${cy + 40} Q${cx + 17} ${cy + 38} ${cx + 15} ${cy + 6} Z" fill="url(#tongue)"/>
    <path d="M${cx + 1} ${cy + 12} L${cx + 1} ${cy + 30}" stroke="#d65a72" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <ellipse cx="${cx - 4}" cy="${cy + 30}" rx="4" ry="2" fill="#ffe0e6" filter="url(#shine)"/>`;
  return {
    1: mouth,
    2: await raster(defs + laugh),
    3: await raster(defs + wow),
    4: over(mouth, await raster(defs + tongue)),
  };
}

/* --------------------------------------------------------------- the other princesses */
/*
 * Clara: "pode replicar nas outras". The other dresses and hairs are made from hers, so they
 * have the same doll's finish, her shading and her gold: the colours turned, the shapes
 * changed (closer-fitting, short, a mermaid's tail; long hair, a bun).
 */
/** A colour turned to another hue, keeping how light it is (lift brightens the darks). */
function turn(r, g, b, hue, sat, lift = 0) {
  const [, s, l] = hsl(r, g, b);
  const l2 = Math.min(0.95, l + lift * (1 - l) * (1 - l));
  return rgbOf(hue, Math.min(1, s * sat), l2);
}
/** Each pixel of a picture recoloured by what `to` says (or left as it is). */
function recolour(img, to) {
  const o = new Uint8ClampedArray(img);
  for (let i = 0; i < W * H; i++) {
    if (!o[i * 4 + 3]) continue;
    const c = to(o[i * 4], o[i * 4 + 1], o[i * 4 + 2], i % W, (i / W) | 0, i);
    if (c) for (let k = 0; k < 3; k++) o[i * 4 + k] = c[k];
  }
  return o;
}
/** The dark green of her gown (bodice and drapes), the pale mint (sleeves, underskirt). */
const isDarkGreen = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 120 && h <= 185 && l < 0.5 && s > 0.15; };
const isMint = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return ((h >= 65 && h <= 185 && l >= 0.62) || (h >= 88 && h <= 185 && l >= 0.5)) && !isGold(r, g, b); };
/** Where her waist is: above it the bodice, below it the skirt. */
const WAIST = 842;

/** Samples a picture through a mapping from the new place to the old: (x, y) → [sx, sy]. */
function remap(img, from) {
  const o = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = from(x, y);
      if (!p) continue;
      const [sx, sy] = p;
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
      const k = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) o[k + c] = acc[c] / a;
      o[k + 3] = a * 255;
    }
  return o;
}
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/**
 * The pink one: pink bodice and underskirt, purple drapes, and closer to her: the skirt drawn
 * in from below her hands down to its hem.
 */
function pinkDress(dress, skin, axis) {
  const coloured = recolour(dress, (r, g, b, x, y, i) => {
    if (skin[i] || isGold(r, g, b)) return null;
    if (isDarkGreen(r, g, b)) return y < WAIST ? turn(r, g, b, 332, 1.05, 0.55) : turn(r, g, b, 284, 0.85, 0.5);
    if (isMint(r, g, b)) return turn(r, g, b, 334, 1.6, 0.05);
    return null;
  });
  const narrow = (y) => 1 - 0.34 * smooth((y - 930) / 560);
  const fit = (map) => remap(map, (x, y) => [axis + (x - axis) / narrow(y), y]);
  const mask = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (skin[i]) mask[i * 4 + 3] = 255;
  const m2 = fit(mask), sk = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (m2[i * 4 + 3] > 128) sk[i] = 1;
  return { img: fit(coloured), skin: sk };
}

/** The short blue one: blue, and its skirt to her knees, gathered up; her legs and shoes below. */
async function shortDress(dress, skin, axis) {
  const coloured = recolour(dress, (r, g, b, x, y, i) => {
    if (skin[i] || isGold(r, g, b)) return null;
    if (isDarkGreen(r, g, b)) return turn(r, g, b, 214, 1.0, 0.42);
    if (isMint(r, g, b)) return turn(r, g, b, 206, 2.2, 0.0);
    return null;
  });
  // the skirt from just under her hands down to its hem goes in a shorter space: the ruffles
  // and their gold all kept, closer together, and narrower towards the hem
  const TOP = 1000, HEM0 = 1534, HEM = 1235;
  const from = (x, y) => {
    if (y <= TOP) return [x, y];
    const t = (y - TOP) / (HEM - TOP);
    if (t > 1) return null;
    const sy = TOP + t * (HEM0 - TOP);
    const k = 1 - 0.12 * smooth(t);
    return [axis + (x - axis) / k, sy];
  };
  const mask = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (skin[i]) mask[i * 4 + 3] = 255;
  const m2 = remap(mask, from), sk = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (m2[i * 4 + 3] > 128) sk[i] = 1;
  const skirt = remap(coloured, from);
  // her legs and her shoes, as glossy as she is
  const legs = await raster(legsSvg(axis, HEM - 30));
  // (her legs are skin where they show, not under the skirt)
  for (let i = 0; i < W * H; i++) if (legs[i * 4 + 3] > 128 && legs[i * 4 + 2] > 100 && legs[i * 4] > 200 && skirt[i * 4 + 3] < 128) sk[i] = 1;
  return { img: over(skirt, legs), skin: sk };
}
function legsSvg(axis, top) {
  const leg = (dx) => {
    const x = axis + dx;
    return `<path d="M${x - 19} ${top} C${x - 20} ${top + 90} ${x - 15} ${top + 170} ${x - 12} ${top + 225} L${x + 12} ${top + 225} C${x + 15} ${top + 170} ${x + 20} ${top + 90} ${x + 19} ${top} Z" fill="url(#leg)"/>`;
  };
  const shoe = (dx) => {
    const x = axis + dx, y = top + 222;
    return `<path d="M${x - 17} ${y} Q${x - 22} ${y + 26} ${x - 4} ${y + 30} L${x + 14} ${y + 30} Q${x + 30} ${y + 28} ${x + 22} ${y + 10} Q${x + 18} ${y - 2} ${x + 13} ${y} Z" fill="url(#shoe)"/>` +
      `<ellipse cx="${x + 2}" cy="${y + 6}" rx="9" ry="3" fill="#ffffff" opacity="0.55"/>` +
      `<circle cx="${x + 2}" cy="${y + 4}" r="5" fill="url(#bow)"/>`;
  };
  return `<defs>
    <linearGradient id="leg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#e2a078"/><stop offset="0.35" stop-color="#fdc9a3"/><stop offset="0.55" stop-color="#ffd8b8"/><stop offset="1" stop-color="#d9946b"/></linearGradient>
    <linearGradient id="shoe" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7fb6f2"/><stop offset="1" stop-color="#2f6fc0"/></linearGradient>
    <radialGradient id="bow" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#d9a63c"/></radialGradient>
  </defs>` + leg(-34) + leg(34) + shoe(-34) + shoe(34);
}

/** The red mermaid: red bodice and drapes, and under the drapes a mermaid's tail. */
async function mermaidDress(dress, skin, axis) {
  const coloured = recolour(dress, (r, g, b, x, y, i) => {
    if (skin[i] || isGold(r, g, b)) return null;
    if (isDarkGreen(r, g, b)) return turn(r, g, b, 354, 1.25, 0.32);
    if (isMint(r, g, b)) return turn(r, g, b, 350, 1.5, -0.05);
    return null;
  });
  // the drapes and what is above the waist; not the underskirt or its gold
  const keep = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!dress[i * 4 + 3]) continue;
    const y = (i / W) | 0;
    const r = dress[i * 4], g = dress[i * 4 + 1], b = dress[i * 4 + 2];
    if (y < WAIST + 20 || skin[i] || isDarkGreen(r, g, b)) keep[i] = 1;
  }
  const lab = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (!keep[i]) lab[i] = 1;
  const near = distanceTo(lab, (l) => l === 0, 14);
  for (let i = 0; i < W * H; i++) {
    if (keep[i] || !dress[i * 4 + 3]) continue;
    const r = dress[i * 4], g = dress[i * 4 + 1], b = dress[i * 4 + 2];
    if (isGold(r, g, b) && near[i] < 14) keep[i] = 1;
  }
  const top = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (keep[i]) for (let c = 0; c < 4; c++) top[i * 4 + c] = coloured[i * 4 + c];
  keepTouching(top, (x, y) => y < WAIST);
  // the drapes gathered up into a peplum over her hips
  const PEP0 = 930, PEP1 = 1340, PEP = 1180;
  const from = (x, y) => {
    if (y <= PEP0) return [x, y];
    const t = (y - PEP0) / (PEP - PEP0);
    if (t > 1) return null;
    return [axis + (x - axis) / (1 - 0.38 * smooth(t)), PEP0 + t * (PEP1 - PEP0)];
  };
  const peplum = remap(top, from);
  const sk = new Uint8Array(W * H);
  const mask = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) if (skin[i]) mask[i * 4 + 3] = 255;
  const m2 = remap(mask, from);
  for (let i = 0; i < W * H; i++) if (m2[i * 4 + 3] > 128) sk[i] = 1;
  const tail = await raster(tailSvg(axis));
  return { img: over(peplum, tail), skin: sk };
}
function tailSvg(axis) {
  const x = axis, y0 = 930, knee = 1290, fin = 1400;
  const body = `M${x - 132} ${y0} C${x - 140} ${y0 + 150} ${x - 92} ${knee - 90} ${x - 40} ${knee} L${x + 40} ${knee} C${x + 92} ${knee - 90} ${x + 140} ${y0 + 150} ${x + 132} ${y0} Z`;
  // scales: rows of little arcs, each with a light top
  let scales = '';
  for (let r = 0, y = y0 + 40; y < knee - 10; r++, y += 30) {
    const half = 132 - ((y - y0) / (knee - y0)) * 92;
    for (let sx = x - half + (r % 2 ? 16 : 0); sx < x + half - 8; sx += 32)
      scales += `<path d="M${sx} ${y} q16 22 32 0" fill="none" stroke="#7a1022" stroke-width="3" opacity="0.55"/><path d="M${sx + 4} ${y + 4} q12 14 24 0" fill="none" stroke="#ff9aa8" stroke-width="2" opacity="0.5"/>`;
  }
  const finPath = `M${x - 40} ${knee} C${x - 70} ${knee + 60} ${x - 190} ${fin + 70} ${x - 210} ${fin + 120} C${x - 120} ${fin + 108} ${x - 40} ${fin + 120} ${x} ${fin + 80} C${x + 40} ${fin + 120} ${x + 120} ${fin + 108} ${x + 210} ${fin + 120} C${x + 190} ${fin + 70} ${x + 70} ${knee + 60} ${x + 40} ${knee} Z`;
  let ribs = '';
  for (let k = -5; k <= 5; k++) if (k) ribs += `<path d="M${x + k * 4} ${knee + 20} Q${x + k * 22} ${fin + 40} ${x + k * 38} ${fin + 110}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.45"/>`;
  return `<defs>
    <linearGradient id="tail" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8e1426"/><stop offset="0.3" stop-color="#d63a52"/><stop offset="0.5" stop-color="#ef6577"/><stop offset="0.72" stop-color="#d63a52"/><stop offset="1" stop-color="#8e1426"/></linearGradient>
    <linearGradient id="fin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e65a72"/><stop offset="1" stop-color="#ffc2cc"/></linearGradient>
    <linearGradient id="band" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="0.5" stop-color="#e8b54a"/><stop offset="1" stop-color="#a8761f"/></linearGradient>
    <clipPath id="tc"><path d="${body}"/></clipPath>
    <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <path d="${finPath}" fill="url(#fin)"/>${ribs}
  <path d="${body}" fill="url(#tail)"/>
  <g clip-path="url(#tc)" filter="url(#soft)">${scales}</g>
  <rect x="${x - 46}" y="${knee - 8}" width="92" height="20" rx="10" fill="url(#band)"/>
  <circle cx="${x}" cy="${knee + 2}" r="9" fill="#c2183a" stroke="#f6d27a" stroke-width="3"/>`;
}

/* --------------------------------------------------------------- the other hairs */
/** Her red hair in another colour: hue, how strong, and how light (the gold stays). */
function hairColour(img, hue, sat, light, gemHue) {
  return recolour(img, (r, g, b) => {
    if (isGold(r, g, b)) return null;
    if (isGem(r, g, b)) return gemHue == null ? null : turn(r, g, b, gemHue, 1.1, 0.1);
    const [, s, l] = hsl(r, g, b);
    if (s < 0.2 && l > 0.8) return null; // a flower's white
    return rgbOf(hue, Math.min(1, s * sat), Math.max(0, Math.min(0.97, light(l))));
  });
}
/**
 * Long hair: both sides falling in waves like her right side (the side without the braid),
 * and longer, down her back.
 */
function longHair(hair) {
  // her right side (the left of the picture) mirrored onto her left, below her temples
  const both = new Uint8ClampedArray(hair);
  for (let y = 430; y < H; y++)
    for (let x = 512; x < W; x++) {
      const i = y * W + x, m = y * W + (1023 - x);
      const w = smooth((y - 430) / 60);
      for (let c = 0; c < 4; c++) both[i * 4 + c] = hair[i * 4 + c] * (1 - w) + hair[m * 4 + c] * w;
    }
  for (let i = 0; i < W * H; i++) if (FLOWERS.some((f) => inEllipse(i % W, (i / W) | 0, [f[0], f[1], f[2] + 6, f[3] + 6]))) both[i * 4 + 3] = 0;
  // her earrings, kept where they are
  const rings = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    const r = both[i * 4], g = both[i * 4 + 1], b = both[i * 4 + 2];
    // (all of it: its gold, its stone, its shine and its outline; not the hair round it)
    if (both[i * 4 + 3] && y > 535 && y < 668 && (Math.abs(x - 353) < 26 || Math.abs(x - 671) < 26) && !isRedHair(r, g, b)) {
      for (let c = 0; c < 4; c++) rings[i * 4 + c] = both[i * 4 + c];
      both[i * 4 + 3] = 0;
    }
  }
  // and longer: from her cheeks down, the waves fall twice as far, down her back
  const LONG0 = 480;
  let longer = over(rings, remap(both, (x, y) => (y < LONG0 ? [x, y] : [x, LONG0 + (y - LONG0) / 2.1])));
  // and behind her head and neck, the shade of her hair: the hair that was there is lower now
  const tones = [];
  for (let i = 0; i < W * H; i++) if (longer[i * 4 + 3] > 250) tones.push(longer[i * 4] + longer[i * 4 + 1] + longer[i * 4 + 2]);
  tones.sort((p, q) => p - q);
  const dark = tones[Math.floor(tones.length * 0.15)];
  let shade = [0, 0, 0], ns = 0;
  for (let i = 0; i < W * H; i++) if (longer[i * 4 + 3] > 250 && Math.abs(longer[i * 4] + longer[i * 4 + 1] + longer[i * 4 + 2] - dark) < 12) { for (let c = 0; c < 3; c++) shade[c] += longer[i * 4 + c]; ns++; }
  shade = shade.map((v) => v / Math.max(1, ns));
  const backing = new Uint8ClampedArray(W * H * 4);
  for (let y = 440; y < 900; y++)
    for (let x = 300; x < 724; x++) {
      const d = ((x - 512) / 205) ** 2 + ((y - 640) / 230) ** 2;
      if (d > 1) continue;
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) backing[i + c] = shade[c];
      backing[i + 3] = 255 * Math.min(1, (1 - d) * 6);
    }
  const both2 = split2(longer, (x, y) => y < 640 || (y < 700 && Math.abs(x - 512) > 150));
  // (behind her only)
  return { front: both2.front, back: over(both2.back, backing) };
}
/** A head of hair in its two layers: in front of her (where `front`), and behind her. */
function split2(hair, front) {
  const f = new Uint8ClampedArray(hair), b = new Uint8ClampedArray(hair);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!front(x, y - 10)) f[i * 4 + 3] = 0;
    if (front(x, y + 10)) b[i * 4 + 3] = 0;
  }
  return { front: f, back: b };
}

/**
 * A coil of hair: a strip of her own hair (strands running along it) wound round from the
 * middle out, shaded like a round thing lit from the upper left, dark where one turn tucks
 * under the next. Drawn into `into`.
 */
function coil(into, strip, [cx, cy, rx, ry], turns = 3, phase = 0) {
  const { data, w: sw, h: sh } = strip;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const rho = Math.hypot(nx, ny);
      if (rho > 1) continue;
      const th = Math.atan2(ny, nx) + phase;
      const pos = rho * turns - th / (2 * Math.PI);
      const band = pos - Math.floor(pos);
      // along the strand: round the coil; across: across the band
      const along = ((((th / (2 * Math.PI)) % 1) + 1) % 1) * Math.max(1, rho * turns);
      const u = Math.floor(along * sh) % sh;
      const v = Math.floor(band * (sw - 1));
      const k = (u * sw + v) * 3;
      const lit = 0.78 + 0.32 * (1 - rho) - 0.14 * nx - 0.2 * ny;
      const tuck = 0.5 + 0.5 * Math.sin(Math.PI * band);
      const i = (y * W + x) * 4;
      const a = rho > 0.94 ? (1 - rho) / 0.06 : 1;
      for (let q = 0; q < 3; q++) into[i + q] = into[i + q] * (1 - a) + Math.min(255, data[k + q] * lit * tuck) * a;
      into[i + 3] = Math.max(into[i + 3], 255 * a);
    }
  return into;
}
/**
 * A strip of her hair, read along its strands: on the side of her head they run down and
 * to her right, so the strip is read that way (u along them, v across).
 */
function strandStrip(her) {
  const sw = 48, sh = 176;
  const [ox, oy] = [382, 278], along = [-0.5, 0.866], across = [0.866, 0.5];
  const data = new Uint8ClampedArray(sw * sh * 3);
  for (let u = 0; u < sh; u++)
    for (let v = 0; v < sw; v++) {
      const x = Math.round(ox + along[0] * u + across[0] * v), y = Math.round(oy + along[1] * u + across[1] * v);
      for (let c = 0; c < 3; c++) data[(u * sw + v) * 3 + c] = her[(y * W + x) * 4 + c];
    }
  return { data, w: sw, h: sh };
}
/**
 * A bun: her hair swept up off her neck, close round her head, a coil of it on top, and a
 * curl hanging at each temple.
 */
function bunHair(hair, her) {
  const up = new Uint8ClampedArray(hair);
  for (let i = 0; i < W * H; i++) {
    if (!up[i * 4 + 3]) continue;
    const x = i % W, y = (i / W) | 0;
    const r = up[i * 4], g = up[i * 4 + 1], b = up[i * 4 + 2];
    // her tiara stays as it is
    if (y < 320 && (isGold(r, g, b) || isGem(r, g, b))) continue;
    // combed close round her head: nothing further out than a hand's breadth from her skull
    const out = Math.sqrt(((x - 512) / 182) ** 2 + ((y - 452) / 212) ** 2);
    let a = 1 - smooth((out - 1) / 0.06);
    // and drawn up off her neck and her cheeks: below her temples it ends softly
    a *= 1 - smooth((y - 430) / 70);
    up[i * 4 + 3] *= a;
  }
  for (let i = 0; i < W * H; i++) if (FLOWERS.some((f) => inEllipse(i % W, (i / W) | 0, [f[0], f[1], f[2] + 6, f[3] + 6]))) up[i * 4 + 3] = 0;
  // the bun on the crown of her head, with its shadow on her hair under it
  const bun = new Uint8ClampedArray(W * H * 4);
  const shadow = [512, 214, 120, 40];
  for (let y = shadow[1] - shadow[3]; y < shadow[1] + shadow[3]; y++)
    for (let x = shadow[0] - shadow[2]; x < shadow[0] + shadow[2]; x++) {
      const d = ((x - shadow[0]) / shadow[2]) ** 2 + ((y - shadow[1]) / shadow[3]) ** 2;
      if (d > 1) continue;
      const i = (y * W + x) * 4;
      bun[i] = 60; bun[i + 1] = 25; bun[i + 2] = 10; bun[i + 3] = 110 * (1 - d);
    }
  coil(bun, strandStrip(her), [512, 172, 126, 94], 3.2);
  return { front: over(up, bun), back: new Uint8ClampedArray(W * H * 4) };
}
/**
 * Curly hair, curly from the roots: her hair's shape round her face filled with coils, and
 * down past her shoulders.
 */
function curlyHair(hair, her) {
  const strip = strandStrip(her);
  const out = new Uint8ClampedArray(W * H * 4);
  const coils = [];
  for (let row = 0, y = 250; y < 780; y += 36, row++)
    for (let x = 220; x <= 800; x += 40) {
      const dx = x + (row % 2 ? 20 : 0);
      const face = inEllipse(dx, y, [512, 505, 150, 170]) && y > 330;
      const shape = inEllipse(dx, y, [512, 480, 292, 310]) && (y < 520 || Math.abs(dx - 512) > 150);
      if (shape && !face) coils.push([dx, y, 30 + ((dx * 7 + y) % 9), 26 + ((dx + y * 3) % 7)]);
    }
  // back to front: the lower ones lie over the upper ones
  coils.sort((p, q) => p[1] - q[1]);
  for (const [x, y, rx, ry] of coils) coil(out, strip, [x, y, rx, ry], 2.5, (x * 0.37 + y) % 6);
  // her tiara and earrings stay
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    const r = hair[i * 4], g = hair[i * 4 + 1], b = hair[i * 4 + 2];
    if (hair[i * 4 + 3] && (isGold(r, g, b) || isGem(r, g, b)) && (y < 300 || (y > 540 && y < 680))) for (let c = 0; c < 4; c++) out[i * 4 + c] = hair[i * 4 + c];
  }
  return split2(out, (x, y) => y < 640);
}

/* --------------------------------------------------------------- her back */
/**
 * Her back, from Clara's turnaround (reference/v2/green-turnaround.webp, six views of her; the
 * one at the bottom left is her back): lined up with the canvas and turned round, so that
 * the point of her seen from behind is at the same place on this picture as it is on the
 * front one. The 3D princess wears it on her back.
 */
const TURN = { cell: [0, 690, 341, 846], top: 22, bottom: 664, canvasTop: 119, canvasBottom: 1534 };
async function rear() {
  const { data, info } = await sharp(path.join(REF, 'green-turnaround.webp')).raw().toBuffer({ resolveWithObject: true });
  const tw = info.width, c = info.channels;
  const [cx0, cy0, cw, ch] = TURN.cell;
  // the background: light and grey, from the edges of her cell
  const isBg = (x, y) => {
    const i = ((y + cy0) * tw + x + cx0) * c;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= 16 && Math.min(r, g, b) >= 150;
  };
  const bg = new Uint8Array(cw * ch);
  const st = [];
  for (let x = 0; x < cw; x++) st.push(x, (ch - 1) * cw + x);
  for (let y = 0; y < ch; y++) st.push(y * cw, y * cw + cw - 1);
  while (st.length) {
    const k = st.pop();
    if (bg[k]) continue;
    const x = k % cw, y = (k / cw) | 0;
    if (!isBg(x, y)) continue;
    bg[k] = 1;
    if (x > 0) st.push(k - 1);
    if (x < cw - 1) st.push(k + 1);
    if (y > 0) st.push(k - cw);
    if (y < ch - 1) st.push(k + cw);
  }
  // the middle of her head, seen from behind: the middle of the hair in the rows of her head
  let sx = 0, n = 0;
  for (let y = TURN.top + 30; y < TURN.top + 150; y++)
    for (let x = 0; x < cw; x++) if (!bg[y * cw + x]) { sx += x; n++; }
  const mid = sx / n;
  const k = (TURN.canvasBottom - TURN.canvasTop) / (TURN.bottom - TURN.top);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // turned round: her right, on the left of the front picture, is on the right from behind
      const sxp = mid - (x - 512) / k, syp = TURN.top + (y - TURN.canvasTop) / k;
      const x0 = Math.floor(sxp), y0 = Math.floor(syp);
      if (x0 < 0 || y0 < 0 || x0 >= cw - 1 || y0 >= ch - 1) continue;
      const fx = sxp - x0, fy = syp - y0;
      let a = 0;
      const acc = [0, 0, 0];
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const kk = (y0 + dy) * cw + x0 + dx;
        if (bg[kk]) continue;
        const i = ((y0 + dy + cy0) * tw + x0 + dx + cx0) * c;
        a += wt;
        for (let q = 0; q < 3; q++) acc[q] += data[i + q] * wt;
      }
      if (a <= 0.01) continue;
      const o = (y * W + x) * 4;
      for (let q = 0; q < 3; q++) out[o + q] = acc[q] / a;
      out[o + 3] = Math.min(255, a * 255);
    }
  // what is what: her hair (and her tiara and the flowers in her braid), her skin, her dress
  const hair = new Uint8ClampedArray(W * H * 4), dress = new Uint8ClampedArray(W * H * 4);
  const skin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!out[i * 4 + 3]) continue;
    const y = (i / W) | 0;
    const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
    const isHairHere = isRedHair(r, g, b) || (y < 330 && (isGold(r, g, b) || isGem(r, g, b))) || (y < 660 && !isSkin(r, g, b) && !isGem(r, g, b) && hsl(r, g, b)[1] < 0.3);
    const to = isHairHere ? hair : dress;
    for (let q = 0; q < 4; q++) to[i * 4 + q] = out[i * 4 + q];
    if (!isHairHere && isSkin(r, g, b)) skin[i] = 1;
  }
  return { hair, dress, skin };
}

async function save(file, rgba) {
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toFile(file);
}

module.exports = { cutOut, place, save, build, label, L, FACE, REF, W, H, NECK_CUT, hsl, blur };

if (require.main === module)
  (async () => {
    const { img, w, h } = await cutOut('green-front.webp');
    const her = place(img, w, h);
    const dbg = process.argv[2];
    if (dbg) {
      await save(path.join(dbg, 'placed.png'), her);
      const lab = label(her);
      const col = { [L.hair]: [220, 30, 30], [L.eyes]: [30, 30, 230], [L.brow]: [0, 200, 255], [L.mouth]: [255, 0, 200], [L.head | L.skin]: [255, 200, 0], [L.dress | L.skin]: [255, 140, 0], [L.dress]: [0, 150, 0] };
      const o = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const c = col[lab[i]];
        if (!c) continue;
        for (let k = 0; k < 3; k++) o[i * 4 + k] = c[k] * 0.6 + her[i * 4 + k] * 0.4;
        o[i * 4 + 3] = 255;
      }
      await save(path.join(dbg, 'labels.png'), o);
      const b = await build();
      for (const k of ['head', 'eyes', 'brows', 'mouth', 'hairFront', 'hairBack', 'dress']) await save(path.join(dbg, `${k}.png`), b[k]);
      for (const k of [1, 2, 3, 4]) await save(path.join(dbg, `eyes${k}.png`), b.eyeOptions[k]);
      for (const k of [1, 2, 3, 4]) await save(path.join(dbg, `mouth${k}.png`), b.mouthOptions[k]);
      for (const [k, d] of Object.entries(b.dresses)) await save(path.join(dbg, `dress-${k}.png`), d.img);
      for (const [k, d] of Object.entries(b.hairs)) { await save(path.join(dbg, `hair-${k}-front.png`), d.front); await save(path.join(dbg, `hair-${k}-back.png`), d.back); }
      await save(path.join(dbg, 'rear-hair.png'), b.rear.hair);
      await save(path.join(dbg, 'rear-dress.png'), b.rear.dress);
      console.log('axis', b.axis);
    }
    console.log('ok');
  })();

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

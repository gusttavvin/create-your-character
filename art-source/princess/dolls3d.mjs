/**
 * The princesses' dresses and hair in 3D, from Clara's doll pictures of each princess from the
 * front, the side and the back (dolls.cjs lines the three views up on the canvas).
 *
 *   node art-source/princess/dolls3d.mjs [dress|hair] [debug folder]   (needs sharp)
 *
 * Shape. A dress is as wide as the front view says and as deep as the side view says, row by
 * row: each row a rounded section (a sleeve and an arm have their own, as deep as they are
 * wide). Below the waist the skirt is a shell, hollow and open at the hem, as a skirt is; and
 * its overskirt (the drapes, the darker cloth) stands out from the underskirt, so the tiers
 * have their own depth. A head of hair is what all three views agree is hair: where the front
 * view shows her face, the hair is behind it; where the back view shows her back, the hair is
 * not behind it; it is never inside her head or her dress.
 *
 * Painting. Nothing is painted here. The game paints each piece with its three pictures,
 * projected from the front, the side and the back and blended by which way the surface faces
 * (Princess3D.tsx), so the sides are painted from the side view and nothing is stretched.
 * This writes those pictures too: public/princess/<piece>-front3d|side|rear(-<tone>).webp.
 *
 * Coordinates as in model3d.mjs: canvas pixels, x right, y down, z forward; a side picture
 * has her front to the right and x = 512 + z; a back picture is turned round, x = x.
 */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import validator from 'gltf-validator';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

await MeshoptSimplifier.ready;
/**
 * A mesh made lighter: as many triangles as `target` at most, keeping its shape (meshoptimizer);
 * a phone has to draw all four princesses' pieces.
 */
function lighter(geo, target) {
  const idx = new Uint32Array(geo.index.array);
  if (idx.length / 3 <= target) return geo;
  const pos = new Float32Array(geo.attributes.position.array);
  const [kept] = MeshoptSimplifier.simplify(idx, pos, 3, target * 3, 0.01, []);
  // only the corners still used
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const out = [];
  let n = 0;
  for (const v of kept) if (remap[v] < 0) { remap[v] = n++; out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  g.setIndex(Array.from(kept, (v) => remap[v]));
  g.computeVertexNormals();
  return g;
}

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const D = require('./dolls.cjs');
const { W, H, hsl, isPeach, NECK_CUT } = D;

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`; this.onloadend?.(); }); }
};

const PIC = new URL('../../public/princess/', import.meta.url);
const OUT = new URL('../../public/models/princess/', import.meta.url);
const UNIT = 0.0025;
const TONES = { light: [253, 197, 155], tan: [228, 160, 116], brown: [178, 114, 74], dark: [114, 70, 44] };
const BASE_SKIN = [253, 197, 155];
/** Her skull (model3d.mjs's SKULL): hair never goes inside it. */
const SKULL = { cx: 512, cy: 464, rx: 166, ry: 172, rz: 150 };
const skullZ = (x, y) => {
  const f = 1 - ((x - SKULL.cx) / SKULL.rx) ** 2 - ((y - SKULL.cy) / SKULL.ry) ** 2;
  return f > 0 ? SKULL.rz * Math.sqrt(f) : -Infinity;
};

/** Each princess: her ids, her hair's colour, and her overskirt's (the cloth that stands out). */
const isRedHair = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return (h <= 16 || h >= 340) && s > 0.35 && g < 0.55 * r && l < 0.75; };
const PRINCESSES = {
  green: { hairEnd: 1150, hair: 'braids', dress: 'gown', isHair: isRedHair, hollow: true, over: (h, s, l) => h >= 120 && h <= 185 && l < 0.45 },
  pink: { hairEnd: 1080, hair: 'long', dress: 'aline', isHair: D.FACES.pink.hair, hollow: true, over: (h, s, l) => h >= 255 && h <= 300 },
  mermaid: { hairEnd: 900, hair: 'curly', dress: 'mermaid', isHair: D.FACES.mermaid.hair, hollow: false, over: () => false },
  blue: { hairEnd: 760, hair: 'bun', dress: 'star', isHair: (r, g, b, y) => y < 760 && D.FACES.blue.hair(r, g, b), hollow: true, over: (h, s, l) => h >= 195 && h <= 235 && l < 0.66 },
};

/* ------------------------------------------------------------------ pictures */
async function readCanvas(file) {
  const { data } = await sharp(new URL(file, PIC).pathname.replace(/^\/([A-Z]:)/, '$1')).ensureAlpha().resize(W, H).raw().toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
}
async function writeCanvas(file, img) {
  const buf = await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  const p = new URL(file, PIC);
  for (let k = 0; ; k++) {
    try { await fs.writeFile(p, buf); return; } catch (e) { if (k > 20) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
}
const solid = (img, x, y) => {
  const xi = Math.round(x), yi = Math.round(y);
  return xi >= 0 && yi >= 0 && xi < W && yi < H && img[(yi * W + xi) * 4 + 3] > 128;
};
function toned(img, mask, tone) {
  const o = new Uint8ClampedArray(img);
  const k = TONES[tone].map((v, c) => v / BASE_SKIN[c]);
  for (let i = 0; i < W * H; i++) if (mask[i]) for (let c = 0; c < 3; c++) o[i * 4 + c] = img[i * 4 + c] * k[c];
  return o;
}

/**
 * A side or back view split: her hair (and above her neck whatever is not her skin: tiara,
 * earrings), and her dress (from her neck down, what is not hair), each its own picture.
 */
function split(view, P) {
  const hair = new Uint8ClampedArray(W * H * 4), dress = new Uint8ClampedArray(W * H * 4);
  const skin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (view[i * 4 + 3] < 20) continue;
    const y = (i / W) | 0;
    const r = view[i * 4], g = view[i * 4 + 1], b = view[i * 4 + 2];
    const peach = isPeach(r, g, b);
    let to = null;
    // (the deepest shadows between locks are hair too, wherever hair can be: almost black)
    const [, sat, lum] = hsl(r, g, b);
    if (P.isHair(r, g, b, y) || (lum < 0.16 && y < P.hairEnd)) to = hair;
    else if (y < NECK_CUT - 10) to = peach ? null : hair;
    else to = dress;
    if (!to) continue;
    for (let c = 0; c < 4; c++) to[i * 4 + c] = view[i * 4 + c];
    if (to === dress && peach) skin[i] = 1;
  }
  return { hair, dress, skin };
}

/* ------------------------------------------------------------------ shapes */
/** Runs of solid pixels along a row: [[x0, x1], ...]. */
function spans(test, y) {
  const out = [];
  let a = -1;
  for (let x = 0; x <= W; x++) {
    const s = x < W && test(x, y);
    if (s && a < 0) a = x;
    if (!s && a >= 0) { if (x - a >= 3) out.push([a, x - 1]); a = -1; }
  }
  return out;
}
const median = (v) => [...v].sort((p, q) => p - q)[v.length >> 1];
/** Values row by row, evened out: a median then a mean over `r` rows either side. */
function smoothRows(vals, r = 6) {
  const med = vals.map((_, i) => median(vals.slice(Math.max(0, i - r), i + r + 1).filter(Number.isFinite)) ?? NaN);
  return med.map((_, i) => {
    const near = med.slice(Math.max(0, i - r), i + r + 1).filter(Number.isFinite);
    return near.length ? near.reduce((s, v) => s + v, 0) / near.length : NaN;
  });
}

/**
 * The dress as a field: positive inside. Front mask (its 2D picture, and what of her hair lies
 * over it), side mask (her dress in the side view: its front and back edge on each row), the
 * overskirt in the front, side and back pictures (for the tiers' depth).
 */
function dressField(P, front, sideDress, sideHair, overF, overS, overB) {
  const inFront = (x, y) => solid(front, x, y);
  const rows = [];
  let top = H, bottom = 0;
  for (let y = 0; y < H; y++) {
    const sp = spans(inFront, y);
    if (sp.length) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    // the side: how far forward and back her dress reaches on this row
    let zf = -Infinity, zb = Infinity, hairBehind = false;
    for (let u = 0; u < W; u++) {
      if (solid(sideDress, u, y)) { zf = Math.max(zf, u - 512); zb = Math.min(zb, u - 512); }
    }
    if (Number.isFinite(zb)) for (let u = 0; u < 512 + zb - 4; u++) if (solid(sideHair, u, y)) { hairBehind = true; break; }
    // hair over her back in the side view: her back is as far behind as her front is ahead
    if (hairBehind) zb = Math.min(zb, -0.85 * zf);
    rows.push({ sp, zf: Number.isFinite(zf) ? zf : NaN, zb: Number.isFinite(zb) ? zb : NaN });
  }
  const zf = smoothRows(rows.map((r) => r.zf)), zb = smoothRows(rows.map((r) => r.zb));
  // her waist: the narrowest row between her bust and her hips
  let waist = 0, narrow = Infinity;
  for (let y = 720; y < 960; y++) {
    const sp = rows[y].sp;
    if (!sp.length) continue;
    const wdt = sp[sp.length - 1][1] - sp[0][0];
    if (wdt < narrow) { narrow = wdt; waist = y; }
  }
  const P_EXP = 2.4, SHELL = 18, RELIEF = 13;
  const overAt = (x, y, z, dx, dz) => {
    // which picture this point of the surface is painted from
    const wF = Math.max(0, dz) ** 2, wB = Math.max(0, -dz) ** 2, wS = dx * dx;
    const s = wF + wB + wS || 1;
    const at = (img, px) => { const xi = Math.round(px), yi = Math.round(y); return xi >= 0 && xi < W && yi >= 0 && yi < H ? img[yi * W + xi] : 0; };
    return (wF * at(overF, x) + wB * at(overB, x) + wS * at(overS, 512 + z)) / s;
  };
  const field = (x, y, z) => {
    const yi = Math.round(y);
    if (yi < top || yi > bottom) return -50;
    const r = rows[yi];
    let best = -50;
    for (const [a0, a1] of r.sp) {
      const a = (a1 - a0) / 2 + 0.5, cx = (a0 + a1) / 2;
      let zfr = zf[yi], zbr = zb[yi];
      if (!Number.isFinite(zfr) || !Number.isFinite(zbr)) { zfr = a * 0.8; zbr = -a * 0.8; }
      let c = (zfr - zbr) / 2, zc = (zfr + zbr) / 2;
      // a narrow part off to the side (an arm, a leg) is as deep as it is wide
      if (a < 60 && Math.abs(cx - 512) > a) { c = Math.min(c, a * 1.05); zc = Math.min(Math.max(zc, zbr + c), zfr - c); }
      const dx = (x - cx) / a, dz = (z - zc) / c;
      const q = (Math.abs(dx) ** P_EXP + Math.abs(dz) ** P_EXP) ** (1 / P_EXP);
      let f = (1 - q) * Math.min(a, c);
      if (yi > waist + 20) {
        // the overskirt stands out from the underskirt
        const m = overAt(x, y, z, dx, dz);
        f += RELIEF * m;
        // and the skirt is a shell, hollow and open below
        if (P.hollow && yi > waist + 70 && a > 60) f = Math.min(f, SHELL + RELIEF * m - (1 - q) * Math.min(a, c));
      }
      // her shoulders round off at the top of the dress (not a flat edge)
      const fromTop = (yi - top) / 40;
      if (fromTop < 1) f -= 26 * (1 - fromTop) * (1 - fromTop);
      best = Math.max(best, f);
    }
    return best;
  };
  // the front of the dress, for hair to lie behind it
  const frontZ = (x, y) => {
    const yi = Math.round(y);
    if (yi < top || yi > bottom) return -Infinity;
    let z = -Infinity;
    for (const [a0, a1] of rows[yi].sp) {
      if (x < a0 || x > a1) continue;
      const a = (a1 - a0) / 2 + 0.5, cx = (a0 + a1) / 2;
      const zfr = Number.isFinite(zf[yi]) ? zf[yi] : a * 0.8, zbr = Number.isFinite(zb[yi]) ? zb[yi] : -a * 0.8;
      const c = (zfr - zbr) / 2, zc = (zfr + zbr) / 2;
      const t = 1 - Math.abs((x - cx) / a) ** P_EXP;
      if (t > 0) z = Math.max(z, zc + c * t ** (1 / P_EXP));
    }
    return z;
  };
  const backZ = (x, y) => {
    const yi = Math.round(y);
    if (yi < top || yi > bottom) return Infinity;
    let z = Infinity;
    for (const [a0, a1] of rows[yi].sp) {
      if (x < a0 || x > a1) continue;
      const a = (a1 - a0) / 2 + 0.5, cx = (a0 + a1) / 2;
      const zfr = Number.isFinite(zf[yi]) ? zf[yi] : a * 0.8, zbr = Number.isFinite(zb[yi]) ? zb[yi] : -a * 0.8;
      const c = (zfr - zbr) / 2, zc = (zfr + zbr) / 2;
      const t = 1 - Math.abs((x - cx) / a) ** P_EXP;
      if (t > 0) z = Math.min(z, zc - c * t ** (1 / P_EXP));
    }
    return z;
  };
  const zMin = Math.min(...zb.filter(Number.isFinite)) - 20, zMax = Math.max(...zf.filter(Number.isFinite)) + 20;
  return { field, frontZ, backZ, top, bottom, waist, zMin, zMax };
}

/**
 * Her head as a field: her skull, and as wide as her face in the front picture row by row (a
 * doll's round cheeks and jaw), down her neck; never further forward than her skull (her eyes
 * and mouth lie on it, model3d.mjs).
 */
function headField(headPic) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const sp = spans((x, yy) => solid(headPic, x, yy), y);
    if (!sp.length) { rows.push(null); continue; }
    // the widest run (her ears are part of it, or beside it)
    let a0 = sp[0][0], a1 = sp[sp.length - 1][1];
    rows.push([a0, a1]);
  }
  // evened out over the rows (her picture's edge has a hook here and there: an earring, a lock)
  {
    const l = smoothRows(rows.map((r) => (r ? r[0] : NaN)), 12), r = smoothRows(rows.map((r) => (r ? r[1] : NaN)), 12);
    for (let y = 0; y < H; y++) if (rows[y] && Number.isFinite(l[y]) && Number.isFinite(r[y])) rows[y] = [l[y], r[y]];
  }
  const field = (x, y, z) => {
    const s = 1 - ((x - SKULL.cx) / SKULL.rx) ** 2 - ((y - SKULL.cy) / SKULL.ry) ** 2 - (z / SKULL.rz) ** 2;
    let f = s * 60;
    const r = rows[Math.round(y)];
    if (r) {
      const a = (r[1] - r[0]) / 2 + 0.5, cx = (r[0] + r[1]) / 2;
      const sk = 1 - ((y - SKULL.cy) / SKULL.ry) ** 2;
      const front = sk > 0 ? SKULL.rz * Math.sqrt(sk) : a * 0.7;
      const c = Math.min(a * 0.92, front);
      const q = Math.sqrt(((x - cx) / a) ** 2 + (z / c) ** 2);
      // joined to her skull smoothly (a smooth maximum), not with a ledge
      const h = (1 - q) * Math.min(a, c), k = 18;
      const m = Math.max(k - Math.abs(f - h), 0) / k;
      f = Math.max(f, h) + m * m * k * 0.25;
    }
    return f;
  };
  const frontZ = (x, y) => {
    let best = -Infinity;
    for (let z = 200; z > -200; z -= 2) if (field(x, y, z) > 0) { best = z; break; }
    return best;
  };
  return { field, frontZ };
}

/** The hair as a field: what all three views agree is hair (see the top of this file). */
function hairField(hairF, anyF, hairS, anyS, hairB, anyB, dress, head) {
  const front = (x, y, z) => {
    if (solid(hairF, x, y)) return true;
    if (!solid(anyF, x, y)) return false;
    // something else is seen there from the front: the hair may only be behind it
    return z < Math.max(head.frontAt(x, y), dress.frontZ(x, y)) - 14;
  };
  // from the side: where it shows hair; where it shows her face, only hair close round her head
  // (hair seen beside her body from the front is behind her, not on her chest)
  const side = (x, y, z) => solid(hairS, 512 + z, y) || (y < 640 && z < -20 && solid(anyS, 512 + z, y) && head.field(x, y, z) > -40);
  const back = (x, y, z) => {
    if (solid(hairB, x, y)) return true;
    if (!solid(anyB, x, y)) return false;
    return z > Math.min(-skullZ(x, y), dress.backZ(x, y)) + 4;
  };
  // (nor right on it: a hair just under her skin showed through her face)
  const inHead = (x, y, z) => head.field(x, y, z) > -5;
  return (x, y, z) => front(x, y, z) && side(x, y, z) && back(x, y, z) && !inHead(x, y, z) && dress.field(x, y, z) < 2;
}

/* ------------------------------------------------------------------ meshes */
/**
 * A surface out of a field over a box (marching cubes): `value(x, y, z)` positive inside, in
 * pixels (or a 0/1 test, smoothed first), sampled `res` times along the box's longest side.
 */
function surface(value, box, res, { binary = false, smooth = 0, open = 2 } = {}) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0) * 1.04;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const mc = new MarchingCubes(res, new T.MeshBasicMaterial(), false, false, 1500000);
  mc.isolation = 0;
  const f = mc.field;
  const pos = (i) => (i / res - 0.5) * span;
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const x = cx + pos(ix), y = cy + pos(iy), z = cz + pos(iz);
        f[iz * res * res + iy * res + ix] = binary ? (value(x, y, z) ? 1 : 0) : value(x, y, z);
      }
  if (binary) {
    // first thin bits away (a lock seen edge-on in one picture made a thin plate): what is
    // thinner than `open` voxels is taken off, the rest kept as it was (erode, then dilate)
    const N = f.length;
    const step = (src, keep) => {
      const o = new Float32Array(N);
      for (let iz = 1; iz < res - 1; iz++)
        for (let iy = 1; iy < res - 1; iy++)
          for (let ix = 1; ix < res - 1; ix++) {
            const i = iz * res * res + iy * res + ix;
            const nb = [src[i], src[i - 1], src[i + 1], src[i - res], src[i + res], src[i - res * res], src[i + res * res]];
            o[i] = keep === 'min' ? Math.min(...nb) : Math.max(...nb);
          }
      return o;
    };
    let g = new Float32Array(f);
    for (let k = 0; k < open; k++) g = step(g, 'min');
    for (let k = 0; k < open; k++) g = step(g, 'max');
    f.set(g);
    // smoothed, so the surface is round and not in steps: three passes of a 3-wide box blur
    const tmp = new Float32Array(f.length);
    for (let pass = 0; pass < 2; pass++)
      for (const [sx, sy, sz] of [[1, 0, 0], [0, res, 0], [0, 0, res * res]]) {
        const st = sx + sy + sz;
        for (let i = 0; i < f.length; i++) tmp[i] = (f[i - st] ?? f[i]) * 0.25 + f[i] * 0.5 + (f[i + st] ?? f[i]) * 0.25;
        f.set(tmp);
      }
    for (let i = 0; i < f.length; i++) f[i] -= 0.5;
  }
  // a field evened out (a row of a picture can differ from the next: a hand meets the skirt)
  if (smooth) {
    const tmp = new Float32Array(f.length);
    for (let pass = 0; pass < smooth; pass++)
      for (const st of [1, res, res * res]) {
        for (let i = 0; i < f.length; i++) tmp[i] = (f[i - st] ?? f[i]) * 0.25 + f[i] * 0.5 + (f[i + st] ?? f[i]) * 0.25;
        f.set(tmp);
      }
  }
  // the edges of the box are outside
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++)
        if (ix === 0 || iy === 0 || iz === 0 || ix === res - 1 || iy === res - 1 || iz === res - 1) f[iz * res * res + iy * res + ix] = -1;
  mc.update();
  const n = mc.geometry.drawRange.count;
  const arr = mc.geometry.attributes.position.array.slice(0, n * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = cx + (arr[i] * span) / 2;
    arr[i + 1] = cy + (arr[i + 1] * span) / 2;
    arr[i + 2] = cz + (arr[i + 2] * span) / 2;
  }
  // canvas y runs down: turned the right way up (and the triangles' winding with it)
  for (let i = 0; i < arr.length; i += 3) arr[i + 1] = -arr[i + 1];
  for (let i = 0; i < arr.length; i += 9)
    for (let j = 0; j < 3; j++) { const t = arr[i + 3 + j]; arr[i + 3 + j] = arr[i + 6 + j]; arr[i + 6 + j] = t; }
  mc.geometry.dispose();
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
  const welded = mergeVertices(g, 0.01);
  welded.deleteAttribute('normal');
  welded.computeVertexNormals();
  return welded;
}

const materials = new Map();
function material(name, colour) {
  if (!materials.has(name)) {
    const m = new T.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0 });
    m.name = name;
    materials.set(name, m);
  }
  return materials.get(name);
}
async function writeGlb(name, group, meta, catalogue, reports) {
  group.traverse((o) => {
    if (o.isMesh) { o.geometry.translate(-512, 1536, 0); o.geometry.scale(UNIT, UNIT, UNIT); }
  });
  const data = await new GLTFExporter().parseAsync(group, { binary: true, trs: true });
  for (let k = 0; ; k++) {
    try { await fs.writeFile(new URL(`${name}.glb`, OUT), Buffer.from(data)); break; } catch (e) { if (k > 30) throw e; await new Promise((r) => setTimeout(r, 400)); }
  }
  const v = await validator.validateBytes(new Uint8Array(data), { maxIssues: 20 });
  let tris = 0;
  group.traverse((o) => { if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  reports.push({ piece: name, bytes: data.byteLength, triangles: Math.round(tris), errors: v.issues.numErrors, warnings: v.issues.numWarnings });
  if (v.issues.numErrors) throw new Error(`${name}: ${JSON.stringify(v.issues)}`);
  catalogue[name.replace('-', ':')] = { url: `models/princess/${name}.glb`, group: group.name, ...meta };
  console.log(name.padEnd(16), String(data.byteLength).padStart(8), String(Math.round(tris)).padStart(7));
}

/* ------------------------------------------------------------------ all of it */
const only = process.argv[2];
const dbg = process.argv[3];
const catalogue = {};
const reports = [];
for (const [name, P] of Object.entries(PRINCESSES)) {
  const v = await D.views(name);
  const side = split(v.side, P), back = split(v.back, P);
  // her front: her 2D pieces (dress light, and her hair's two layers together)
  const dressF = await readCanvas(`dress-${P.dress}-light.webp`);
  const hf = await readCanvas(`hair-${P.hair}-front.webp`), hb = await readCanvas(`hair-${P.hair}-back.webp`);
  const hairF = new Uint8ClampedArray(hb);
  for (let i = 0; i < W * H; i++) {
    const a = hf[i * 4 + 3] / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) hairF[i * 4 + c] = hf[i * 4 + c] * a + hairF[i * 4 + c] * (1 - a);
    hairF[i * 4 + 3] = Math.max(hairF[i * 4 + 3], hf[i * 4 + 3]);
  }
  // (not where her face is: the back layer is filled in behind her head, which seen from the
  // front is her face)
  const headPic0 = await readCanvas(`head-${P.hair}-light.webp`);
  for (let i = 0; i < W * H; i++) if (headPic0[i * 4 + 3] > 128 && hf[i * 4 + 3] < 128) hairF[i * 4 + 3] = 0;
  // the overskirt in each picture
  const overOf = (img) => {
    const m = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (img[i * 4 + 3] < 128) continue;
      const [h, s, l] = hsl(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
      if (P.over(h, s, l)) m[i] = 1;
    }
    // soft at its edge, as cloth folds over
    for (let pass = 0; pass < 3; pass++) {
      const t = new Float32Array(m);
      for (let i = W + 1; i < W * H - W - 1; i++) m[i] = (t[i - 1] + t[i + 1] + t[i - W] + t[i + W] + 2 * t[i]) / 6;
    }
    return m;
  };
  const dress = dressField(P, dressF, side.dress, side.hair, overOf(dressF), overOf(side.dress), overOf(back.dress));
  // the pictures the game paints with
  const anyMask = (img) => img;
  for (const tone of Object.keys(TONES)) {
    await writeCanvas(`dress-${P.dress}-side-${tone}.webp`, toned(side.dress, side.skin, tone));
    await writeCanvas(`dress-${P.dress}-rear-${tone}.webp`, toned(back.dress, back.skin, tone));
  }
  await writeCanvas(`hair-${P.hair}-front3d.webp`, hairF);
  await writeCanvas(`hair-${P.hair}-side.webp`, side.hair);
  await writeCanvas(`hair-${P.hair}-rear.webp`, back.hair);
  if (dbg) for (const [k, img] of Object.entries({ sideHair: side.hair, sideDress: side.dress, backHair: back.hair, backDress: back.dress })) await D.save(`${dbg}/${name}-${k}.png`, img);

  if (!only || only === 'dress') {
    const g = lighter(surface(dress.field, [140, dress.top - 6, dress.zMin, 884, dress.bottom + 6, dress.zMax], 200, { smooth: 2 }), 70000);
    const root = new T.Group();
    root.name = `dress_${P.dress}`;
    const mesh = new T.Mesh(g, material('Proj_dress', '#ffffff'));
    mesh.name = 'body';
    root.add(mesh);
    await writeGlb(`dress-${P.dress}`, root, { projected: true, waist: dress.waist }, catalogue, reports);
  }
  const headPic = await readCanvas(`head-${P.hair}-light.webp`);
  const head = headField(headPic);
  {
    const grid = new Float32Array((W / 4) * (H / 4)).fill(-Infinity);
    for (let gy = 0; gy < H / 4; gy++) for (let gx = 0; gx < W / 4; gx++) grid[gy * (W / 4) + gx] = gy * 4 > 720 ? -Infinity : head.frontZ(gx * 4, gy * 4);
    head.frontAt = (x, y) => { const gx = Math.round(x / 4), gy = Math.round(y / 4); return gx >= 0 && gy >= 0 && gx < W / 4 && gy < H / 4 ? grid[gy * (W / 4) + gx] : -Infinity; };
  }
  if (!only || only === 'head') {
    // her skin, plain, for the sides and back of her head: her face without its features
    const plain = new Uint8ClampedArray(headPic);
    {
      const num = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)], den = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) if (headPic[i * 4 + 3] > 200) { den[i] = 1; for (let c = 0; c < 3; c++) num[c][i] = headPic[i * 4 + c]; }
      const box = (a, r) => { const t = new Float32Array(a.length); for (let pass = 0; pass < 3; pass++) { for (let y = 0; y < H; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += a[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { t[y * W + x] = acc / (2 * r + 1); acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } } for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { a[y * W + x] = acc / (2 * r + 1); acc += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } } } };
      for (const p of [...num, den]) box(p, 30);
      for (let i = 0; i < W * H; i++) { if (den[i] < 1e-3) continue; for (let c = 0; c < 3; c++) plain[i * 4 + c] = num[c][i] / den[i]; plain[i * 4 + 3] = 255; }
    }
    for (const tone of Object.keys(TONES)) await writeCanvas(`head-${P.hair}-skin-${tone}.webp`, toned(plain, new Uint8Array(W * H).fill(1), tone));
    const g = lighter(surface(head.field, [300, 250, -200, 724, 700, 200], 150, { smooth: 2 }), 25000);
    const root = new T.Group();
    root.name = `head_${P.hair}`;
    const mesh = new T.Mesh(g, material('Proj_head', '#ffffff'));
    mesh.name = 'head';
    root.add(mesh);
    await writeGlb(`head-${P.hair}`, root, { projected: true }, catalogue, reports);
  }
  if (!only || only === 'hair') {
    const test = hairField(hairF, anyMask(v.front), side.hair, v.side, back.hair, v.back, dress, head);
    // the box round her hair in all three views
    let x0 = W, x1 = 0, y0 = H, y1 = 0, z0 = Infinity, z1 = -Infinity;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (solid(hairF, x, y) || solid(back.hair, x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        if (solid(side.hair, x, y)) { z0 = Math.min(z0, x - 512); z1 = Math.max(z1, x - 512); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
    const g = lighter(surface(test, [x0 - 8, y0 - 8, z0 - 8, x1 + 8, y1 + 8, z1 + 8], 200, { binary: true, open: 1 }), 60000);
    const root = new T.Group();
    root.name = `hair_${P.hair}`;
    const mesh = new T.Mesh(g, material('Proj_hair', '#ffffff'));
    mesh.name = 'hair';
    root.add(mesh);
    await writeGlb(`hair-${P.hair}`, root, { projected: true }, catalogue, reports);
  }
}
const libFile = new URL('../../src/characters/princess/model-library.json', import.meta.url);
const lib = JSON.parse(await fs.readFile(libFile, 'utf8'));
Object.assign(lib.pieces, catalogue);
await fs.writeFile(libFile, JSON.stringify(lib));
await fs.writeFile(new URL('../../docs/princess-dolls-validation.json', import.meta.url), JSON.stringify(reports, null, 2));

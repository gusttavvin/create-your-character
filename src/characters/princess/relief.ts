import * as THREE from 'three';
import { CANVAS } from './pieces';

/**
 * Turns the princess's flat pictures into solids.
 *
 * The 2D princess is a stack of pictures cut from Clara's four princesses, and Clara asked for
 * the 3D one to be the same princess. So nothing here is drawn again: every solid is made from
 * the outline of a picture and wears that picture on its front, which from the front is the
 * flat princess exactly. What 3D adds is depth, and the depth comes from how wide each part
 * of the outline is right there (loft): every row of it is a round slice, so a gown is a bell,
 * an arm or a leg a tube and a head round. A thin piece stays thin and a wide one gets wide,
 * where blowing the whole outline up by one amount made puffed-up stickers, which is what
 * Clara turned down on the monster; and where the depth came from the biggest circles that fit
 * inside the outline, the gown closed under her like an egg instead of hanging like a bell.
 *
 * Heights are kept on a grid, one point every G pixels of the 1024 by 1536 picture.
 */
export const G = 4;
export const NX = Math.floor(CANVAS.w / G) + 1;
export const NY = Math.floor(CANVAS.h / G) + 1;
/** World units per pixel of the picture: she stands about 3.8 units tall. */
export const U = 0.0025;

export type Grid = Float32Array;
export type Mask = Uint8Array;

/* ------------------------------------------------------------------ pictures */

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
    images.set(url, p);
    // a failed picture is not remembered, so it is tried again next time
    p.catch(() => images.delete(url));
  }
  return p;
}

export function newCanvas(w = CANVAS.w, h = CANVAS.h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
}

/** The pictures drawn one over the other, as the sheet stacks them. */
export function stack(layers: (HTMLImageElement | HTMLCanvasElement | null | undefined)[]) {
  const { canvas, ctx } = newCanvas();
  for (const img of layers) if (img) ctx.drawImage(img, 0, 0, CANVAS.w, CANVAS.h);
  return canvas;
}

/**
 * Every outline also keeps the picture's own edge, pixel by pixel, so a solid's rim can be
 * laid exactly on it rather than on the grid's steps.
 */
const edges = new WeakMap<Mask, Uint8Array>();

/** Where a picture is solid, on the grid. */
export function maskOf(canvas: HTMLCanvasElement): Mask {
  const { data } = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, CANVAS.w, CANVAS.h);
  const alpha = new Uint8Array(CANVAS.w * CANVAS.h);
  for (let k = 0; k < alpha.length; k++) alpha[k] = data[k * 4 + 3];
  const m = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) {
    const y = Math.min(CANVAS.h - 1, j * G);
    for (let i = 0; i < NX; i++) {
      const x = Math.min(CANVAS.w - 1, i * G);
      if (alpha[y * CANVAS.w + x] > 127) m[j * NX + i] = 1;
    }
  }
  edges.set(m, alpha);
  return m;
}

export function union(...masks: (Mask | null)[]): Mask {
  const out = new Uint8Array(NX * NY);
  const alpha = new Uint8Array(CANVAS.w * CANVAS.h);
  for (const m of masks) {
    if (!m) continue;
    for (let k = 0; k < out.length; k++) out[k] |= m[k];
    const a = edges.get(m);
    if (a) for (let k = 0; k < alpha.length; k++) if (a[k] > alpha[k]) alpha[k] = a[k];
  }
  edges.set(out, alpha);
  return out;
}

export function above(mask: Mask, yPx: number): Mask {
  const out = mask.slice();
  out.fill(0, Math.min(out.length, Math.ceil(yPx / G) * NX));
  const a = edges.get(mask);
  if (a) {
    const cut = a.slice();
    cut.fill(0, Math.min(cut.length, Math.ceil(yPx / G) * G * CANVAS.w));
    edges.set(out, cut);
  }
  return out;
}

/**
 * Where a grid point just outside an outline should sit: on the picture's edge, found by
 * walking from it towards the solid neighbours it borders. Pixels.
 */
function onEdge(mask: Mask, i: number, j: number): [number, number, number] | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  let near = -1;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ii = i + di;
      const jj = j + dj;
      if ((!di && !dj) || ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue;
      const kk = jj * NX + ii;
      if (!mask[kk]) continue;
      sx += di;
      sy += dj;
      n++;
      if (near < 0 || !di || !dj) near = kk;
    }
  }
  if (!n) return null;
  const len = Math.hypot(sx, sy) || 1;
  const dx = sx / len;
  const dy = sy / len;
  const alpha = edges.get(mask);
  const x0 = i * G;
  const y0 = j * G;
  let t = G * 0.5;
  if (alpha) {
    for (let step = 0; step <= G * 1.5; step += 0.5) {
      const x = Math.round(x0 + dx * step);
      const y = Math.round(y0 + dy * step);
      if (x < 0 || y < 0 || x >= CANVAS.w || y >= CANVAS.h) continue;
      if (alpha[y * CANVAS.w + x] > 127) {
        t = step;
        break;
      }
    }
  }
  return [x0 + dx * t, y0 + dy * t, near];
}

/* ------------------------------------------------------------------ depth */

/**
 * A solid, as depths over the grid: how far the surface stands out from the middle at every
 * point (grid units), and where on the picture each point takes its colour from.
 */
export interface Relief {
  depth: Grid;
  /** The picture's pixel each grid point wears, across and down. */
  ux: Float32Array;
  uy: Float32Array;
}

/** How the solid rounds off over its top and bottom edges (grid units: 32 pixels). */
const ROUND_OFF = 8;
/** The last few pixels of an outline are its ink: the sides wear the colour just inside it. */
const INSET = 9 / G;

/**
 * A solid made slice by slice, like turning on a lathe: every row of the outline, wherever it
 * is solid, is a round slice as deep as it is wide. So a ball gown is a bell from any side, a
 * neck or an arm a tube, a head round. Where a slice is much wider than the piece is tall there
 * (a tail fin, a tiara), it is kept no deeper than the piece is tall. Over the top and bottom
 * edges the slices round off, so a hem or the top of a head closes in a curve instead of
 * ending in a cut.
 *
 * Seen from the side, the edge of a picture would be stretched round the whole curve: the ink
 * line and the edge colour drawn out into stripes. So the sides wear the colour just inside
 * the outline, and the line round her is drawn by the 3D itself (see inked in build3d.ts).
 */
export function loft(outline: Mask, { close = 0, passes = 3 }: { close?: number; passes?: number } = {}): Relief {
  // locks and curls a little apart are one mass of hair: closed up first, so the slices run
  // across the whole of it instead of starting again at every gap
  const mask = close ? closed(outline, close) : outline;
  const depth = new Float32Array(NX * NY);
  const ux = new Float32Array(NX * NY);
  const uy = new Float32Array(NX * NY);
  // across: the round slice of each run of solid in a row
  for (let j = 0; j < NY; j++) {
    let i = 0;
    while (i < NX) {
      if (!mask[j * NX + i]) {
        i++;
        continue;
      }
      let e = i;
      while (e + 1 < NX && mask[j * NX + e + 1]) e++;
      const half = (e - i + 1) / 2;
      const mid = (i + e) / 2;
      const keep = Math.max(0, half - Math.min(Math.max(INSET, half * 0.07), half * 0.5));
      for (let x = i; x <= e; x++) {
        const k = j * NX + x;
        const off = x - mid;
        depth[k] = Math.sqrt(Math.max(0, half * half - off * off));
        ux[k] = (mid + Math.max(-keep, Math.min(keep, off))) * G;
      }
      i = e + 1;
    }
  }
  // down: no deeper than the piece is tall there, and rounded over its top and bottom
  for (let i = 0; i < NX; i++) {
    let j = 0;
    while (j < NY) {
      if (!mask[j * NX + i]) {
        uy[j * NX + i] = j * G;
        j++;
        continue;
      }
      let e = j;
      while (e + 1 < NY && mask[(e + 1) * NX + i]) e++;
      const half = (e - j + 1) / 2;
      const mid = (j + e) / 2;
      const keep = Math.max(0, half - Math.min(Math.max(INSET, half * 0.07), half * 0.5));
      for (let y = j; y <= e; y++) {
        const k = y * NX + i;
        const t = Math.min(y - j + 0.5, e - y + 0.5) / ROUND_OFF;
        const ease = t >= 1 ? 1 : Math.sqrt(t * (2 - t));
        depth[k] = Math.min(depth[k], half) * ease;
        uy[k] = (mid + Math.max(-keep, Math.min(keep, y - mid))) * G;
      }
      j = e + 1;
    }
  }
  // where a run splits or joins (an arm leaving the bodice) the slices change size at once;
  // a few soft passes down and one across even out the step
  let d: Grid = depth;
  for (let n = 0; n < passes; n++) d = soften(d, mask, 0, 2);
  d = soften(d, mask, 1, 1);
  return { depth: d, ux, uy };
}

/** The outline with gaps narrower than 2r grown shut (a dilation, then an erosion). */
function closed(mask: Mask, r: number): Mask {
  const grow = (m: Mask, keep: 0 | 1) => {
    // keep 1: a point is solid if any neighbour within r is; keep 0: only if all are
    const across = new Uint8Array(m.length);
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        let v = keep ? 0 : 1;
        for (let d = -r; d <= r; d++) {
          const ii = Math.min(NX - 1, Math.max(0, i + d));
          const s = m[j * NX + ii];
          if (keep ? s : !s) {
            v = keep;
            break;
          }
        }
        across[j * NX + i] = v;
      }
    }
    const out = new Uint8Array(m.length);
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        let v = keep ? 0 : 1;
        for (let d = -r; d <= r; d++) {
          const jj = Math.min(NY - 1, Math.max(0, j + d));
          const s = across[jj * NX + i];
          if (keep ? s : !s) {
            v = keep;
            break;
          }
        }
        out[j * NX + i] = v;
      }
    }
    return out;
  };
  return grow(grow(mask, 1), 0);
}

/** The average over a little window (rx across, ry down), inside the outline only. */
function soften(h: Grid, mask: Mask, rx: number, ry: number): Grid {
  const out = new Float32Array(h.length);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (!mask[k]) continue;
      let s = 0;
      let n = 0;
      for (let dj = -ry; dj <= ry; dj++) {
        for (let di = -rx; di <= rx; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue;
          const kk = jj * NX + ii;
          if (!mask[kk]) continue;
          s += h[kk];
          n++;
        }
      }
      // the rim itself is laid on the picture's edge by the sheet, so the depth here can be
      // evened out freely; holding it back left the dips between rows as grooves
      out[k] = n ? s / n : h[k];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ round parts */

/** Exact distance from every point to the nearest point outside (Felzenszwalb's two passes). */
function distance(mask: Mask): Grid {
  const INF = 1e12;
  const f = new Float64Array(NX * NY);
  for (let k = 0; k < f.length; k++) f[k] = mask[k] ? INF : 0;
  const n = Math.max(NX, NY);
  const line = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const pass = (len: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (line[q] + q * q - (line[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (line[q] + q * q - (line[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) ** 2 + line[v[k]];
    }
  };
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) line[j] = f[j * NX + i];
    pass(NY);
    for (let j = 0; j < NY; j++) f[j * NX + i] = out[j];
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) line[i] = f[j * NX + i];
    pass(NX);
    for (let i = 0; i < NX; i++) f[j * NX + i] = out[i];
  }
  const d = new Float32Array(NX * NY);
  for (let k = 0; k < d.length; k++) d[k] = Math.sqrt(f[k]);
  return d;
}

/**
 * A round part (her head on its neck), as the skin over a ball for each of the biggest circles
 * that fit inside its outline: the head is one ball and the neck a row of small ones. Sliced
 * like the gown, the head came out a disc with a flat plate under the chin where the slices
 * jumped from her head to her neck. Same shape of answer as loft (the colour each point wears
 * is its own; a head has no stretched sides worth hiding — the ink line goes round it).
 */
export function ball(mask: Mask): Relief {
  const d = distance(mask);
  const h = new Float32Array(NX * NY);
  const centres: number[] = [];
  for (let j = 1; j < NY - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      const r = d[k];
      if (r < 1) continue;
      if ((r >= d[k - 1] && r >= d[k + 1]) || (r >= d[k - NX] && r >= d[k + NX])) centres.push(k);
    }
  }
  centres.sort((a, b) => d[b] - d[a]);
  for (const c of centres) {
    const r = d[c];
    // a ball whose top is already under a bigger one adds nothing
    if (h[c] >= r * 0.985) continue;
    const ci = c % NX;
    const cj = (c - ci) / NX;
    const R = Math.floor(r);
    const r2 = r * r;
    for (let j = Math.max(0, cj - R); j <= Math.min(NY - 1, cj + R); j++) {
      const dy2 = (j - cj) ** 2;
      for (let i = Math.max(0, ci - R); i <= Math.min(NX - 1, ci + R); i++) {
        const dd = r2 - dy2 - (i - ci) ** 2;
        if (dd <= 0) continue;
        const k = j * NX + i;
        if (!mask[k]) continue;
        const v = Math.sqrt(dd);
        if (v > h[k]) h[k] = v;
      }
    }
  }
  let out: Grid = h;
  for (let n = 0; n < 2; n++) out = soften(out, mask, 1, 1);
  const ux = new Float32Array(NX * NY);
  const uy = new Float32Array(NX * NY);
  for (let k = 0; k < ux.length; k++) {
    ux[k] = (k % NX) * G;
    uy[k] = Math.floor(k / NX) * G;
  }
  return { depth: out, ux, uy };
}


/* ------------------------------------------------------------------ meshes */

/**
 * One face of a solid: the grid points inside an outline, at the height `z` gives them (grid
 * units, + towards us), facing us (`front`) or away, wearing the picture where `wear` says. A cell is kept when any corner is inside;
 * the picture's own edge (alpha test) cuts the outline exactly, so it is the picture's edge
 * that shows, not the grid's steps.
 */
export function sheet(
  mask: Mask,
  z: (k: number) => number,
  front: boolean,
  opts: {
    area?: [number, number, number, number];
    wear?: Relief;
    /** How deep the rim lies, from the solid point beside it: by default on the middle (0). */
    rim?: (k: number) => number;
  } = {},
) {
  const { area, wear, rim } = opts;
  const [x0, y0, x1, y1] = area
    ? [Math.max(0, Math.floor(area[0] / G)), Math.max(0, Math.floor(area[1] / G)), Math.min(NX - 1, Math.ceil(area[2] / G)), Math.min(NY - 1, Math.ceil(area[3] / G))]
    : [0, 0, NX - 1, NY - 1];
  const index = new Int32Array(NX * NY).fill(-1);
  const pos: number[] = [];
  const uv: number[] = [];
  const inset: number[] = [];
  const tri: number[] = [];
  const vertex = (i: number, j: number) => {
    const k = j * NX + i;
    if (index[k] < 0) {
      index[k] = pos.length / 3;
      let px = i * G;
      let py = j * G;
      let depth = z(k);
      let wearAt = k;
      // a corner just outside the outline is pulled onto the picture's edge, and wears the
      // colour of the solid point beside it: the rim is the picture's own outline, not the
      // grid's steps, and seen from the side it is not a seam of ink down her middle
      if (wear && !mask[k] && !area) {
        const e = onEdge(mask, i, j);
        if (e) {
          [px, py, wearAt] = e;
          depth = rim ? rim(wearAt) : 0;
        }
      }
      pos.push((px - CANVAS.w / 2) * U, (CANVAS.h / 2 - py) * U, depth * G * U);
      // the picture's own pixel, for what faces us, and the one just inside the outline, for
      // what faces sideways (the material chooses between them)
      uv.push(px / CANVAS.w, 1 - py / CANVAS.h);
      const x = wear && mask[wearAt] ? wear.ux[wearAt] : px;
      const y = wear && mask[wearAt] ? wear.uy[wearAt] : py;
      inset.push(x / CANVAS.w, 1 - y / CANVAS.h);
    }
    return index[k];
  };
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      const k = j * NX + i;
      const inside = area ? true : mask[k] || mask[k + 1] || mask[k + NX] || mask[k + NX + 1];
      if (!inside) continue;
      const a = vertex(i, j);
      const b = vertex(i + 1, j);
      const c = vertex(i, j + 1);
      const d = vertex(i + 1, j + 1);
      if (front) tri.push(a, c, b, b, c, d);
      else tri.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('inset', new THREE.Float32BufferAttribute(inset, 2));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  return geo;
}

/** A picture as a texture for a solid's face. */
export function textureOf(source: HTMLCanvasElement | HTMLImageElement) {
  const t = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

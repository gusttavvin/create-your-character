/**
 * Models the princess in 3D, piece by piece, from the same pictures the flat princess is made
 * of (public/princess/*.webp, cut from Clara's four princesses by cut.cjs).
 *
 *   npm run models:princess      (needs sharp:  npm i --no-save sharp@0.33.5)
 *
 * Writes public/models/princess/<row>-<id>.glb for every piece (one head for every skin, since
 * the skin is a picture put on at run time), src/characters/princess/model-library.json (what
 * each file holds, and the front and back of every dress, measured, for hair to lie on) and
 * docs/princess-model-validation.json (the glTF validator's report).
 *
 * The monster and the dragon are modelled from drawings; the princess's pictures have no
 * paths, so each is first turned into an outline (marching squares on its alpha) and then into
 * solids the way the dragon's are: a dress is turned on a lathe, slice by slice, as deep as its
 * own shape says (a ball gown a bell, a mermaid's tail round, her fluke a fin); her head is a
 * skull with her ears on it; arms and legs are tubes; hair is a plump rounded mass that wraps
 * her skull and stops at her face; a tiara and an earring are thin rounded solids. Eyes, brows
 * and mouth are laid on the skull. Nothing is drawn again: every solid wears its own picture on
 * the side that faces the front (the game puts the picture on, in the skin the child chose) and
 * a flat colour everywhere else, which is what a toy of her would look like.
 *
 * Coordinates: the pictures are 1024 by 1536 with y down. Every piece keeps its place in its
 * picture, so the pieces line up with nothing more: x is (x - 512) * UNIT, y is (1536 - y) *
 * UNIT, and z is forward.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import validator from 'gltf-validator';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('needs sharp:  npm i --no-save sharp@0.33.5');
  process.exit(1);
}

globalThis.FileReader = class {
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((r) => {
      this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const HERE = new URL('./', import.meta.url);
const PIC = new URL('../../public/princess/', import.meta.url);
const OUT = new URL('../../public/models/princess/', import.meta.url);
await fs.mkdir(OUT, { recursive: true });

const W = 1024;
const H = 1536;
/** Metres per pixel: she stands about 3.8 units tall. */
const UNIT = 0.0025;

const DRESSES = ['gown', 'aline', 'mermaid', 'star'];
const HAIRS = ['braids', 'long', 'curly', 'bun'];
const EYES = ['sparkly', 'happy', 'wink', 'sleepy'];
const MOUTHS = ['smile', 'laugh', 'oh', 'tongue'];

/** The flat colours her solids wear where the picture does not reach (sides and backs). */
const COLOUR = {
  skin: '#fdc59b',
  hair: { braids: '#a52e17', long: '#7a4626', curly: '#1b2036', bun: '#e6bf55' },
  cloth: { gown: '#1f7a4c', aline: '#9b4fbf', mermaid: '#c8283e', star: '#3f7fd0' },
  gold: '#d9a63c',
};

/**
 * Her skull, measured on the head picture: from y = 293 to her chin near y = 635, 166 pixels
 * either side of the middle at its widest, an egg nearly as deep as it is wide.
 */
const SKULL = { cx: 512, cy: 464, rx: 166, ry: 172, rz: 150 };
const skullZ = (x, y) => {
  const f = 1 - ((x - SKULL.cx) / SKULL.rx) ** 2 - ((y - SKULL.cy) / SKULL.ry) ** 2;
  return f > 0 ? SKULL.rz * Math.sqrt(f) : 0;
};
/** Where her chin ends and her neck begins. */
const CHIN = 622;

/* ------------------------------------------------------------------ pictures */
const pictures = new Map();
async function picture(name) {
  if (pictures.has(name)) return pictures.get(name);
  const { data } = await sharp(path.join(PIC.pathname.replace(/^\/([A-Z]:)/, '$1'), `${name}.webp`))
    .ensureAlpha()
    .resize(W, H)
    .raw()
    .toBuffer({ resolveWithObject: true });
  pictures.set(name, data);
  return data;
}
/** Where a picture is solid: 1 inside, 0 outside. */
function maskOf(data, keep = () => true) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 127 && keep(x, y)) m[y * W + x] = 1;
  return m;
}
const maskWhere = (keep) => {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (keep(x, y)) m[y * W + x] = 1;
  return m;
};
const and = (a, b) => a.map((v, k) => v & b[k]);
const or = (a, b) => a.map((v, k) => v | b[k]);
const not = (a, b) => a.map((v, k) => v & (1 - b[k]));
function dilate(m, r) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++)
        for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) out[yy * W + xx] = 1;
    }
  return out;
}
function count(m) {
  let n = 0;
  for (const v of m) n += v;
  return n;
}
/** The connected pieces of a mask, largest first. */
function components(m, min = 60) {
  const seen = new Uint8Array(m.length);
  const out = [];
  const stack = [];
  for (let k = 0; k < m.length; k++) {
    if (!m[k] || seen[k]) continue;
    const comp = new Uint8Array(m.length);
    let n = 0;
    stack.push(k);
    seen[k] = 1;
    while (stack.length) {
      const q = stack.pop();
      comp[q] = 1;
      n++;
      const x = q % W;
      for (const d of [q - 1, q + 1, q - W, q + W]) {
        if (d < 0 || d >= m.length || !m[d] || seen[d]) continue;
        if ((d === q - 1 && x === 0) || (d === q + 1 && x === W - 1)) continue;
        seen[d] = 1;
        stack.push(d);
      }
    }
    if (n >= min) out.push({ mask: comp, n });
  }
  return out.sort((a, b) => b.n - a.n).map((c) => c.mask);
}

/* ------------------------------------------------------------------ outlines */
/**
 * The outline of a mask: its boundary walked along the pixel edges and simplified. Outer
 * loops run clockwise on the picture, holes the other way. Walked on a 2 pixel grid: fine
 * enough for a curl, and the loops stay short.
 */
function outlineOf(mask) {
  const S = 2;
  const w = W / S;
  const h = H / S;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * S * W + x * S]);
  // (a corner where two pieces touch only diagonally has two edges leaving it: both are kept,
  // or one was overwritten, the walk lost its way and a whole piece — the mermaid's left drape —
  // dropped out of the outline)
  const edges = new Map();
  const key = (x, y) => y * (w + 1) + x;
  const edge = (a, b) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a).push(b);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) edge(key(x, y), key(x + 1, y));
      if (!at(x + 1, y)) edge(key(x + 1, y), key(x + 1, y + 1));
      if (!at(x, y + 1)) edge(key(x + 1, y + 1), key(x, y + 1));
      if (!at(x - 1, y)) edge(key(x, y + 1), key(x, y));
    }
  const loops = [];
  while (edges.size) {
    const [start] = edges.keys();
    const pts = [];
    let k = start;
    while (edges.has(k)) {
      const outs = edges.get(k);
      const next = outs.pop();
      if (!outs.length) edges.delete(k);
      pts.push(new T.Vector2((k % (w + 1)) * S, Math.floor(k / (w + 1)) * S));
      k = next;
      if (k === start) break;
    }
    if (pts.length >= 6) loops.push(simplify(pts, 2.2));
  }
  const all = loops.flat();
  const box = new T.Box2().setFromPoints(all);
  // which loops are holes: the signed area tells
  const area = (pts) => pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2;
  const outer = loops.filter((l) => area(l) > 0);
  const holes = loops.filter((l) => area(l) <= 0);
  return { loops, outer: outer.length ? outer : loops, holes, box, pts: all, mask };
}
/**
 * Like sections(), measured on the mask itself, row by row (or column by column): a lathe's
 * slices are exactly as wide as the picture, whatever the outline's walk made of a corner.
 */
function maskSections(mask, box, axis = 'y') {
  return (v) => {
    const i = T.MathUtils.clamp(Math.round(v), axis === 'y' ? box.min.y : box.min.x, (axis === 'y' ? box.max.y : box.max.x) - 1);
    let lo = Infinity;
    let hi = -Infinity;
    if (axis === 'y') {
      for (let x = 0; x < W; x++) if (mask[i * W + x]) {
        if (x < lo) lo = x;
        hi = x + 1;
      }
    } else {
      for (let y = 0; y < H; y++) if (mask[y * W + i]) {
        if (y < lo) lo = y;
        hi = y + 1;
      }
    }
    if (lo === Infinity) {
      const c = box.getCenter(new T.Vector2())[axis === 'y' ? 'x' : 'y'];
      return [c, c];
    }
    return [lo, hi];
  };
}
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1;
    let dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b]);
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
function segDist(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = T.MathUtils.clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy);
}
function inside(x, y, loops) {
  let yes = false;
  for (const pts of loops)
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
    }
  return yes;
}
function distance(x, y, loops) {
  let d = Infinity;
  const p = { x, y };
  for (const pts of loops)
    for (let i = 0; i < pts.length; i++) {
      const dd = segDist(p, pts[i], pts[(i + 1) % pts.length]);
      if (dd < d) d = dd;
    }
  return d;
}
/** Where a horizontal (or vertical) line through an outline meets it: its extent there. */
function sections(loops, box, axis = 'y') {
  const lo = box.min[axis];
  const hi = box.max[axis];
  const other = axis === 'y' ? 'x' : 'y';
  return (v) => {
    const cross = [];
    v = T.MathUtils.clamp(v, lo + 0.001, hi - 0.001);
    for (const pts of loops)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[axis] <= v && b[axis] > v) || (b[axis] <= v && a[axis] > v))
          cross.push(a[other] + ((v - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other]));
      }
    const c = box.getCenter(new T.Vector2())[other];
    return cross.length ? [Math.min(...cross), Math.max(...cross)] : [c, c];
  };
}

/* ------------------------------------------------------------------ solids */
function geoFrom(pos, idx) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/**
 * A closed volume turned on a lathe: every slice of the outline is round, as deep as
 * `ratio(y)` times half its width. A dress, an arm, a neck.
 */
function loft(shape, ratio = () => 0.78, exponent = 2, flare = Infinity) {
  const { loops, box } = shape;
  const size = box.getSize(new T.Vector2());
  const cut = shape.mask ? maskSections(shape.mask, box) : sections(loops, box);
  const rings = Math.round(T.MathUtils.clamp(16 + size.y / 4, 24, 160));
  const sides = Math.round(T.MathUtils.clamp(16 + size.x / 6, 24, 56));
  const pos = [];
  const idx = [];
  const top = cut(box.min.y + 0.001);
  const bottom = cut(box.max.y - 0.001);
  function section(y) {
    const [l, r] = cut(y);
    const rx = (r - l) / 2;
    const edge = Math.min(
      top[1] - top[0] > size.x * 0.15 ? y - box.min.y : Infinity,
      bottom[1] - bottom[0] > size.x * 0.15 ? box.max.y - y : Infinity,
    );
    const cap = Math.sqrt(Math.max(0, Math.min(1, edge / (size.y * 0.08))));
    return { cx: (l + r) / 2, rx, rz: rx * ratio(y) * cap };
  }
  // each slice, then the slices evened out over their neighbours (a median): a picture's
  // outline has slivers and notches a drawing's has not, and a single odd slice came out as
  // a disc sticking out of the dress
  const raw = [];
  for (let i = 0; i <= rings; i++) raw.push(section(box.min.y + (size.y * i) / rings));
  const median = (vals) => {
    const s = [...vals].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const med = raw.map((_, i) => {
    const near = raw.slice(Math.max(0, i - 3), Math.min(raw.length, i + 4));
    return { cx: median(near.map((q) => q.cx)), rx: median(near.map((q) => q.rx)), rz: median(near.map((q) => q.rz)) };
  });
  // and then averaged, so the tiers of a skirt are soft swells, not steps, seen from behind
  // (the ends stay: the hem and the shoulders keep their own size)
  const slices = med.map((q, i) => {
    if (i < 3 || i > med.length - 4) return q;
    const near = med.slice(i - 3, i + 4);
    const avg = (k) => near.reduce((s, n) => s + n[k], 0) / near.length;
    return { cx: avg('cx'), rx: avg('rx'), rz: avg('rz') };
  });
  // a skirt flares out from her waist, it does not start as a shelf: going down, its depth
  // grows at most `flare` pixels a pixel (its width stays the picture's, seen from the front)
  const dy = size.y / rings;
  for (let i = 1; i < slices.length; i++) slices[i].rz = Math.min(slices[i].rz, slices[i - 1].rz + flare * dy);
  const sliceAt = (y) => {
    const t = T.MathUtils.clamp(((y - box.min.y) / size.y) * rings, 0, rings);
    const i = Math.floor(t);
    const a = slices[i];
    const b = slices[Math.min(rings, i + 1)];
    const k = t - i;
    return { cx: a.cx + (b.cx - a.cx) * k, rx: a.rx + (b.rx - a.rx) * k, rz: a.rz + (b.rz - a.rz) * k };
  };
  for (let i = 0; i <= rings; i++) {
    const y = box.min.y + (size.y * i) / rings;
    const { cx, rx, rz } = slices[i];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent), -y, rz * Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  for (const i of [0, rings]) {
    const { cx } = slices[i];
    for (let j = 0; j <= sides; j++) {
      const n = (i * (sides + 1) + j) * 3;
      pos[n] = cx;
      pos[n + 2] = 0;
    }
  }
  const geo = mergeVertices(geoFrom(pos, idx), 0.00001);
  geo.computeVertexNormals();
  const front = (x, y) => {
    if (y < box.min.y || y > box.max.y) return -Infinity;
    const q = sliceAt(y);
    const f = 1 - Math.pow(Math.abs((x - q.cx) / (q.rx || 1)), exponent);
    return f >= 0 ? q.rz * Math.pow(f, 1 / exponent) : -Infinity;
  };
  return { geo, front, loops, box, mask: shape.mask };
}
/** A lofted solid whose bottom follows its outline's own bottom edge, waves and all. */
function hem(solid) {
  const down = solid.mask ? maskSections(solid.mask, solid.box, 'x') : sections(solid.loops, solid.box, 'x');
  const p = solid.geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const bottom = down(p.getX(i))[1];
    if (-p.getY(i) > bottom) p.setY(i, -bottom);
  }
  p.needsUpdate = true;
  solid.geo.computeVertexNormals();
  const front = solid.front;
  return { ...solid, front: (x, y) => (y > down(x)[1] ? -Infinity : front(x, y)) };
}
function ellipsoid(cx, cy, rx, ry, rz) {
  const g = new T.SphereGeometry(1, 48, 36);
  g.scale(rx, ry, rz);
  g.translate(cx, -cy, 0);
  return {
    geo: g,
    front: (x, y) => {
      const f = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
      return f >= 0 ? rz * Math.sqrt(f) : -Infinity;
    },
  };
}
/**
 * A rounded solid of any flat shape (marching cubes): rounded off within `depth` of its edge
 * and `depth` deep in the middle. `clip(x, y, z)` may cut it: the solid is kept only where
 * clip is positive (the hair, kept outside the skull).
 */
function rounded(shape, { depth, res = 96, clip = null, ratio = 1, field = null }) {
  const { loops, box } = shape;
  const sz = box.getSize(new T.Vector2());
  const center = box.getCenter(new T.Vector2());
  const span = Math.max(sz.x, sz.y, depth * 2) * 1.12;
  const mc = new MarchingCubes(res, new T.MeshBasicMaterial(), false, false, 600000);
  mc.isolation = 0;
  const dist = new Float32Array(res * res);
  for (let iy = 0; iy < res; iy++)
    for (let ix = 0; ix < res; ix++) {
      const x = center.x + (ix / res - 0.5) * span;
      const y = center.y + (iy / res - 0.5) * span;
      dist[iy * res + ix] = distance(x, y, loops) * (inside(x, y, loops) ? 1 : -1);
    }
  const height = (d) => (d > 0 ? Math.sqrt(2 * depth * Math.min(d, depth) - Math.min(d, depth) ** 2) * ratio : 0);
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const d = dist[iy * res + ix];
        const x = center.x + (ix / res - 0.5) * span;
        const y = center.y + (iy / res - 0.5) * span;
        const z = (iz / res - 0.5) * span;
        let f = d <= 0 ? d - Math.abs(z) : height(d) - Math.abs(z);
        if (clip) f = Math.min(f, clip(x, y, z));
        // a caller may reshape the solid point by point (the hair, lying on the skull)
        if (field) f = field(x, y, z, f, d);
        mc.field[iz * res * res + iy * res + ix] = f;
      }
  mc.update();
  const n = mc.geometry.drawRange.count;
  const g = new T.BufferGeometry();
  const arr = mc.geometry.attributes.position.array.slice(0, n * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = center.x + (arr[i] * span) / 2;
    arr[i + 1] = -center.y - (arr[i + 1] * span) / 2;
    arr[i + 2] *= span / 2;
  }
  for (let i = 0; i < arr.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const t = arr[i + 3 + j];
      arr[i + 3 + j] = arr[i + 6 + j];
      arr[i + 6 + j] = t;
    }
  g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
  const welded = mergeVertices(g, 0.005);
  welded.computeVertexNormals();
  mc.geometry.dispose();
  const front = (x, y) => {
    if (!inside(x, y, loops)) return -Infinity;
    return height(distance(x, y, loops));
  };
  return { geo: welded, front, loops, box };
}
/** A painted region, finely cut so it follows the curve of what it is painted on. */
function decal(shape, front, lift = 1.1) {
  const s = new T.Shape(shape.outer[0]);
  for (const o of shape.outer.slice(1)) {
    // more than one piece: each its own shape, glued into one geometry
  }
  const pieces = shape.outer.map((pts) => {
    const sh = new T.Shape(pts);
    for (const h of shape.holes) if (inside(h[0].x, h[0].y, [pts])) sh.holes.push(new T.Path(h));
    return sh;
  });
  let triangles = [];
  for (const sh of pieces) {
    const base = new T.ShapeGeometry(sh, 1).toNonIndexed();
    triangles.push(...base.attributes.position.array);
  }
  void s;
  for (let it = 0; it < 6; it++) {
    const next = [];
    for (let i = 0; i < triangles.length; i += 9) {
      const a = triangles.slice(i, i + 3);
      const b = triangles.slice(i + 3, i + 6);
      const c = triangles.slice(i + 6, i + 9);
      if (Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1])) < 14) {
        next.push(...a, ...b, ...c);
        continue;
      }
      const ab = a.map((v, j) => (v + b[j]) / 2);
      const bc = b.map((v, j) => (v + c[j]) / 2);
      const ca = c.map((v, j) => (v + a[j]) / 2);
      next.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
    }
    triangles = next;
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const x = triangles[i];
    const y = triangles[i + 1];
    triangles[i + 1] = -y;
    const z = front(x, y);
    triangles[i + 2] = (Number.isFinite(z) ? z : 0) + lift;
  }
  for (let i = 0; i < triangles.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const v = triangles[i + 3 + j];
      triangles[i + 3 + j] = triangles[i + 6 + j];
      triangles[i + 6 + j] = v;
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(triangles, 3));
  const w = mergeVertices(g, 0.0001);
  w.computeVertexNormals();
  return w;
}
/** Moves a solid forward (or back) by `dz`, or by what `dz(x, y)` says at each point. */
function shift(geo, dz) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + (typeof dz === 'function' ? dz(p.getX(i), -p.getY(i)) : dz));
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ materials */
const materials = new Map();
function material(name, colour) {
  const key = `${name}|${colour}`;
  if (!materials.has(key)) {
    const m = new T.MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0 });
    m.name = name;
    materials.set(key, m);
  }
  return materials.get(key);
}
/**
 * A mesh of a solid that wears its picture on the side facing the front and a flat colour
 * elsewhere. The front-facing triangles form one group (material `Tex_<pic>`, whose colour
 * is the flat one to fall back to) and the rest another (`flat`). UVs are the picture's
 * own pixels, so the game only has to put the picture on.
 */
function dressed(geo, pic, flatName, colour, { facing = 0.12, all = false } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    // glTF counts v from the top of the picture, and the game reads it that way (flipY off)
    uv[i * 2] = p.getX(i) / W;
    uv[i * 2 + 1] = -p.getY(i) / H;
  }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  const tris = p.count / 3;
  const front = [];
  const back = [];
  for (let t = 0; t < tris; t++) {
    const nz = (n.getZ(t * 3) + n.getZ(t * 3 + 1) + n.getZ(t * 3 + 2)) / 3;
    (all || nz > facing ? front : back).push(t);
  }
  const order = [...front, ...back];
  const pos2 = new Float32Array(p.count * 3);
  const nor2 = new Float32Array(p.count * 3);
  const uv2 = new Float32Array(p.count * 2);
  order.forEach((t, k) => {
    for (let v = 0; v < 3; v++) {
      const from = t * 3 + v;
      const to = k * 3 + v;
      pos2.set([p.getX(from), p.getY(from), p.getZ(from)], to * 3);
      nor2.set([n.getX(from), n.getY(from), n.getZ(from)], to * 3);
      uv2.set([uv[from * 2], uv[from * 2 + 1]], to * 2);
    }
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos2, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor2, 3));
  out.setAttribute('uv', new T.BufferAttribute(uv2, 2));
  out.addGroup(0, front.length * 3, 0);
  if (back.length) out.addGroup(front.length * 3, back.length * 3, 1);
  // the name says which picture goes on and what the flat colour is (Skin is tinted in the game)
  const mats = [material(`Tex_${pic}_${flatName}`, colour)];
  if (back.length) mats.push(material(flatName, colour));
  // shared corners again (the groups count indices, in the same order, so they still hold):
  // unshared, a dress was seven megabytes
  const packed = mergeVertices(out, 0.0001);
  packed.clearGroups();
  for (const gr of out.groups) packed.addGroup(gr.start, gr.count, gr.materialIndex);
  return new T.Mesh(packed, mats);
}

/* ------------------------------------------------------------------ her head */
async function head() {
  const data = await picture('head-light');
  const mask = maskOf(data);
  const root = new T.Group();
  root.name = 'head';
  const skull = ellipsoid(SKULL.cx, SKULL.cy, SKULL.rx, SKULL.ry, SKULL.rz);
  const fronts = [skull.front];
  const add = (geo, name, pic, flat, colour, opts) => {
    const m = dressed(geo, pic, flat, colour, opts);
    m.name = name;
    root.add(m);
  };
  add(skull.geo, 'skull', 'head', 'Skin', COLOUR.skin);
  // her neck: the strip of the head picture under her chin, a tube
  const neckMask = maskWhere((x, y) => y >= CHIN && mask[y * W + x]);
  if (count(neckMask) > 100) {
    const neck = loft(outlineOf(neckMask), () => 0.9);
    fronts.push(neck.front);
    add(neck.geo, 'neck', 'head', 'Skin', COLOUR.skin);
  }
  // her ears: what is left of the head picture beyond the skull, little round lumps
  const earMask = maskWhere((x, y) => y < CHIN && mask[y * W + x] && skullZ(x, y) === 0);
  for (const [i, comp] of components(earMask, 200).slice(0, 2).entries()) {
    const ear = rounded(outlineOf(comp), { depth: 22, res: 48 });
    fronts.push(ear.front);
    add(ear.geo, `ear${i}`, 'head', 'Skin', COLOUR.skin);
  }
  const front = (x, y) => Math.max(0, ...fronts.map((f) => f(x, y)));
  return { root, front };
}

/* ------------------------------------------------------------------ her dresses */
/** Cuts follow the existing shoulder/waist seams and gaps beside the hands (portrait3d's). */
const ARM = [[354, 784], [431, 791], [414, 851], [379, 895], [307, 961], [293, 998], [257, 1034], [195, 1034], [195, 926], [295, 869]].map(([x, y]) => new T.Vector2(x, y));
const sleeveEdge = (y) => (y < 720 ? 430 : 430 + (y - 720) * 0.06);
/**
 * How far each dress picture was lowered (cut.cjs's DROP, so each one's neck opens into its
 * shoulders where the pink one's does): its arms and sleeves are that much lower than ARM says.
 */
// (every dress is now made from the green princess's picture, cut.cjs's v2: all lie alike)
const DROP = { gown: 15, aline: 15, mermaid: 15, star: 15 };
function dressRegion(x, y0, dress) {
  const leftX = Math.min(x, W - x);
  const y = y0 - (DROP[dress] ?? 0);
  // (her legs are drawn by cut.cjs on the canvas itself, after the lowering)
  if (dress === 'star' && y0 >= 1216 && leftX >= 435 && leftX < 510) return 'legs';
  if (y >= 788 && y < 1034 && inside(leftX, y, [ARM])) return 'arm';
  if (y < 800 && leftX < sleeveEdge(y)) return 'sleeve';
  return 'body';
}
/** How deep each dress is against how wide, row by row. */
const SKIRT_RATIO = {
  // (the green one as Clara's turnaround shows her from the side: a round bell, nearly as deep
  // as it is wide)
  gown: (y) => (y < 845 ? 0.8 : 0.9),
  aline: (y) => (y < 845 ? 0.8 : 0.82),
  star: (y) => (y < 845 ? 0.8 : 0.78),
  // a peplum over her hips, a tail that is her body, a fluke that is a fin
  mermaid: (y) => (y < 845 ? 0.8 : y < 1180 ? 0.62 : y < 1300 ? 0.9 : 0.25),
};

async function dress(id) {
  const data = await picture(`dress-${id}-light`);
  const mask = maskOf(data);
  const root = new T.Group();
  root.name = `dress_${id}`;
  const cloth = COLOUR.cloth[id];
  const add = (geo, name, flat, colour) => {
    const m = dressed(geo, 'dress', flat, colour);
    m.name = name;
    root.add(m);
    return m;
  };
  /*
   * Her arms are the skin inside the arm's cut (grown a little to take the line round it): the
   * cut alone also took a corner of the mermaid's peplum, which came out as red spikes.
   */
  const skin = maskWhere((x, y) => {
    const k = (y * W + x) * 4;
    const [r, g, b, a] = [data[k], data[k + 1], data[k + 2], data[k + 3]];
    // cut.cjs's skin test, hue and all: without the hue the gold braid on a hem passed as
    // skin, and the hand took the braid with it
    const hue = r - b > 0 ? (60 * (g - b)) / (r - b) : 99;
    return a > 127 && r > 195 && g > 0.66 * r && g - b >= -8 && r - b > 25 && hue <= 33;
  });
  const armCut = maskWhere((x, y) => mask[y * W + x] && dressRegion(x, y, id) === 'arm');
  const armMask = and(dilate(and(skin, armCut), 5), armCut);
  const region = (which) => (which === 'arm' ? armMask : maskWhere((x, y) => mask[y * W + x] && dressRegion(x, y, id) === which && !(dressRegion(x, y, id) === 'arm')));
  // what the arm's cut took that is not arm goes back to the body if it is a real piece of
  // dress (the peplum under a hand); the slivers (a finger's outline, a shadow on the hand)
  // are dropped — given to the body they widened a slice here and there, and the lathe came
  // out in discs
  let bodyMask = region('body');
  for (const piece of components(not(armCut, armMask), 1500)) bodyMask = or(bodyMask, piece);
  // the body goes on behind a hand: within a row's own reach, the hand's cut is filled in,
  // or the lathe is notched where the hand is and flares where the dress shows under it
  for (let y = 0; y < H; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) if (bodyMask[y * W + x]) {
      if (l < 0) l = x;
      r = x;
    }
    if (l < 0) continue;
    for (let x = l; x <= r; x++) if (armCut[y * W + x]) bodyMask[y * W + x] = 1;
  }
  if (process.env.PRINCESS_DEBUG) {
    const img = Buffer.alloc(W * H * 3);
    for (let k = 0; k < W * H; k++) {
      img[k * 3] = armMask[k] * 255;
      img[k * 3 + 1] = bodyMask[k] * 255;
      img[k * 3 + 2] = armCut[k] * 160;
    }
    await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${process.env.PRINCESS_DEBUG}/dress-${id}-masks.png`);
  }
  // the bodice and skirt, one solid turned on the lathe, its hem following the picture's
  const body = hem(loft(outlineOf(bodyMask), SKIRT_RATIO[id], 2, 0.75));
  if (process.env.PRINCESS_DEBUG) {
    const o = outlineOf(bodyMask);
    const cut = sections(o.loops, o.box);
    console.log(id, 'box', o.box.min.x, o.box.max.x, o.box.min.y, o.box.max.y, 'loops', o.loops.length, [940, 980, 1000, 1020].map((y) => `${y}:${cut(y).map(Math.round)}`).join(' '));
  }
  add(body.geo, 'body', 'Cloth', cloth);
  const fronts = [body.front];
  // the puff sleeves, round, half sunk into the shoulders
  for (const [i, comp] of components(region('sleeve'), 400).slice(0, 2).entries()) {
    const sl = rounded(outlineOf(comp), { depth: 46, res: 56 });
    const c = sl.box.getCenter(new T.Vector2());
    const dz = Math.max(0, body.front(c.x, c.y)) * 0.45;
    shift(sl.geo, dz);
    fronts.push((x, y) => sl.front(x, y) + dz);
    add(sl.geo, `sleeve${i}`, 'Cloth', cloth);
  }
  // her arms, tubes, each resting on the skirt where the hand lies
  for (const [i, comp] of components(region('arm'), 400).slice(0, 2).entries()) {
    const arm = loft(outlineOf(comp), () => 0.95);
    const cut = sections(arm.loops, arm.box);
    const hand = new T.Vector2((cut(arm.box.max.y - 40)[0] + cut(arm.box.max.y - 40)[1]) / 2, arm.box.max.y - 40);
    const shoulder = new T.Vector2((cut(arm.box.min.y + 20)[0] + cut(arm.box.min.y + 20)[1]) / 2, arm.box.min.y + 20);
    const r = (cut(hand.y)[1] - cut(hand.y)[0]) / 2;
    const at = (c) => Math.max(0, body.front(c.x, c.y), body.front(c.x - 30, c.y), body.front(c.x + 30, c.y));
    // the arm slopes from her shoulder, at the side of her bodice, down to her hand resting
    // on the front of her skirt; moved forward as one piece it stuck out like a paddle
    const dzTop = at(shoulder) * 0.35;
    // her hand lies on the skirt: in front of it wherever the hand is (the skirt flares out
    // under it, and a hand set by one point of it sank into the rest)
    let under = 0;
    for (let y = arm.box.max.y - 90; y <= arm.box.max.y + 6; y += 6) {
      const [l0, r0] = cut(Math.min(y, arm.box.max.y - 1));
      for (let x = l0; x <= r0; x += 6) under = Math.max(under, body.front(x, y));
    }
    const dzHand = Math.max(0, under - r * 0.15);
    const slope = (y) => T.MathUtils.lerp(dzTop, dzHand, T.MathUtils.smoothstep(y, shoulder.y, hand.y));
    shift(arm.geo, (x, y) => slope(y));
    fronts.push((x, y) => arm.front(x, y) + slope(y));
    add(arm.geo, `arm${i}`, 'Skin', COLOUR.skin);
  }
  // her shoes, peeping out under a long skirt (Clara: "coloque os pés dela")
  if (id === 'gown' || id === 'aline') {
    const shoeColour = { gown: '#d9b04a', aline: '#c46ac8' }[id];
    const bottom = body.box.max.y;
    for (const [i, dx] of [-44, 44].entries()) {
      const x = 498 + dx;
      const z = Math.max(0, body.front(x, bottom - 40)) * 0.72;
      const shoe = ellipsoid(x, bottom - 2, 34, 20, 50);
      shift(shoe.geo, z);
      add(shoe.geo, `shoe${i}`, 'Shoe', shoeColour);
    }
  }
  // her legs (the short dress), tubes with her shoes
  for (const [i, comp] of components(region('legs'), 400).slice(0, 2).entries()) {
    const leg = loft(outlineOf(comp), () => 0.95);
    fronts.push(leg.front);
    add(leg.geo, `leg${i}`, 'Skin', COLOUR.skin);
  }
  const front = (x, y) => Math.max(-1, ...fronts.map((f) => f(x, y)));
  const back = (x, y) => Math.max(-1, body.front(x, y));
  return { root, front, back };
}

/* ------------------------------------------------------------------ her hair */
/** The gold of a tiara on a front-of-hair picture (a blonde bun is gold too: no tiara there). */
function goldMask(data) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < 300; y++)
    for (let x = 300; x < 724; x++) {
      const k = (y * W + x) * 4;
      const [r, g, b, a] = [data[k], data[k + 1], data[k + 2], data[k + 3]];
      if (a > 200 && r > 170 && g > 120 && b < 140 && r - b > 80 && g > r * 0.55) m[y * W + x] = 1;
    }
  return m;
}
/** Her earrings: what hangs beside her jaw that is not the colour of her hair. */
function earringMask(data, hair) {
  const n = parseInt(hair.slice(1), 16);
  const [hr, hg, hb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const m = new Uint8Array(W * H);
  for (let y = 430; y < 640; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - 512);
      if (dx < 95 || dx > 240) continue;
      const k = (y * W + x) * 4;
      if (data[k + 3] < 200) continue;
      const [r, g, b] = [data[k], data[k + 1], data[k + 2]];
      if (Math.hypot(r - hr, g - hg, b - hb) > 120 && Math.max(r, g, b) > 90) m[y * W + x] = 1;
    }
  return m;
}

async function hair(id) {
  const front = await picture(`hair-${id}-front`);
  const back = await picture(`hair-${id}-back`);
  const colour = COLOUR.hair[id];
  const root = new T.Group();
  root.name = `hair_${id}`;
  const add = (geo, name, pic, flat, colr, opts) => {
    const m = dressed(geo, pic, flat, colr, opts);
    m.name = name;
    root.add(m);
    return m;
  };
  const gold = id === 'bun' ? new Uint8Array(W * H) : dilate(goldMask(front), 3);
  const earrings = dilate(earringMask(front, colour), 3);
  const frontMask = not(not(maskOf(front), gold), earrings);
  const backMask = maskOf(back);
  const skullMask = maskWhere((x, y) => y < 640 && skullZ(x, y) > 0);
  /*
   * The front of her hair: a plump rounded mass of its own outline, with the back of her skull
   * joined on (the pictures never show it) — kept outside her skull, and, where her face is,
   * only behind it. Whatever the picture draws beside her face comes forward round her head.
   */
  const shape = outlineOf(or(frontMask, skullMask));
  const inFront = (x, y) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < W && yi < H && frontMask[yi * W + xi] === 1;
  };
  const grown = { cx: SKULL.cx, cy: SKULL.cy, rx: SKULL.rx + 12, ry: SKULL.ry + 12, rz: SKULL.rz + 12 };
  /*
   * Over her skull the hair is two things at once: the plump mass, kept outside the skull
   * (so it wraps round the sides), and, wherever the picture draws hair on her head, a layer
   * lying on the skull itself — a fringe is thinner than the skull is tall, and cut by the
   * skull alone it vanished and left her forehead bare. Where her face is, only behind.
   */
  const LAYER = 14;
  /*
   * And all round her head, a shell of hair over the skull as thick as hair is (SHELL): the
   * plump mass is at most 130 deep and her skull 150, so behind the middle of her head there
   * was no hair at all, and turned round she was bald. The shell covers the back and the sides
   * of her head; in front of her ears and face it is only where the picture draws hair.
   */
  // (the red braid's, from Clara's turnaround: a full head of hair behind her head)
  const SHELL = id === 'bun' ? 30 : id === 'curly' ? 58 : id === 'braids' ? 66 : 44;
  const outer = { rx: SKULL.rx + SHELL, ry: SKULL.ry + SHELL, rz: SKULL.rz + SHELL };
  /*
   * Its surface is not smooth: hair that falls straight has strands running down it, and curls
   * are lumps all over (a smooth dome looked like a helmet, the black one most of all).
   */
  const texture = (x, y, z) => {
    const a = Math.atan2(z, x - SKULL.cx);
    if (id === 'curly') return 13 * Math.sin(a * 13 + Math.sin(y * 0.05) * 1.4) * Math.sin(y * 0.085 + a * 3);
    return 5 * Math.sin(a * 22 + y * 0.012) + 2.5 * Math.sin(a * 47);
  };
  const shellAt = (x, y, z) => {
    if (y > 650) return -1;
    const inner = ((x - grown.cx) / (grown.rx - 4)) ** 2 + ((y - grown.cy) / (grown.ry - 4)) ** 2 + (z / (grown.rz - 4)) ** 2 - 1;
    const grow = 1 + texture(x, y, z) / (SKULL.rz + SHELL);
    const out = 1 - (((x - SKULL.cx) / (outer.rx * grow)) ** 2 + ((y - SKULL.cy) / (outer.ry * grow)) ** 2 + (z / (outer.rz * grow)) ** 2);
    // (in pixels, roughly: an ellipsoid's s changes by about 2 / r per pixel)
    let f = Math.min(inner * 80, out * 90);
    // in front of her ears and her face, only where the picture has hair there, and there no
    // further forward than the hair lying on her skull: thicker, the hair beside her cheek
    // stood out in front of her face and, seen from the side, hid half an eye
    if (!inFront(x, y)) f = Math.min(f, -z - 36);
    else f = Math.min(f, Math.max(skullZ(x, y), 0) + LAYER - z);
    // and it ends round her nape
    return Math.min(f, 640 - y);
  };
  const shellFront = (x, y) => {
    const f = 1 - ((x - SKULL.cx) / outer.rx) ** 2 - ((y - SKULL.cy) / outer.ry) ** 2;
    return f > 0 && y < 640 && inFront(x, y) ? Math.min(outer.rz * Math.sqrt(f), Math.max(skullZ(x, y), 0) + LAYER) : -Infinity;
  };
  const field = (x, y, z, base) => {
    const shell = shellAt(x, y, z);
    if (!(y < 640 && skullZ(x, y) > 0)) return Math.max(base, shell);
    const s = ((x - grown.cx) / grown.rx) ** 2 + ((y - grown.cy) / grown.ry) ** 2 + (z / grown.rz) ** 2 - 1;
    const outside = Math.min(base, s * 60);
    if (!inFront(x, y)) return Math.max(Math.min(outside, -z - 14), shell);
    const layer = LAYER - Math.abs(z - skullZ(x, y) - LAYER);
    return Math.max(outside, layer, shell);
  };
  const mass = rounded(shape, { depth: 130, res: 104, field });
  if (process.env.PRINCESS_DEBUG) {
    for (const [x, y] of [[512, 360], [512, 400], [430, 380], [600, 380]]) {
      const zs = [];
      for (let z = -200; z <= 200; z += 10) if (field(x, y, z, -1e9) > 0) zs.push(z);
      console.log(`  ${id} (${x},${y}) skull ${skullZ(x, y).toFixed(0)} inFront ${inFront(x, y)} hair z: ${zs.length ? `${zs[0]}..${zs.at(-1)}` : 'none'} front ${mass.front(x, y)}`);
    }
  }
  add(mass.geo, 'front', 'hairfront', 'Hair', colour);
  // the front of the hair mass, measured, for the tiara and the earrings to sit on
  const hairFront = (x, y) => {
    const z = mass.front(x, y);
    return Math.max(Number.isFinite(z) ? z : -Infinity, skullZ(x, y) + 12, shellFront(x, y));
  };
  // the hair behind her: its own rounded mass, behind her skull (and, in the game, behind
  // whatever dress she wears)
  if (count(backMask) > 500) {
    // its ends are locks, not a straight cut: the picture fills it in behind her body down to
    // a level line (no one sees that in 2D), which turned round was a square bottom edge
    let x0 = W;
    let x1 = 0;
    let yEnd = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (backMask[y * W + x]) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      yEnd = Math.max(yEnd, y);
    }
    if (yEnd > 760) {
      const LOCK = 64;
      for (let y = yEnd - 70; y <= yEnd; y++)
        for (let x = x0; x <= x1; x++) {
          const t = ((x - x0) % LOCK) / LOCK;
          // each lock rounded at its end, the middle ones a little longer
          const mid = 1 - Math.abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2 || 1));
          const end = yEnd - 22 + 22 * mid - 46 * (1 - Math.sin(Math.PI * t));
          if (y > end) backMask[y * W + x] = 0;
        }
    }
    const b = rounded(outlineOf(backMask), { depth: 80, res: 92, clip: (x, y, z) => -z - skullZ(x, y) - 10 });
    add(b.geo, 'back', 'hairback', 'Hair', colour);
  }
  if (count(gold) > 200) {
    const t = rounded(outlineOf(gold), { depth: 9, res: 96, ratio: 1 });
    let base = 0;
    let gx0 = W;
    let gx1 = 0;
    for (let y = 0; y < 300; y++) for (let x = 300; x < 724; x++) if (gold[y * W + x]) {
      base = y;
      gx0 = Math.min(gx0, x);
      gx1 = Math.max(gx1, x);
    }
    // it goes round her head, its ends curving back (flat, it was a blade in front of her hair
    // seen from the side), and leans back as it rises, the way a tiara sits on a head
    const a = (gx1 - gx0) / 2 + 10;
    const zc = hairFront(SKULL.cx, base) + 4;
    const ring = (x) => 0.8 * a * (Math.sqrt(Math.max(0, 1 - ((x - SKULL.cx) / a) ** 2)) - 1);
    shift(t.geo, (x, y) => zc + ring(x) + Math.max(0, base - y) * -0.3);
    add(t.geo, 'tiara', 'hairfront', 'Gold', COLOUR.gold, { all: true });
  }
  for (const [i, comp] of components(earrings, 80).slice(0, 2).entries()) {
    const e = rounded(outlineOf(comp), { depth: 7, res: 48 });
    shift(e.geo, (x, y) => hairFront(x, y) + 4);
    add(e.geo, `earring${i}`, 'hairfront', 'Gold', COLOUR.gold, { all: true });
  }
  return { root };
}

/* ------------------------------------------------------------------ her face */
/** The eyes: whites and lids with their lashes, laid on the skull, each eye bulging a little. */
async function eyes(id, headFront) {
  const data = await picture(`eyes-${id}`);
  const brows = await picture(`brows-${id}`);
  const root = new T.Group();
  root.name = `eyes_${id}`;
  const bulge = (x, y) => {
    let b = 0;
    for (const cx of [427, 597]) b = Math.max(b, 14 * Math.max(0, 1 - ((x - cx) / 64) ** 2 - ((y - 492) / 60) ** 2));
    return b;
  };
  const g = new T.Group();
  g.name = 'Eyes';
  const eyeGeo = decal(outlineOf(maskOf(data)), (x, y) => headFront(x, y) + bulge(x, y), 2.5);
  const eyeMesh = dressed(eyeGeo, 'eyes', 'Skin', COLOUR.skin, { all: true });
  eyeMesh.name = 'eyes';
  g.add(eyeMesh);
  root.add(g);
  const browMesh = dressed(decal(outlineOf(maskOf(brows)), headFront, 3.5), 'brows', 'Skin', COLOUR.skin, { all: true });
  browMesh.name = 'brows';
  root.add(browMesh);
  return { root };
}
async function mouth(id, headFront) {
  const data = await picture(`mouth-${id}`);
  const root = new T.Group();
  root.name = `mouth_${id}`;
  const m = dressed(decal(outlineOf(maskOf(data)), headFront, 2.5), 'mouth', 'Skin', COLOUR.skin, { all: true });
  m.name = 'mouth';
  root.add(m);
  return { root };
}

/* ------------------------------------------------------------------ writing */
function toMetres(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry.translate(-512, 1536, 0);
      o.geometry.scale(UNIT, UNIT, UNIT);
    }
  });
}
/** A surface sampled every `step` pixels, for the game to lay hair on. */
function grid(fn, step = 16) {
  const nx = Math.floor(W / step) + 1;
  const ny = Math.floor(H / step) + 1;
  const heights = [];
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++) {
      const z = fn(ix * step, iy * step);
      heights.push(Math.round((Number.isFinite(z) ? z : -1) * 10) / 10);
    }
  return { step, nx, ny, heights };
}
const catalogue = {};
const reports = [];
async function write(name, root, meta) {
  toMetres(root);
  const data = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });
  await fs.writeFile(new URL(`${name}.glb`, OUT), Buffer.from(data));
  const validation = await validator.validateBytes(new Uint8Array(data), { maxIssues: 20 });
  let tris = 0;
  root.traverse((o) => {
    if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  reports.push({ piece: name, bytes: data.byteLength, triangles: Math.round(tris), errors: validation.issues.numErrors, warnings: validation.issues.numWarnings });
  if (validation.issues.numErrors) throw new Error(`${name}: ${JSON.stringify(validation.issues)}`);
  catalogue[name.replace('-', ':')] = { url: `models/princess/${name}.glb`, group: root.name, ...meta };
  console.log(name.padEnd(16), String(data.byteLength).padStart(8), String(Math.round(tris)).padStart(7), validation.issues.numWarnings ? `${validation.issues.numWarnings} warnings` : '');
}

const only = process.argv[2];
const want = (row) => !only || only === row;

const theHead = await head();
if (want('head')) await write('head', theHead.root, {});
if (want('dress')) for (const id of DRESSES) {
  const d = await dress(id);
  await write(`dress-${id}`, d.root, { front: grid(d.front), back: grid(d.back) });
}
if (want('hair')) for (const id of HAIRS) await write(`hair-${id}`, (await hair(id)).root, {});
if (want('eyes')) for (const id of EYES) await write(`eyes-${id}`, (await eyes(id, theHead.front)).root, {});
if (want('mouth')) for (const id of MOUTHS) await write(`mouth-${id}`, (await mouth(id, theHead.front)).root, {});

const libFile = new URL('../../src/characters/princess/model-library.json', import.meta.url);
let lib = { unit: UNIT, pieces: {} };
try {
  lib = JSON.parse(await fs.readFile(libFile, 'utf8'));
} catch {}
lib.unit = UNIT;
Object.assign(lib.pieces, catalogue);
await fs.writeFile(libFile, JSON.stringify(lib));
await fs.writeFile(new URL('../../docs/princess-model-validation.json', import.meta.url), JSON.stringify(reports, null, 2));
void HERE;

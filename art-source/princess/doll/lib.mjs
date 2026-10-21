/**
 * Shapes for modelling the princess doll (see index.mjs). Everything is built in the pixels of
 * her 2D sheet (1024 by 1536, x right, y DOWN, z towards the viewer) so a piece lands where the
 * flat princess has it; `toMetres` turns a finished piece into the game's metres, y up.
 *
 * Inside a geometry y is already negated (y up), as the dragon's generator does, so winding and
 * normals come out right without mirroring.
 */
import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const W = 1024;
export const H = 1536;
/** Metres per pixel: the sheet is 3.84 m tall in the game (the abilities orbit in these units). */
export const UNIT = 0.0025;

/* ------------------------------------------------------------------ materials */
const materials = new Map();
/**
 * A colour, cached by name: a piece's regions share one material per colour. `Skin` is tinted
 * by the game to the chosen tone; everything else keeps its colour.
 */
export function material(name, colour, opts = {}) {
  const key = name + '|' + colour + '|' + JSON.stringify(opts);
  if (!materials.has(key)) {
    // `gloss` gives a varnished, doll-like finish (a clearcoat the game's loader understands)
    const { gloss, ...rest } = opts;
    const m = gloss
      ? new T.MeshPhysicalMaterial({ color: colour, roughness: 0.5, metalness: 0, clearcoat: gloss, clearcoatRoughness: 0.25, ...rest })
      : new T.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0, ...rest });
    m.name = name;
    materials.set(key, m);
  }
  return materials.get(key);
}
export const GOLD = (name = 'Gold') => material(name, '#e2b545', { roughness: 0.32, metalness: 0.55 });
export const SKIN = () => material('Skin', '#fdc59b', { roughness: 0.5 });

/* ------------------------------------------------------------------ geometry */
export function geoFrom(pos, idx) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
export function finish(g, weld = 0.01) {
  const w = mergeVertices(g, weld);
  w.computeVertexNormals();
  return w;
}
export function merge(list) {
  const gs = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of gs) for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  return finish(mergeGeometries(gs));
}
/** A mesh in canvas pixels, named, in a group. */
export function mesh(geo, mat, name, group) {
  const m = new T.Mesh(geo, mat);
  m.name = name;
  if (group) group.add(m);
  return m;
}

/** Smooth interpolation of [[t, v], ...] (t ascending), with cosine easing between knots. */
export function curve(knots, smooth = true) {
  return (t) => {
    if (t <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      if (t <= knots[i][0]) {
        const [t0, v0] = knots[i - 1];
        const [t1, v1] = knots[i];
        let f = (t - t0) / (t1 - t0);
        if (smooth) f = 0.5 - 0.5 * Math.cos(f * Math.PI);
        return v0 + (v1 - v0) * f;
      }
    }
    return knots.at(-1)[1];
  };
}

/**
 * A surface turned round a vertical axis at (cx, cz), like a lathe, but the radius may vary with
 * the angle too (for drapes, scallops, puffs): r(y, a) with a from 0 (front, +z) going round;
 * `yOf(v, a)` gives the y of ring v in [0,1] at angle a (so a hem may rise and fall);
 * `depth` squashes z; `a0..a1` opens the surface (an overskirt with a front gap).
 * Caps: 'top' | 'bottom' | 'both' close the ends with a centre point.
 */
export function lathe({ cx = W / 2, cz = 0, rings = 40, sides = 48, r, yOf, depth = 1, a0 = 0, a1 = Math.PI * 2, caps = '', xOf = null }) {
  const pos = [];
  const idx = [];
  const open = a1 - a0 < Math.PI * 2 - 1e-6;
  const cols = sides + 1;
  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    for (let j = 0; j <= sides; j++) {
      const a = a0 + ((a1 - a0) * j) / sides;
      const y = yOf(v, a);
      const rad = r(y, a, v);
      const x = cx + rad * Math.sin(a) + (xOf ? xOf(y, a, v) : 0);
      const z = cz + rad * Math.cos(a) * depth;
      pos.push(x, -y, z);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const p = i * cols + j;
      const q = p + cols;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
  const cap = (ring, flip) => {
    const c = pos.length / 3;
    let sx = 0, sy = 0, sz = 0;
    for (let j = 0; j < sides; j++) {
      const n = (ring * cols + j) * 3;
      sx += pos[n]; sy += pos[n + 1]; sz += pos[n + 2];
    }
    pos.push(sx / sides, sy / sides, sz / sides);
    for (let j = 0; j < sides; j++) {
      const p = ring * cols + j;
      if (flip) idx.push(p, c, p + 1);
      else idx.push(p, p + 1, c);
    }
  };
  if (caps === 'top' || caps === 'both') cap(0, false);
  if (caps === 'bottom' || caps === 'both') cap(rings, true);
  const g = finish(geoFrom(pos, idx), open ? 0.0001 : 0.01);
  return g;
}
/**
 * A lathe from a profile of [y, radius] knots, round in every ring. Knots are joined straight
 * (eased joins between close knots rippled like stacked rings); `smooth` eases a sparse profile.
 */
export function spun(knots, opts = {}) {
  const rOf = curve(knots, !!opts.smooth);
  const y0 = knots[0][0];
  const y1 = knots.at(-1)[0];
  return lathe({ r: (y) => rOf(y), yOf: (v) => y0 + (y1 - y0) * v, caps: 'both', ...opts });
}

export function ellipsoid(cx, cy, cz, rx, ry, rz, seg = 32) {
  const g = new T.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(rx, ry, rz);
  g.translate(cx, -cy, cz);
  return g;
}
/** An ellipsoid turned about its own middle by `ay` round y (then `az` round z), at (cx, cy, cz). */
export function turned(cx, cy, cz, rx, ry, rz, ay, az = 0, seg = 12) {
  const g = new T.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(rx, ry, rz);
  g.rotateZ(az);
  g.rotateY(ay);
  g.translate(cx, -cy, cz);
  return g;
}
/** A torus lying flat (round a vertical axis), or turned by `rot` (Euler, radians). */
export function ring(cx, cy, cz, R, r, rot = [Math.PI / 2, 0, 0], arc = Math.PI * 2, seg = 48) {
  const g = new T.TorusGeometry(R, r, 12, seg, arc);
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(cx, -cy, cz);
  return g;
}

/**
 * A strand or an arm: swept along points [x, y, z] (canvas pixels) with an elliptical section
 * whose half-widths may change along it: rx(t), rz(t) in [0,1]; the section's rz axis is the
 * sweep's binormal. Caps are rounded by shrinking the first and last rings.
 */
export function sweep(points, rx, rz = rx, { seg = 0, radial = 10, round = true, tension = 0.5 } = {}) {
  const pts = points.map(([x, y, z]) => new T.Vector3(x, -y, z));
  const c = new T.CatmullRomCurve3(pts, false, 'catmullrom', tension);
  const n = seg || Math.min(120, Math.max(12, Math.round(c.getLength() / 6)));
  const fr = c.computeFrenetFrames(n, false);
  const RX = typeof rx === 'function' ? rx : () => rx;
  const RZ = typeof rz === 'function' ? rz : () => rz;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = c.getPointAt(t);
    let k = 1;
    if (round) {
      const e = Math.min(t, 1 - t) * n;
      k = e < 2 ? Math.sqrt(Math.max(0.02, 1 - ((2 - e) / 2) ** 2)) : 1;
    }
    const N = fr.normals[i];
    const B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const u = Math.cos(a) * RX(t) * k;
      const v = Math.sin(a) * RZ(t) * k;
      pos.push(p.x + N.x * u + B.x * v, p.y + N.y * u + B.y * v, p.z + N.z * u + B.z * v);
    }
  }
  const cols = radial + 1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * cols + j;
      const b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // closed ends
  for (const [ringI, flip] of [[0, true], [n, false]]) {
    const cI = pos.length / 3;
    const p = c.getPointAt(ringI / n);
    pos.push(p.x, p.y, p.z);
    for (let j = 0; j < radial; j++) {
      const a = ringI * cols + j;
      if (flip) idx.push(a, a + 1, cI);
      else idx.push(a, cI, a + 1);
    }
  }
  return finish(geoFrom(pos, idx), 0.0001);
}

/**
 * A smooth solid from a signed field f(x, y, z) > 0 inside (canvas pixels), sampled on `res`
 * cells over `box` [x0, y0, z0, x1, y1, z1]. Used where shapes must melt together (hair).
 */
export function blob(field, box, res = 96) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const mc = new MarchingCubes(res, new T.MeshBasicMaterial(), false, false, 2500000);
  mc.isolation = 0;
  const cell = span / res;
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const x = cx + (ix / (res - 1) - 0.5) * span;
        const y = cy + (iy / (res - 1) - 0.5) * span;
        const z = cz + (iz / (res - 1) - 0.5) * span;
        // the field is a distance-like value in pixels; clamp so the surface stays sharp
        mc.field[iz * res * res + iy * res + ix] = Math.max(-cell * 3, Math.min(cell * 3, field(x, y, z)));
      }
  mc.update();
  const n = mc.geometry.drawRange.count;
  const arr = mc.geometry.attributes.position.array.slice(0, n * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = cx + (arr[i] * span) / 2;
    arr[i + 1] = -(cy + (arr[i + 1] * span) / 2);
    arr[i + 2] = cz + (arr[i + 2] * span) / 2;
  }
  // y was mirrored: swap two corners of every triangle to keep the faces outward
  for (let i = 0; i < arr.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const t = arr[i + 3 + j];
      arr[i + 3 + j] = arr[i + 6 + j];
      arr[i + 6 + j] = t;
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
  mc.geometry.dispose();
  return finish(g, cell * 0.2);
}
/** Field helpers: smooth union / subtraction of distance-like fields. */
export const smin = (a, b, k = 10) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return a * h + b * (1 - h) + k * h * (1 - h);
};
export const ellipsoidField = (cx, cy, cz, rx, ry, rz) => (x, y, z) => {
  const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2);
  return (1 - d) * Math.min(rx, ry, rz);
};

/** A flat shape (THREE.Shape in canvas pixels, y down) as a thin plate standing at z, facing +z. */
export function plate(shape, z, thick = 4, curveSeg = 12) {
  const g = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: curveSeg });
  g.scale(1, -1, 1);
  g.translate(0, 0, z - thick);
  // mirrored in y: flip winding
  const idx = g.index ? Array.from(g.index.array) : null;
  const out = g.toNonIndexed();
  const p = out.attributes.position.array;
  for (let i = 0; i < p.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const t = p[i + 3 + j];
      p[i + 3 + j] = p[i + 6 + j];
      p[i + 6 + j] = t;
    }
  void idx;
  return finish(out, 0.001);
}
export function star(cx, cy, R, r, n = 5) {
  const s = new T.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
export function heart(cx, cy, size) {
  const s = new T.Shape();
  const k = size / 2;
  s.moveTo(cx, cy + k);
  s.bezierCurveTo(cx - k * 1.6, cy - k * 0.2, cx - k * 0.9, cy - k * 1.3, cx, cy - k * 0.45);
  s.bezierCurveTo(cx + k * 0.9, cy - k * 1.3, cx + k * 1.6, cy - k * 0.2, cx, cy + k);
  return s;
}

/** Mirrors a geometry about x = 512 (the doll's middle), keeping faces outward. */
export function mirrored(g) {
  const m = g.clone();
  m.translate(-W / 2, 0, 0);
  m.scale(-1, 1, 1);
  m.translate(W / 2, 0, 0);
  const idx = m.index;
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    idx.needsUpdate = true;
  }
  m.computeVertexNormals();
  return m;
}
/** A geometry and its mirror, as one. */
export const pair = (g) => merge([g, mirrored(g)]);

/** From sheet pixels to the game's metres: x about her middle, y up from the sheet's bottom. */
export function toMetres(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry.translate(-W / 2, H, 0);
      o.geometry.scale(UNIT, UNIT, UNIT);
    }
  });
  root.traverse((o) => {
    const p = o.userData.pivot;
    if (!p) return;
    const at = new T.Vector3((p[0] - W / 2) * UNIT, (H - p[1]) * UNIT, p[2] * UNIT);
    for (const c of o.children) if (c.isMesh) c.geometry.translate(-at.x, -at.y, -at.z);
    o.position.copy(at);
    o.userData = {};
  });
}

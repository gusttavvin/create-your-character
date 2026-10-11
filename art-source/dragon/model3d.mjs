/**
 * Models the four approved dragons in 3D, piece by piece, from the same drawings the flat
 * dragon is cut from.
 *
 *   npm run models:dragon
 *
 * Writes public/models/dragon/<row>-<id>.glb for every piece, src/characters/dragon/
 * model-library.json (what each file holds, and the front of every body, measured, for the
 * face to sit on) and docs/dragon-model-validation.json (the glTF validator's report).
 *
 * How a drawing becomes a solid is decided element by element, from what it is drawn as:
 *
 *   outlined and filled, not inside an earlier solid of its piece — a solid: a body, a head,
 *   a horn, a foot, a spike; round where it is round (lofted slice by slice), and a plump
 *   pillow where the shape winds (wings, tails, fins, flames), since slices cannot follow it
 *   filled and outlined but inside an earlier solid (a belly, an eyelid), or filled with no
 *   outline (a highlight, a snout, cheeks, pupils) — painted on that solid's skin
 *   a line with no fill — a tube: wing bones, fingers, lashes, belly stripes
 *   a white outlined circle among the eyes — an eyeball, a ball of its own
 *   the mouth — drawn flat, in front of z = 0: the game lays it on whichever face wears it,
 *   so it follows that face's curve; only what sticks out (fire, bubbles, a tongue) is solid
 *
 * Coordinates: the drawings are 520 by 620 with y down. Every piece keeps its place in its
 * drawing, so the game can put a borrowed piece where the flat dragon puts it: x is
 * (x - 260) * UNIT, y is (620 - y) * UNIT, and z is forward.
 *
 * The functions that turn an outline into a solid are the monster's (art-source/approved/
 * model-library.mjs), copied here so the monster's models cannot change by accident.
 */
import fs from 'node:fs/promises';
import * as T from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOMParser } from '@xmldom/xmldom';
import validator from 'gltf-validator';

globalThis.DOMParser = class extends DOMParser {
  parseFromString(...args) {
    const doc = super.parseFromString(...args);
    doc.documentElement.querySelectorAll = (selector) =>
      selector.split(',').flatMap((tag) => Array.from(doc.getElementsByTagName(tag.trim())));
    doc.querySelectorAll = doc.documentElement.querySelectorAll;
    return doc;
  }
};
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
const OUT = new URL('../../public/models/dragon/', import.meta.url);
await fs.mkdir(OUT, { recursive: true });

/** Metres per drawing unit: a dragon drawn 540 units tall stands about two metres. */
const UNIT = 0.004;
const INK = '#0b1b3b';

const DRAGONS = [
  { file: '1-Sparky.svg', body: 'classic', wings: 'bat', eyes: 'cute', mouth: 'smile', tail: 'lightning' },
  { file: '2-Blaze.svg', body: 'chubby', wings: 'feather', eyes: 'fierce', mouth: 'fire', tail: 'fire' },
  { file: '3-Splash.svg', body: 'tall', wings: 'butterfly', eyes: 'big', mouth: 'teeth', tail: 'ice' },
  { file: '4-Pip.svg', body: 'spiky', wings: 'tiny', eyes: 'star', mouth: 'tongue', tail: 'leaf' },
];
const ROWS = ['tail', 'wings', 'body', 'eyes', 'mouth'];

/* ------------------------------------------------------------ reading a drawing */
function attrsOf(s) {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}
/** Same rule as gen.cjs: the comment that starts a section says its row. */
function rowOf(comment) {
  const c = comment.toLowerCase();
  if (/\btail\b/.test(c)) return 'tail';
  if (/\bwings?\b/.test(c)) return 'wings';
  if (/\beyes\b/.test(c)) return 'eyes';
  if (/mouth|smile/.test(c)) return 'mouth';
  return 'body';
}
async function read(file) {
  const src = await fs.readFile(new URL(file, HERE), 'utf8');
  const gradients = {};
  for (const m of src.matchAll(/<linearGradient([^>]*)>([\s\S]*?)<\/linearGradient>/g)) {
    const a = attrsOf(m[1]);
    const stops = [...m[2].matchAll(/<stop([^>]*)\/>/g)].map((s) => attrsOf(s[1])['stop-color']);
    gradients[a.id] = stops;
  }
  const body = src.slice(src.indexOf('<g '), src.lastIndexOf('</g>'));
  const sw = +attrsOf(body.slice(0, body.indexOf('>')))['stroke-width'];
  const rows = Object.fromEntries(ROWS.map((r) => [r, []]));
  let row = 'body';
  for (const m of body.matchAll(/<!--([\s\S]*?)-->|<(path|ellipse|circle)\s([^>]*?)\/>/g)) {
    if (m[1] !== undefined) {
      row = rowOf(m[1]);
      continue;
    }
    const a = attrsOf(m[3]);
    let d = a.d;
    if (m[2] !== 'path') {
      const cx = +a.cx;
      const cy = +a.cy;
      const rx = +(a.rx ?? a.r);
      const ry = +(a.ry ?? a.r);
      d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    rows[row].push({
      tag: m[2],
      d,
      fill: a.fill && a.fill !== 'none' ? a.fill : null,
      stroke: a.stroke === 'none' ? null : (a.stroke ?? INK),
      sw: +(a['stroke-width'] ?? sw),
      r: +(a.r ?? 0),
      dx: 0,
      dy: 0,
    });
  }
  return { gradients, rows };
}

/* ------------------------------------------------------------------ materials */
const materials = new Map();
/** A painted colour; skin is named so the game can repaint a tail or an eyelid to its body. */
function material(fill, gradients) {
  const grad = /^url\(#(.+)\)$/.exec(fill ?? '');
  const colour = grad ? gradients[grad[1]][1] ?? gradients[grad[1]][0] : fill;
  const name = grad?.[1] === 'skin' ? 'Skin' : `Paint_${colour.replace('#', '')}`;
  const key = `${name}|${colour}`;
  if (!materials.has(key)) {
    const m = new T.MeshStandardMaterial({
      color: colour,
      roughness: colour.toLowerCase() === '#ffffff' ? 0.28 : 0.58,
      metalness: 0,
    });
    m.name = name;
    materials.set(key, m);
  }
  return materials.get(key);
}

/* ------------------------------------------- from an outline to a solid (monster's) */
function paths(p) {
  return new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${p.d}"/></svg>`).paths[0];
}
function outline(p) {
  const path = paths(p);
  const s = path.toShapes()[0];
  const curves = (p.d.match(/[CSQAcsqa]/g) || []).length || 1;
  const pts = s.getPoints(Math.max(2, Math.min(48, Math.ceil(350 / curves)))).map((v) => v.add(new T.Vector2(p.dx, p.dy)));
  return { s, pts, box: new T.Box2().setFromPoints(pts) };
}
function geoFrom(pos, idx) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function inside(x, y, pts) {
  let yes = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}
function distance(x, y, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const t = T.MathUtils.clamp(((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    d = Math.min(d, Math.hypot(x - a.x - t * vx, y - a.y - t * vy));
  }
  return d;
}
function sections(pts, axis = 'y') {
  const bb = new T.Box2().setFromPoints(pts);
  const lo = bb.min[axis];
  const hi = bb.max[axis];
  const other = axis === 'y' ? 'x' : 'y';
  return (v) => {
    const cross = [];
    v = T.MathUtils.clamp(v, lo + 0.001, hi - 0.001);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[axis] <= v && b[axis] > v) || (b[axis] <= v && a[axis] > v))
        cross.push(a[other] + ((v - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other]));
    }
    return cross.length
      ? [Math.min(...cross), Math.max(...cross)]
      : [bb.getCenter(new T.Vector2())[other], bb.getCenter(new T.Vector2())[other]];
  };
}
/** A closed volume, round in every slice. */
function loft(p, depthRatio = 0.78, exponent = 2) {
  const { pts, box } = outline(p);
  const size = box.getSize(new T.Vector2());
  const cut = sections(pts);
  // a toe or a horn needs far fewer slices than the whole body to look just as round
  const rings = Math.round(T.MathUtils.clamp(16 + size.y / 3, 24, 88));
  const sides = Math.round(T.MathUtils.clamp(16 + size.x / 4, 24, 48));
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
    const cap = Math.sqrt(Math.max(0, Math.min(1, edge / (size.y * 0.11))));
    return { cx: (l + r) / 2, rx, rz: rx * depthRatio * cap };
  }
  for (let i = 0; i <= rings; i++) {
    const y = box.min.y + (size.y * i) / rings;
    const { cx, rx, rz } = section(y);
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
    const y = box.min.y + (size.y * i) / rings;
    const { cx } = section(y);
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
    const q = section(y);
    const f = 1 - Math.pow(Math.abs((x - q.cx) / (q.rx || 1)), exponent);
    return f >= 0 ? q.rz * Math.pow(f, 1 / exponent) : -Infinity;
  };
  return { geo, front, pts, box };
}
function ball(p) {
  const { box, pts } = outline(p);
  const sz = box.getSize(new T.Vector2());
  const c = box.getCenter(new T.Vector2());
  const rx = sz.x / 2;
  const ry = sz.y / 2;
  const rz = Math.min(rx, ry) * 0.72;
  const g = new T.SphereGeometry(1, 40, 28);
  g.scale(rx, ry, rz);
  g.translate(c.x, -c.y, 0);
  return {
    geo: g,
    pts,
    box,
    front: (x, y) => {
      const f = 1 - ((x - c.x) / rx) ** 2 - ((y - c.y) / ry) ** 2;
      return f >= 0 ? rz * Math.sqrt(f) : -Infinity;
    },
  };
}
/** A rounded solid of any flat shape: plump ones are rounded right to their middle. */
function roundedSolid(p, ratio = 1, plump = false) {
  const { pts, box } = outline(p);
  const sz = box.getSize(new T.Vector2());
  const center = box.getCenter(new T.Vector2());
  const res = 72;
  const flatSpan = Math.max(sz.x, sz.y) * 1.12;
  let deepest = 0;
  for (let iy = 0; iy < res; iy++)
    for (let ix = 0; ix < res; ix++) {
      const x = center.x + (ix / res - 0.5) * flatSpan;
      const y = center.y + (iy / res - 0.5) * flatSpan;
      if (inside(x, y, pts)) deepest = Math.max(deepest, distance(x, y, pts));
    }
  const depth = plump ? deepest * ratio : Math.min(sz.x, sz.y) * 0.26 * ratio;
  const span = Math.max(sz.x, sz.y, depth * 2) * 1.12;
  const mc = new MarchingCubes(res, new T.MeshBasicMaterial(), false, false, 120000);
  mc.isolation = 0;
  const dist = new Float32Array(res * res);
  for (let iy = 0; iy < res; iy++)
    for (let ix = 0; ix < res; ix++) {
      const x = center.x + (ix / res - 0.5) * span;
      const y = center.y + (iy / res - 0.5) * span;
      dist[iy * res + ix] = distance(x, y, pts) * (inside(x, y, pts) ? 1 : -1);
    }
  const front = (x, y) => {
    if (!inside(x, y, pts)) return -Infinity;
    const d = distance(x, y, pts);
    return Math.sqrt(Math.max(0, 2 * depth * Math.min(d, depth) - Math.min(d, depth) ** 2)) * 0.85;
  };
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const d = dist[iy * res + ix];
        const z = ((iz / res - 0.5) * span) / 0.85;
        const h = d > 0 ? 2 * depth * Math.min(d, depth) - Math.min(d, depth) ** 2 : 0;
        mc.field[iz * res * res + iy * res + ix] = d <= 0 ? d - Math.abs(z) : Math.sqrt(h) - Math.abs(z);
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
  return { geo: welded, front, pts, box };
}
/** A painted region, finely cut so it follows the curve of what it is painted on. */
function decal(p, front, lift = 1.1) {
  const { s } = outline(p);
  const base = new T.ShapeGeometry(s, Math.max(2, Math.min(16, Math.ceil(160 / s.curves.length)))).toNonIndexed();
  let triangles = Array.from(base.attributes.position.array);
  for (let it = 0; it < 5; it++) {
    const next = [];
    for (let i = 0; i < triangles.length; i += 9) {
      const a = triangles.slice(i, i + 3);
      const b = triangles.slice(i + 3, i + 6);
      const c = triangles.slice(i + 6, i + 9);
      if (Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1])) < 6) {
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
    const x = triangles[i] + p.dx;
    const y = triangles[i + 1] + p.dy;
    triangles[i] = x;
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
/** A stroke as a tube lying on whatever is under it. */
function line(p, front = () => 0, radius = p.sw / 2) {
  const groups = [];
  for (const sub of paths(p).subPaths) {
    const ps = sub
      .getPoints(Math.max(2, Math.min(40, Math.round(160 / Math.max(1, sub.curves.length)))))
      .map((v) => {
        const x = v.x + p.dx;
        const y = v.y + p.dy;
        const z = front(x, y);
        return new T.Vector3(x, -y, (Number.isFinite(z) ? z : 0) + radius * 0.45 + 1);
      });
    if (ps.length < 2) continue;
    groups.push(new T.TubeGeometry(new T.CatmullRomCurve3(ps), Math.min(160, Math.max(20, ps.length)), radius, 8, false));
    for (const pt of [ps[0], ps.at(-1)]) {
      const g = new T.SphereGeometry(radius, 10, 8);
      g.translate(...pt.toArray());
      groups.push(g);
    }
  }
  return mergeGeometries(groups);
}

/* ------------------------------------------------------------- a whole piece */
/** How much of an outline lies inside another. */
function insideShare(p, host) {
  const { pts } = outline(p);
  return pts.filter((v) => inside(v.x, v.y, host.pts)).length / pts.length;
}
/** Whether a shape winds (a tail, a wing, a flame) rather than being round in every slice. */
function winding(p) {
  const { pts, box } = outline(p);
  const cut = sections(pts);
  const size = box.getSize(new T.Vector2());
  let filled = 0;
  let total = 0;
  for (let k = 1; k < 20; k++) {
    const y = box.min.y + (size.y * k) / 20;
    const [l, r] = cut(y);
    for (let j = 1; j < 10; j++) {
      const x = l + ((r - l) * j) / 10;
      total++;
      if (inside(x, y, pts)) filled++;
    }
  }
  return filled / total < 0.92;
}

function build(row, els, gradients) {
  const root = new T.Group();
  const hosts = [];
  const eyes = [];
  const groups = { root };
  if (row === 'wings')
    for (const name of ['WingL', 'WingR']) {
      const g = new T.Group();
      g.name = name;
      root.add(g);
      groups[name] = g;
    }
  /** The middle of what is drawn: an open line has no outline, so its points are used. */
  const centreOf = (p) => {
    const pts = paths(p).subPaths.flatMap((sub) => sub.getPoints(12));
    return new T.Box2().setFromPoints(pts).getCenter(new T.Vector2());
  };
  const groupFor = (p) => {
    if (row === 'wings') return groups[centreOf(p).x < 260 ? 'WingL' : 'WingR'];
    if (row === 'eyes') {
      const c = centreOf(p);
      const eye = eyes.find((e) => inside(c.x, c.y, e.host.pts));
      if (eye) return eye.group;
    }
    return root;
  };
  const front = (x, y) => Math.max(0, ...hosts.map((h) => h.front(x, y)));
  const add = (geo, p, name, group) => {
    const m = new T.Mesh(geo, material(p.stroke && !p.fill ? p.stroke : p.fill, gradients));
    m.name = name;
    group.add(m);
  };
  els.forEach((p, i) => {
    const name = `${row}_${i}`;
    // the mouth is drawn flat: only what sticks out of the face is solid
    if (row === 'mouth') {
      const first = i === 0;
      const out = !first && p.fill && hosts[0] && insideShare(p, hosts[0]) < 0.85;
      if (p.fill && (first || !out)) {
        const flat = { ...outline(p), front: () => 0 };
        add(decal(p, () => 0, 1 + i * 0.3), p, `${name}_flat`, root);
        if (first) hosts.push(flat);
      } else if (p.fill) {
        const solid = p.tag === 'path' ? roundedSolid(p, 0.7, true) : ball(p);
        add(solid.geo, p, `${name}_solid`, root);
      } else if (p.stroke) add(line(p, () => 1.5, p.sw * 0.45), p, `${name}_line`, root);
      return;
    }
    // a white outlined circle among the eyes is an eyeball, in a group of its own
    if (row === 'eyes' && p.tag === 'circle' && p.fill?.toLowerCase() === '#ffffff' && p.stroke && p.r >= 25) {
      const g = new T.Group();
      g.name = `Eye${eyes.length ? 'R' : 'L'}`;
      root.add(g);
      const b = ball(p);
      add(b.geo, p, `${name}_ball`, g);
      const c = b.box.getCenter(new T.Vector2());
      g.userData.centre = [c.x, c.y];
      eyes.push({ group: g, host: b });
      hosts.push(b);
      return;
    }
    const group = groupFor(p);
    if (!p.fill) {
      // a stroke: the thin dark outline over a wing bone is only the drawing's ink
      if (p.stroke?.toLowerCase() === INK && p.sw <= 2.5 && row === 'wings') return;
      add(line(p, front, Math.max(1.2, p.sw * (row === 'wings' && p.sw >= 6 ? 0.5 : 0.4))), p, `${name}_line`, group);
      return;
    }
    // a lid lies on the very edge of its eyeball, so half inside is enough there
    const share = row === 'eyes' ? 0.5 : 0.85;
    const host = [...hosts].reverse().find((h) => insideShare(p, h) >= share);
    if (!p.stroke || host) {
      const h = host ?? hosts.at(-1);
      add(decal(p, h ? h.front : front, 1.2 + i * 0.05), p, `${name}_paint`, group);
      return;
    }
    let solid;
    if (row === 'wings') solid = roundedSolid(p, 0.22);
    else if (row === 'eyes') solid = roundedSolid(p, 0.5, true);
    else if (/url\(#(fin|flame|wing)\)/.test(p.fill)) solid = roundedSolid(p, 0.45, true);
    else if (winding(p)) solid = roundedSolid(p, 0.85, true);
    else solid = loft(p, row === 'body' ? 0.82 : 0.9);
    add(solid.geo, p, `${name}_solid`, group);
    hosts.push(solid);
  });
  return { root, hosts, eyes };
}

/** From drawing units to metres: x about the middle, y up from the floor of the drawing. */
function toMetres(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry.translate(-260, 620, 0);
      o.geometry.scale(UNIT, UNIT, UNIT);
    }
  });
}

/* --------------------------------------------------------------------- writing */
const catalogue = {};
const reports = [];
for (const d of DRAGONS) {
  const drawing = await read(d.file);
  for (const row of ROWS) {
    const id = d[row];
    const { root, hosts, eyes } = build(row, drawing.rows[row], drawing.gradients);
    root.name = `${row}_${id}`;
    const meta = { row, id, url: `models/dragon/${row}-${id}.glb`, group: root.name };
    if (row === 'body') {
      // the front of the body, in drawing units, every 10 units: the face sits on it
      const nx = 53;
      const ny = 63;
      const heights = [];
      for (let iy = 0; iy < ny; iy++)
        for (let ix = 0; ix < nx; ix++) {
          const x = ix * 10;
          const y = iy * 10;
          const z = Math.max(-1, ...hosts.map((h) => h.front(x, y)));
          heights.push(Math.round((Number.isFinite(z) ? z : -1) * 10) / 10);
        }
      meta.surface = { step: 10, nx, ny, heights };
      meta.depth = Math.max(...heights);
    }
    if (row === 'eyes') meta.eyes = eyes.map((e) => ({ group: e.group.name, centre: e.group.userData.centre }));
    toMetres(root);
    const data = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });
    await fs.writeFile(new URL(`${row}-${id}.glb`, OUT), Buffer.from(data));
    const validation = await validator.validateBytes(new Uint8Array(data), { maxIssues: 20 });
    let tris = 0;
    root.traverse((o) => {
      if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    reports.push({ piece: `${row}-${id}`, bytes: data.byteLength, triangles: tris, errors: validation.issues.numErrors, warnings: validation.issues.numWarnings });
    if (validation.issues.numErrors) throw new Error(`${row}-${id}: ${JSON.stringify(validation.issues)}`);
    catalogue[`${row}:${id}`] = meta;
    console.log(`${row}-${id}`.padEnd(18), data.byteLength, Math.round(tris), validation.issues.numWarnings ? `${validation.issues.numWarnings} warnings` : '');
  }
}
await fs.writeFile(new URL('../../src/characters/dragon/model-library.json', import.meta.url), JSON.stringify({ unit: UNIT, pieces: catalogue }));
await fs.writeFile(new URL('../../docs/dragon-model-validation.json', import.meta.url), JSON.stringify(reports, null, 2));

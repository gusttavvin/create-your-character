/** Offline modelling from the approved silhouettes. Run with Node 24: node art-source/approved/model-library.mjs.
 * Bodies use closed elliptical cross sections, eyes use ellipsoids, markings follow their
 * supporting surface. Branched hands use a closed implicit solid, not stacked SVG planes.
 * Artistic depth choices live here; bounds and attachment samples are measured from meshes.
 */
import fs from "node:fs/promises";
import * as T from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import {
  mergeVertices,
  mergeGeometries,
} from "three/addons/utils/BufferGeometryUtils.js";
import { DOMParser } from "@xmldom/xmldom";
import validator from "gltf-validator";
import {
  MONSTER_PIECES,
  MONSTER_PART_RECT,
} from "../../src/characters/monster/paths3d.ts";

globalThis.DOMParser = class extends DOMParser {
  parseFromString(...args) {
    const doc = super.parseFromString(...args);
    doc.documentElement.querySelectorAll = (selector) =>
      selector
        .split(",")
        .flatMap((tag) => Array.from(doc.getElementsByTagName(tag.trim())));
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
      this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const out = new URL("../../public/models/monster/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const unit = 0.002;
const rows = {
  body: ["egg", "square", "hourglass"],
  eyes: ["stalks", "multiple", "one"],
  mouth: ["smile", "fangs", "beak"],
  // fuzzy arms were the orange model's own until Clara found them nothing like the drawing:
  // now they are modelled from it, furry outline and all, like the claw
  arms: ["claw", "tentacle", "pincher", "fuzzy"],
  // paws were the orange model's own feet until Clara asked for them to look like the
  // drawing in the options, and green: now they are modelled from it like the others
  legs: ["paws", "bird", "long", "snake"],
};
const solids = {
  egg: [0, 1, 2, 4, 16],
  square: [8, 9, 12, 13, 19],
  hourglass: [2, 3, 16, 25],
  claw: [0, 1, -100, -104],
  long: [-100, -101, -102, -103],
  // the two furry paws; their pale soles are marks on them and their toes are lines
  paws: [-100, -101],
  // the four octopus tentacles; their suckers are marks on them
  tentacle: [-100, -101, -102, -103],
  // the two furry arms, each an upper arm and a mitten
  fuzzy: [-100, -101, -102, -103],
};
const FUZZY_MITTENS = [-102, -103];
// Painted lighting in the flat art is replaced by real lighting. Freckles, cheeks and bellies remain.
const skip = {
  egg: [22, 23, 24],
  square: [10, 14, 18, 20],
  hourglass: [4, 5, 17, 23, 24, 26, 48],
};
const materials = new Map();
function material(color) {
  if (!materials.has(color)) {
    const m = new T.MeshStandardMaterial({
      color,
      roughness: color.toLowerCase() === "#ffffff" ? 0.28 : 0.58,
      metalness: 0,
    });
    m.name = `Region_${color.replace("#", "")}`;
    materials.set(color, m);
  }
  return materials.get(color);
}
function paths(p) {
  return new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${p.d}"/></svg>`,
  ).paths[0];
}
function outline(p) {
  const path = paths(p);
  const s = path.toShapes()[0];
  const curves = (p.d.match(/[CSQAcsqa]/g) || []).length || 1;
  const pts = s
    .getPoints(Math.max(2, Math.min(48, Math.ceil(350 / curves))))
    .map((v) => v.add(new T.Vector2(p.dx, p.dy)));
  return { s, pts, box: new T.Box2().setFromPoints(pts) };
}
function mesh(group, geo, color, name) {
  const m = new T.Mesh(geo, material(color));
  m.name = name;
  group.add(m);
  return m;
}
function geoFrom(pos, idx) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function inside(x, y, pts) {
  let yes = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
function distance(x, y, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const vx = b.x - a.x,
      vy = b.y - a.y;
    const t = T.MathUtils.clamp(
      ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1),
      0,
      1,
    );
    d = Math.min(d, Math.hypot(x - a.x - t * vx, y - a.y - t * vy));
  }
  return d;
}
function sections(pts, axis = "y") {
  const bb = new T.Box2().setFromPoints(pts);
  const lo = bb.min[axis],
    hi = bb.max[axis];
  const other = axis === "y" ? "x" : "y";
  return (v) => {
    const cross = [];
    v = T.MathUtils.clamp(v, lo + 0.001, hi - 0.001);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      if ((a[axis] <= v && b[axis] > v) || (b[axis] <= v && a[axis] > v))
        cross.push(
          a[other] +
            ((v - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other]),
        );
    }
    return cross.length
      ? [Math.min(...cross), Math.max(...cross)]
      : [
          bb.getCenter(new T.Vector2())[other],
          bb.getCenter(new T.Vector2())[other],
        ];
  };
}
/** A closed volume with a separately designed depth profile. No flat back or extruded walls. */
function loft(p, depthRatio = 0.78, exponent = 2) {
  const { pts, box } = outline(p),
    size = box.getSize(new T.Vector2()),
    cut = sections(pts);
  const rings = 88,
    sides = 48,
    pos = [],
    idx = [];
  const top = cut(box.min.y + 0.001),
    bottom = cut(box.max.y - 0.001);
  function section(y) {
    const [l, r] = cut(y),
      rx = (r - l) / 2;
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
      const a = (j / sides) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      pos.push(
        cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent),
        -y,
        rz * Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent),
      );
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  // Collapse the top/bottom rings to their centres, giving explicit closed caps.
  for (const i of [0, rings]) {
    const y = box.min.y + (size.y * i) / rings;
    const { cx } = section(y);
    for (let j = 0; j <= sides; j++) {
      const n = (i * (sides + 1) + j) * 3;
      pos[n] = cx;
      pos[n + 2] = 0;
    }
  }
  let geo = mergeVertices(geoFrom(pos, idx), 0.00001);
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
  const { box, pts } = outline(p),
    sz = box.getSize(new T.Vector2()),
    c = box.getCenter(new T.Vector2());
  const rx = sz.x / 2,
    ry = sz.y / 2,
    rz = Math.min(rx, ry) * 0.72;
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
/** Closed branched solids, retaining the measured four-finger silhouette and open gaps. */
/**
 * A solid of a flat shape, rounded at its edge.
 *
 * Its edge is rounded over `depth`, a share of its narrower side; inside that it is flat
 * front and back. A `plump` one is rounded all the way to its middle instead, like a
 * pillow — the fuzzy arms were flat slabs whose square top edge looked cut off.
 */
function roundedSolid(p, ratio = 1, plump = false) {
  const { pts, box } = outline(p);
  const sz = box.getSize(new T.Vector2());
  const center = box.getCenter(new T.Vector2()),
    res = 86;
  // the grid is laid out over the flat shape first, to find how far in its middle is
  const flatSpan = Math.max(sz.x, sz.y) * 1.12;
  let deepest = 0;
  for (let iy = 0; iy < res; iy++)
    for (let ix = 0; ix < res; ix++) {
      const x = center.x + (ix / res - 0.5) * flatSpan,
        y = center.y + (iy / res - 0.5) * flatSpan;
      if (inside(x, y, pts)) deepest = Math.max(deepest, distance(x, y, pts));
    }
  const depth = plump ? deepest * ratio : Math.min(sz.x, sz.y) * 0.26 * ratio;
  const span = Math.max(sz.x, sz.y, depth * 2) * 1.12;
  const mc = new MarchingCubes(res, material(p.fill), false, false, 120000);
  mc.isolation = 0;
  const dist = new Float32Array(res * res);
  const step = span / res;
  for (let iy = 0; iy < res; iy++)
    for (let ix = 0; ix < res; ix++) {
      const x = center.x + (ix / res - 0.5) * span,
        y = center.y + (iy / res - 0.5) * span;
      dist[iy * res + ix] = distance(x, y, pts) * (inside(x, y, pts) ? 1 : -1);
    }
  // Smooth elliptical cross section within the contour, bounded by the chosen palm depth.
  const front = (x, y) => {
    if (!inside(x, y, pts)) return -Infinity;
    const d = distance(x, y, pts);
    return (
      Math.sqrt(
        Math.max(0, 2 * depth * Math.min(d, depth) - Math.min(d, depth) ** 2),
      ) * 0.85
    );
  };
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const d = dist[iy * res + ix],
          z = ((iz / res - 0.5) * span) / 0.85;
        const h =
          d > 0 ? 2 * depth * Math.min(d, depth) - Math.min(d, depth) ** 2 : 0;
        mc.field[iz * res * res + iy * res + ix] =
          d <= 0 ? d - Math.abs(z) : Math.sqrt(h) - Math.abs(z);
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
  // y is inverted from SVG space, so reverse the triangle winding.
  for (let i = 0; i < arr.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const t = arr[i + 3 + j];
      arr[i + 3 + j] = arr[i + 6 + j];
      arr[i + 6 + j] = t;
    }
  g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
  let welded = mergeVertices(g, 0.005);
  welded.computeVertexNormals();
  mc.geometry.dispose();
  return { geo: welded, front, pts, box };
}
/** Fine triangulation lets a painted region follow the actual host without large flat facets. */
function decal(p, front, lift = 1.1) {
  const { s } = outline(p);
  let base = new T.ShapeGeometry(
    s,
    Math.max(2, Math.min(16, Math.ceil(160 / s.curves.length))),
  ).toNonIndexed();
  let triangles = Array.from(base.attributes.position.array);
  for (let it = 0; it < 5; it++) {
    const next = [];
    for (let i = 0; i < triangles.length; i += 9) {
      const a = triangles.slice(i, i + 3),
        b = triangles.slice(i + 3, i + 6),
        c = triangles.slice(i + 6, i + 9);
      if (
        Math.max(
          Math.hypot(a[0] - b[0], a[1] - b[1]),
          Math.hypot(c[0] - b[0], c[1] - b[1]),
          Math.hypot(a[0] - c[0], a[1] - c[1]),
        ) < 6
      ) {
        next.push(...a, ...b, ...c);
        continue;
      }
      const ab = a.map((v, j) => (v + b[j]) / 2),
        bc = b.map((v, j) => (v + c[j]) / 2),
        ca = c.map((v, j) => (v + a[j]) / 2);
      next.push(
        ...a,
        ...ab,
        ...ca,
        ...ab,
        ...b,
        ...bc,
        ...ca,
        ...bc,
        ...c,
        ...ab,
        ...bc,
        ...ca,
      );
    }
    triangles = next;
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const x = triangles[i] + p.dx,
      y = triangles[i + 1] + p.dy;
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
  g.setAttribute("position", new T.Float32BufferAttribute(triangles, 3));
  const w = mergeVertices(g, 0.0001);
  w.computeVertexNormals();
  return w;
}
function line(p, front = () => 0, radius = p.sw / 2) {
  const groups = [];
  for (const sub of paths(p).subPaths) {
    const ps = sub
      .getPoints(
        Math.max(
          2,
          Math.min(40, Math.round(160 / Math.max(1, sub.curves.length))),
        ),
      )
      .map((v) => {
        const x = v.x + p.dx,
          y = v.y + p.dy;
        const z = front(x, y);
        return new T.Vector3(
          x,
          -y,
          (Number.isFinite(z) ? z : 0) + radius * 0.45 + 1,
        );
      });
    if (ps.length < 2) continue;
    const curve = new T.CatmullRomCurve3(ps);
    groups.push(
      new T.TubeGeometry(
        curve,
        Math.min(160, Math.max(20, ps.length)),
        radius,
        8,
        false,
      ),
    );
    for (const pt of [ps[0], ps.at(-1)]) {
      const g = new T.SphereGeometry(radius, 10, 8);
      g.translate(...pt.toArray());
      groups.push(g);
    }
  }
  return mergeGeometries(groups);
}
/*
 * The paws, as in the picture Clara sent: a soft, thick paw whose edge is a ring of round
 * lobes; on its front a pale pad that stands out from it and runs down past its foot into a
 * rounded tip; and three raised dark-green toes running down the pad to that tip.
 *
 * Lofted slice by slice, the lobes survived only at the sides; inflated from the outline,
 * every valley between two lobes became a sharp crease. So the paw is built the way it looks:
 * a flattened round core with a ring of balls melted into it.
 */
const PAW_TOE = "#2E9A28";
/** Distance to an ellipsoid, near enough for blending. */
function ellipsoid(x, y, z, c, r) {
  const k = Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]);
  return (k - 1) * Math.min(...r);
}
/** Two shapes melted together, with a soft fillet of width k where they meet. */
function blend(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function pawBody(p) {
  const { box, pts } = outline(p);
  const sz = box.getSize(new T.Vector2()),
    c = box.getCenter(new T.Vector2());
  const rx = sz.x / 2,
    ry = sz.y / 2,
    rz = Math.min(rx, ry) * 0.62;
  const lobe = Math.min(rx, ry) * 0.34;
  const ring = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    ring.push([c.x + Math.cos(a) * (rx - lobe * 0.95), c.y + Math.sin(a) * (ry - lobe * 0.95)]);
  }
  const sdf = (x, y, z) => {
    let d = ellipsoid(x, y, z, [c.x, c.y, 0], [rx - lobe * 1.0, ry - lobe * 1.0, rz]);
    for (const [lx, ly] of ring)
      d = blend(d, ellipsoid(x, y, z, [lx, ly, 0], [lobe, lobe, rz * 0.5]), lobe * 0.7);
    return d;
  };
  const res = 64,
    span = Math.max(sz.x, sz.y) * 1.15;
  const mc = new MarchingCubes(res, material(p.fill), false, false, 200000);
  mc.isolation = 0;
  for (let iz = 0; iz < res; iz++)
    for (let iy = 0; iy < res; iy++)
      for (let ix = 0; ix < res; ix++) {
        const x = c.x + (ix / res - 0.5) * span,
          y = c.y + (iy / res - 0.5) * span,
          z = (iz / res - 0.5) * span;
        mc.field[iz * res * res + iy * res + ix] = -sdf(x, y, z);
      }
  mc.update();
  const count = mc.geometry.drawRange.count;
  const arr = mc.geometry.attributes.position.array.slice(0, count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.x + (arr[i] * span) / 2;
    arr[i + 1] = -c.y - (arr[i + 1] * span) / 2;
    arr[i + 2] *= span / 2;
  }
  // y is inverted from SVG space, so reverse the triangle winding
  for (let i = 0; i < arr.length; i += 9)
    for (let j = 0; j < 3; j++) {
      const t = arr[i + 3 + j];
      arr[i + 3 + j] = arr[i + 6 + j];
      arr[i + 6 + j] = t;
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
  const welded = mergeVertices(g, 0.01);
  welded.computeVertexNormals();
  mc.geometry.dispose();
  // how far forward the paw's surface is, found by walking in from the front
  const front = (x, y) => {
    for (let z = rz * 1.4; z > -rz; z -= rz / 40) if (sdf(x, y, z) <= 0) return z;
    return -Infinity;
  };
  return { geo: welded, front, pts, box };
}
/** The pale pad: a lens of its own, sitting a little into the paw and a little below it. */
function pawPad(p, hostFront) {
  const { box, pts } = outline(p),
    sz = box.getSize(new T.Vector2()),
    c = box.getCenter(new T.Vector2());
  const rx = (sz.x / 2) * 1.12,
    ry = (sz.y / 2) * 1.3,
    cx = c.x,
    cy = c.y + ry * 0.36,
    rz = Math.min(rx, ry) * 0.55;
  const host = hostFront(cx, cy - ry * 0.3);
  const cz = (Number.isFinite(host) ? host : 0) - rz * 0.55;
  const g = new T.SphereGeometry(1, 48, 32);
  g.scale(rx, ry, rz);
  g.translate(cx, -cy, cz);
  const front = (x, y) => {
    const f = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
    return f >= 0 ? cz + rz * Math.sqrt(f) : -Infinity;
  };
  return { geo: g, pts, box, front, pad: { cx, cy, rx, ry, cz, rz } };
}
/** Three raised toes running down the pad, round at both ends, following its curve. */
function pawToes(pad) {
  const { cx, cy, rx, ry, cz, rz } = pad;
  const r = rx * 0.105;
  const parts = [];
  for (const k of [-0.36, 0, 0.36]) {
    const x = cx + k * rx;
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      // from a little above the middle of the pad, down and round under its tip
      const y = cy - ry * 0.12 + t * ry * 1.02;
      const f = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
      if (f <= 0.02) break;
      pts.push(new T.Vector3(x, -y, cz + rz * Math.sqrt(f) + r * 0.25));
    }
    if (pts.length < 3) continue;
    parts.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, r, 14, false));
    for (const q of [pts[0], pts.at(-1)]) {
      const cap = new T.SphereGeometry(r, 14, 10);
      cap.translate(q.x, q.y, q.z);
      parts.push(cap);
    }
  }
  // tubes and caps are all indexed, with the same attributes, so they join as they are
  return mergeGeometries(parts);
}

const catalogue = {};
const reports = [];
for (const [row, ids] of Object.entries(rows))
  for (const id of ids) {
    const root = new T.Group();
    root.name = `${row}_${id}`;
    const source = MONSTER_PIECES[id];
    const hosts = [];
    const eyeGroups = [];
    const overallFront = (x, y) =>
      Math.max(0, ...hosts.map((h) => h.front(x, y)));
    for (const p of source.pieces) {
      if (skip[id]?.includes(p.i)) continue;
      let group = root;
      const isEye =
        row === "eyes" && p.fill?.toLowerCase() === "#ffffff" && p.stroke;
      if (isEye) {
        group = new T.Group();
        group.name = `Olho_${eyeGroups.length + 1}`;
        root.add(group);
        eyeGroups.push({ group, p });
      } else if (row === "eyes" && p.fill && eyeGroups.length) {
        group = eyeGroups.reduce((a, b) =>
          Math.hypot(p.cx - a.p.cx, p.cy - a.p.cy) <
          Math.hypot(p.cx - b.p.cx, p.cy - b.p.cy)
            ? a
            : b,
        ).group;
      }
      const solid =
        p.fill &&
        (row === "body"
          ? solids[id].includes(p.i)
          : row === "eyes"
            ? isEye
            : row === "arms"
              ? (solids[id]?.includes(p.i) ?? true)
              : row === "legs"
                ? (solids[id]?.includes(p.i) ?? true)
                : row === "mouth"
                  ? id !== "smile"
                  : false);
      if (solid) {
        const bodyMain = row === "body" && p.area > 30000;
        const surface =
          isEye ||
          (row === "body" && [1, 2, 3, 12].includes(p.i) && p.d.includes(" a "))
            ? ball(p)
            : row === "arms"
              ? id === "fuzzy"
                ? // furry arms are plump all through; the mittens, painted over the ends of
                  // their arms, are plumper still, so the arm's end does not show across them
                  roundedSolid(p, FUZZY_MITTENS.includes(p.i) ? 1 : 0.8, true)
                : roundedSolid(p, 0.85)
              : id === "paws"
                ? pawBody(p)
                : loft(
                  p,
                  bodyMain
                    ? 0.85
                    : row === "mouth"
                      ? 0.6
                      : row === "legs"
                        ? 1.05
                        : 0.9,
                  id === "square" && bodyMain ? 3 : 2,
                );
        mesh(group, surface.geo, p.fill, `${id}_${p.i}_solid`);
        hosts.push({ ...surface, p, group });
        if (isEye) {
          group.userData.attachment = [p.cx, p.cy, 0];
        }
      } else if (p.fill && id === "paws") {
        // found by the middle of its own outline: the measured cx/cy of a shape drawn with arcs
        // is off, and put the right paw's pad inside the left paw
        const mid = outline(p).box.getCenter(new T.Vector2());
        const host = hosts.filter((h) => inside(mid.x, mid.y, h.pts)).at(-1);
        const pad = pawPad(p, host?.front ?? overallFront);
        mesh(group, pad.geo, p.fill, `${id}_${p.i}_pad`);
        mesh(group, pawToes(pad.pad), PAW_TOE, `${id}_${p.i}_toes`);
        hosts.push({ ...pad, p, group });
      } else if (p.stroke && id === "paws") {
        // the toes are built with their pad, following its curve
      } else if (p.fill) {
        const candidates = hosts.filter((h) => inside(p.cx, p.cy, h.pts));
        const host = candidates.at(-1);
        const f = host?.front ?? overallFront;
        const lift =
          (row === "body" ? 2.4 : 1.5) + source.pieces.indexOf(p) * 0.07;
        mesh(group, decal(p, f, lift), p.fill, `${id}_${p.i}_mark`);
      } else if (p.stroke) {
        const antenna = row === "body" && p.area < 4000 && p.cy < 120;
        const stalk = row === "eyes" && p.i < 0;
        mesh(
          group,
          line(
            p,
            antenna || stalk ? () => 0 : overallFront,
            Math.max(1, p.sw * 0.4),
          ),
          p.stroke,
          `${id}_${p.i}_line`,
        );
      }
    }
    root.updateMatrixWorld(true);
    const before = new T.Box3().setFromObject(root),
      mid = before.getCenter(new T.Vector3());
    const offset = new T.Vector3(-mid.x, -before.min.y, -mid.z);
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.translate(...offset.toArray());
        o.geometry.scale(unit, unit, unit);
      }
    });
    for (const e of eyeGroups) {
      const a = e.group.userData.attachment;
      e.group.userData.attachment = [
        (a[0] + offset.x) * unit,
        (-a[1] + offset.y) * unit,
        0,
      ];
    }
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3());
    const meta = {
      row,
      id,
      url: `models/monster/${id}.glb`,
      group: root.name,
      min: box.min.toArray(),
      max: box.max.toArray(),
      sourceBox: MONSTER_PART_RECT[id],
      drawingOffset: offset.toArray(),
      unit,
    };
    if (row === "body") {
      const nx = 41,
        ny = 65;
      const ray = new T.Raycaster(),
        meshList = [];
      root.traverse((o) => {
        if (o.isMesh) meshList.push(o);
      });
      const heights = [];
      for (let iy = 0; iy < ny; iy++)
        for (let ix = 0; ix < nx; ix++) {
          const x = box.min.x + (size.x * ix) / (nx - 1),
            y = box.min.y + (size.y * iy) / (ny - 1);
          ray.set(new T.Vector3(x, y, box.max.z + 1), new T.Vector3(0, 0, -1));
          const hit = ray.intersectObjects(meshList, false)[0];
          heights.push(Number((hit?.point.z ?? 0).toFixed(5)));
        }
      meta.surface = { nx, ny, heights };
    }
    const data = await new GLTFExporter().parseAsync(root, {
      binary: true,
      trs: true,
    });
    await fs.writeFile(new URL(`${id}.glb`, out), Buffer.from(data));
    const validation = await validator.validateBytes(new Uint8Array(data), {
      maxIssues: 20,
    });
    let tris = 0;
    root.traverse((o) => {
      if (o.isMesh)
        tris +=
          (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    reports.push({
      id,
      bytes: data.byteLength,
      triangles: tris,
      dimensions: size.toArray(),
      errors: validation.issues.numErrors,
      warnings: validation.issues.numWarnings,
    });
    if (validation.issues.numErrors)
      throw new Error(JSON.stringify(validation.issues));
    catalogue[id] = meta;
    console.log(id, data.byteLength, tris);
  }
// Measure the original GLB's actual skin too; no guessed ellipsoid in the runtime fitter.
{
  const bytes = await fs.readFile(
    new URL("../../public/models/monstrinho.glb", import.meta.url),
  );
  const jsonLength = bytes.readUInt32LE(12),
    gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()),
    bin = 28 + jsonLength;
  const selected = new Set([
    "Corpo",
    "Juba",
    "Rosto",
    "Bochechas",
    "Pintinhas",
    "Chifres",
    "Topete",
  ]);
  const meshes = [];
  function accessor(index) {
    const a = gltf.accessors[index],
      v = gltf.bufferViews[a.bufferView],
      width = a.type === "VEC3" ? 3 : 1,
      sz = a.componentType === 5123 ? 2 : 4;
    const start = bin + (v.byteOffset || 0) + (a.byteOffset || 0);
    const vals = [];
    for (let i = 0; i < a.count; i++)
      for (let j = 0; j < width; j++) {
        const off = start + i * (v.byteStride || width * sz) + j * sz;
        vals.push(
          a.componentType === 5126
            ? bytes.readFloatLE(off)
            : sz === 2
              ? bytes.readUInt16LE(off)
              : bytes.readUInt32LE(off),
        );
      }
    return { vals, width };
  }
  function walk(index, parent, keep) {
    const n = gltf.nodes[index],
      local = n.matrix
        ? new T.Matrix4().fromArray(n.matrix)
        : new T.Matrix4().compose(
            new T.Vector3().fromArray(n.translation || [0, 0, 0]),
            new T.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
            new T.Vector3().fromArray(n.scale || [1, 1, 1]),
          );
    const world = parent.clone().multiply(local);
    keep = keep || selected.has(n.name);
    if (keep && n.mesh != null)
      for (const p of gltf.meshes[n.mesh].primitives) {
        const a = accessor(p.attributes.POSITION),
          geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(a.vals, 3));
        if (p.indices != null) geo.setIndex(accessor(p.indices).vals);
        geo.applyMatrix4(world);
        meshes.push(new T.Mesh(geo, material("#ffffff")));
      }
    for (const child of n.children || []) walk(child, world, keep);
  }
  for (const index of gltf.scenes[gltf.scene || 0].nodes)
    walk(index, new T.Matrix4(), false);
  const group = new T.Group();
  group.add(...meshes);
  group.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(group),
    size = box.getSize(new T.Vector3());
  const nx = 41,
    ny = 65,
    heights = [],
    ray = new T.Raycaster();
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++) {
      ray.set(
        new T.Vector3(
          box.min.x + (size.x * ix) / (nx - 1),
          box.min.y + (size.y * iy) / (ny - 1),
          box.max.z + 1,
        ),
        new T.Vector3(0, 0, -1),
      );
      heights.push(
        Number(
          (ray.intersectObjects(meshes, false)[0]?.point.z ?? 0).toFixed(5),
        ),
      );
    }
  catalogue.round = {
    url: "models/monstrinho.glb",
    group: "Modelo",
    row: "body",
    id: "round",
    min: box.min.toArray(),
    max: box.max.toArray(),
    sourceBox: MONSTER_PART_RECT.round,
    surface: { nx, ny, heights },
  };
}
await fs.writeFile(
  new URL("../../src/characters/monster/model-library.json", import.meta.url),
  JSON.stringify(catalogue),
);
await fs.writeFile(
  new URL("../../docs/monster-model-validation.json", import.meta.url),
  JSON.stringify(reports, null, 2),
);

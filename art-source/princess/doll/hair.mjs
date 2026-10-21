/**
 * Her hair, modelled: a cap melted round the skull (never over her face), with the strands,
 * braid, curls or bun of each style swept or spun on top; each style brings its own tiara and
 * earrings, as in Clara's pictures (the crown comes with the hair, it is not chosen).
 *
 *   braids  red waves with a thick braid of bulbs down her right side, white flowers in it
 *   long    brown hair in wavy strands over her shoulders and down her back, a side fringe
 *   curly   a big black cloud of spiral curls with blue lights
 *   bun     blonde hair pulled back into a tall coiled bun, with a curl at each ear
 */
import * as T from 'three';
import { blob, ellipsoid, ellipsoidField, GOLD, material, merge, mesh, mirrored, pair, ring, sweep, turned, W } from './lib.mjs';
import { HEAD } from './head.mjs';

const CX = W / 2;
const TAU = Math.PI * 2;
// the skull as an ellipsoid, for fields: centre and radii
const SK = { cx: CX, cy: 468, cz: 0, rx: 168, ry: 178, rz: 162 };
const skullE = (x, y, z) => Math.sqrt(((x - SK.cx) / SK.rx) ** 2 + ((y - SK.cy) / SK.ry) ** 2 + ((z - SK.cz) / SK.rz) ** 2);

const COLOUR = {
  braids: { hair: '#b1301c', gem: '#1d9a5a', shine: '#d9573f' },
  long: { hair: '#7a3a16', gem: '#ff4fa0', shine: '#9a5a2a' },
  curly: { hair: '#1b1416', gem: '#2f7be0', shine: '#2a3c6a' },
  bun: { hair: '#f0c24e', gem: '#8a4fd0', shine: '#f7d98a' },
};
const hairMat = (id) => material('Hair', COLOUR[id].hair, { roughness: 0.42 });

/** A point on the skull's surface at angle a (0 = front) and height y, `lift` out. */
function onSkull(a, y, lift = 0) {
  const r = Math.max(0, HEAD.r(y)) + lift;
  return [CX + r * Math.sin(a), y, r * Math.cos(a) * HEAD.depth];
}

/**
 * The cap: a shell `t` thick round the skull, cut away in front of her face below the hairline,
 * with any extra volumes (fields) melted in.
 */
function cap(t, extra = [], { hairline = 350, bottom = 620, res = 96, box } = {}) {
  const field = (x, y, z) => {
    const e = skullE(x, y, z);
    const shell = Math.min((1 + t / 165 - e) * 165, (e - 0.97) * 165);
    // in front of the face (z forward) and below the hairline there is no cap
    const face = Math.max(hairline - y, 20 - z, (e - 1 - t / 165) * 165);
    let f = Math.min(shell, face, bottom - y);
    for (const g of extra) f = Math.max(f, Math.min(g(x, y, z), (e - 0.97) * 165));
    return f;
  };
  return blob(field, box ?? [250, 60, -260, 774, 760, 260], res);
}

/** A lock lying on the skull from angle a0, height y0 to a1, y1, `lift` out, waving a little. */
function lock(a0, y0, a1, y1, lift, rx = 28, rz = 12, wave = 6) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const [x, y, z] = onSkull(a0 + (a1 - a0) * u, y0 + (y1 - y0) * u, lift + wave * Math.sin(u * Math.PI * 2));
    pts.push([x, y, z]);
  }
  return sweep(pts, (u) => rx * (1 - 0.45 * u), (u) => rz * (1 - 0.3 * u), { radial: 10 });
}
/** A wavy strand hanging from (x0, y0, z0) to (x1, y1, z1), waving sideways `wave` pixels. */
function strand(from, to, rx = 24, rz = 15, wave = 12, phase = 0, tension = 0.5) {
  const pts = [];
  const n = 7;
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const w = wave * Math.sin(u * Math.PI * 2 + phase) * Math.sin(u * Math.PI);
    pts.push([ax + (bx - ax) * u + w, ay + (by - ay) * u, az + (bz - az) * u + w * 0.3]);
  }
  return sweep(pts, (u) => rx * (1 - 0.55 * u * u), (u) => rz * (1 - 0.5 * u * u), { radial: 12, tension });
}

/** A spiral curl: a tube wound round an axis from `from` towards `to`, `R` wide. */
function spiral(from, to, R = 15, turns = 3, r = 7, radial = 7) {
  const a = new T.Vector3(...from);
  const b = new T.Vector3(...to);
  const axis = b.clone().sub(a);
  const len = axis.length();
  axis.normalize();
  const up = Math.abs(axis.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
  const u = up.clone().cross(axis).normalize();
  const v = axis.clone().cross(u).normalize();
  const pts = [];
  const n = Math.round(turns * 12);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = t * turns * TAU;
    const p = a.clone().addScaledVector(axis, len * t).addScaledVector(u, R * Math.cos(ang)).addScaledVector(v, R * Math.sin(ang));
    pts.push([p.x, p.y, p.z]);
  }
  return sweep(pts, r, r * 0.8, { radial, seg: Math.round(n * 1.5), tension: 0.5 });
}

/** The tiara: a gold band round the top of the hair with three points and a gem, in front. */
function tiara(root, y, R, gem, depth = 0.9) {
  // the band: an arc round the front two thirds of the hair, rising a little towards the back
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI * 0.68 + (Math.PI * 1.36 * i) / 40;
    pts.push([CX + R * Math.sin(a), y + 26 * (1 - Math.cos(a)) * 0.5, R * Math.cos(a) * depth]);
  }
  const band = sweep(pts, 6, 5, { radial: 8, round: true });
  const z = R * depth;
  const points = [
    ellipsoid(CX, y - 44, z - 14, 12, 34, 9, 12),
    ellipsoid(CX - 46, y - 26, z - 30, 9, 22, 7, 10),
    ellipsoid(CX + 46, y - 26, z - 30, 9, 22, 7, 10),
    ellipsoid(CX - 84, y - 10, z - 64, 7, 14, 6, 8),
    ellipsoid(CX + 84, y - 10, z - 64, 7, 14, 6, 8),
  ];
  mesh(merge([band, ...points]), GOLD(), 'tiara', root);
  mesh(merge([ellipsoid(CX, y - 40, z - 4, 9, 14, 7, 14), ellipsoid(CX - 46, y - 22, z - 20, 6, 8, 5, 10), ellipsoid(CX + 46, y - 22, z - 20, 6, 8, 5, 10)]), material('Gem', gem, { roughness: 0.15 }), 'tiaragems', root);
}
/** Drop earrings at her ears. */
function earrings(root, gem) {
  const x = CX - 172;
  mesh(pair(merge([ellipsoid(x, 582, -6, 5, 5, 5, 10), sweep([[x, 582, -6], [x, 598, -6]], 1.5, 1.5, { radial: 6 })])), GOLD(), 'earhooks', root);
  mesh(pair(ellipsoid(x, 612, -6, 8, 13, 7, 12)), material('Gem', gem, { roughness: 0.15 }), 'eardrops', root);
}

/* ------------------------------------------------------------------ styles */
function braids(root) {
  const m = hairMat('braids');
  // a fuller cap, with waves swept across the top and bulging at the temples
  // (big waves at the temples, in front of the ears, as in her picture)
  const geo = cap(30, [
    ellipsoidField(CX - 150, 470, -20, 70, 120, 90), ellipsoidField(CX + 150, 470, -20, 70, 120, 90),
    ellipsoidField(CX - 178, 505, 42, 52, 120, 58), ellipsoidField(CX + 178, 505, 42, 52, 120, 58),
    ellipsoidField(CX, 330, -30, 150, 90, 150),
  ]);
  mesh(geo, m, 'cap', root);
  // waves over the crown, parted to her left: a thick sweep across the forehead each way
  const waves = [];
  waves.push(lock(0.45, 288, -0.95, 450, 16, 42, 14, 3));
  waves.push(lock(0.45, 288, 1.0, 445, 16, 34, 14, 3));
  for (const [a0, a1, y0, y1] of [[0.35, -0.5, 296, 380], [0.5, 1.4, 320, 470], [0.1, -1.5, 330, 520], [-0.2, -1.9, 320, 560], [0.6, 1.9, 320, 560]]) {
    waves.push(lock(a0, y0, a1, y1, 16, 30, 14, 4));
  }
  // loose curls beside her left cheek (the viewer's left)
  waves.push(spiral([CX - 175, 470, 60], [CX - 205, 640, 40], 16, 3, 9));
  waves.push(spiral([CX - 150, 560, 95], [CX - 178, 690, 70], 13, 2.5, 8));
  mesh(merge(waves), m, 'waves', root);
  // the braid: bulbs alternating down her right side, from behind the ear to below her waist
  const path = [[CX + 160, 500, 40], [CX + 190, 620, 64], [CX + 195, 750, 72], [CX + 180, 880, 72], [CX + 150, 985, 70]];
  const c = new T.CatmullRomCurve3(path.map(([x, y, z]) => new T.Vector3(x, -y, z)));
  const bulbs = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = c.getPointAt(t);
    const k = 1 - 0.55 * t * t;
    const side = i % 2 ? 11 : -11;
    bulbs.push(turned(p.x + side * k, -p.y, p.z, 30 * k, 34 * k, 26 * k, 0, (i % 2 ? 0.5 : -0.5), 14));
  }
  // the tail of the braid
  const tip = c.getPointAt(1);
  bulbs.push(sweep([[tip.x, -tip.y + 10, tip.z], [tip.x - 8, -tip.y + 60, tip.z - 4]], (t) => 16 * (1 - t) + 4, (t) => 12 * (1 - t) + 3, { radial: 8 }));
  mesh(merge(bulbs), m, 'braid', root);
  // white flowers tucked into the braid
  const flowers = [];
  const centres = [];
  for (const [t, dx] of [[0.12, -26], [0.5, 22]]) {
    const p = c.getPointAt(t);
    const fx = p.x + dx, fy = -p.y, fz = p.z + 28;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      flowers.push(turned(fx + 11 * Math.cos(a), fy + 11 * Math.sin(a), fz, 7, 7, 3, 0, a, 8));
    }
    centres.push(ellipsoid(fx, fy, fz + 2, 4.5, 4.5, 3, 8));
  }
  mesh(merge(flowers), material('Petal', '#fbf7ee', { roughness: 0.6 }), 'flowers', root);
  mesh(merge(centres), material('FlowerHeart', '#f2c84b'), 'flowerhearts', root);
  tiara(root, 262, 128, COLOUR.braids.gem, 0.95);
  earrings(root, COLOUR.braids.gem);
}

function long(root) {
  const m = hairMat('long');
  // the cap, with the mass of hair that falls down her back melted into it
  mesh(cap(24, [ellipsoidField(CX, 330, -30, 140, 80, 150), ellipsoidField(CX, 600, -95, 205, 270, 105)], { bottom: 860, box: [220, 60, -300, 804, 900, 260], res: 112 }), m, 'cap', root);
  const strands = [];
  // parted a little off the middle, a thick lock sweeps over the forehead to each temple
  strands.push(lock(0.12, 288, -1.08, 448, 20, 44, 13, 3));
  strands.push(lock(0.12, 288, 1.08, 448, 20, 44, 13, 3));
  // waves all round the back and sides, over the mass, down past her shoulders
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.4 + (Math.PI * 1.2 * i) / (n - 1);
    const spread = 1 + 0.3 * Math.abs(Math.sin(a));
    const [x0, , z0] = onSkull(a, 420, 28);
    const r1 = (HEAD.r(430) + 70) * spread;
    const end = [CX + r1 * Math.sin(a) * 0.95, 900 - 50 * Math.abs(Math.cos(a)), r1 * Math.cos(a) * 0.75 - 30];
    strands.push(strand([x0, 420, z0], end, 42, 20, 12, i * 1.3, 0.3));
  }
  // two locks in front of each shoulder, waving down over her chest
  for (const a of [0.62, -0.62, 0.9, -0.9]) {
    const [x0, , z0] = onSkull(a, 500, 26);
    const out = Math.abs(a) > 0.8 ? 1.15 : 1;
    strands.push(strand([x0, 500, z0], [CX + 205 * out * Math.sin(a), 790 + 30 * (out - 1) * 10, 70 - 30 * (out - 1) * 10], 38, 16, 14, a * 2, 0.3));
  }
  mesh(merge(strands), m, 'strands', root);
  tiara(root, 268, 126, COLOUR.long.gem, 0.95);
  earrings(root, COLOUR.long.gem);
}

function curly(root) {
  const m = hairMat('curly');
  // a big cloud of hair, open where her face is, down to her shoulders
  // (its surface lumpy, as a mass of ringlets is, not a smooth ball)
  const cloud = ellipsoidField(CX, 455, -20, 290, 325, 235);
  const lumps = (x, y, z) => 9 * (Math.cos(x / 23) * Math.cos(y / 21) + Math.cos((x + z) / 19) * Math.cos(y / 27) + Math.cos(z / 22) * Math.cos((x - y) / 25));
  const geo = blob((x, y, z) => {
    const hole = z > 10 ? (Math.sqrt(((x - CX) / 192) ** 2 + ((y - 505) / 182) ** 2) - 1) * 180 : 180;
    return Math.min(cloud(x, y, z) + lumps(x, y, z), hole, (skullE(x, y, z) - 0.97) * 165, 820 - y);
  }, [180, 90, -290, 844, 840, 290], 112);
  mesh(geo, m, 'cloud', root);
  // spiral curls all over the cloud, each wound along the surface's outward direction
  const curls = [];
  const lights = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const N = 190;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const phi = Math.acos(1 - 2 * t);
    const th = golden * i;
    const nx = Math.sin(phi) * Math.cos(th);
    const ny = -Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(th);
    // none on the face, none under the chin
    const y = 455 + 325 * ny;
    if (nz > 0.15 && y > 330 && Math.abs(nx) < 0.75) continue;
    if (y > 790) continue;
    const p0 = [CX + 290 * nx * 0.9, y - 6, -20 + 235 * nz * 0.9];
    const p1 = [CX + 290 * nx * 1.1, y + 34, -20 + 235 * nz * 1.1];
    // every sixth curl catches a blue light
    (i % 6 === 3 ? lights : curls).push(spiral(p0, p1, 16, 2, 8.5, 5));
  }
  mesh(merge(curls), material('Curl', '#221a1c', { roughness: 0.4 }), 'curls', root);
  mesh(merge(lights), material('CurlLight', '#2e4a80', { roughness: 0.35 }), 'lights', root);
  tiara(root, 165, 150, COLOUR.curly.gem, 0.85);
  earrings(root, COLOUR.curly.gem);
}

function bun(root) {
  const m = hairMat('bun');
  // hair pulled smoothly back, rising into a tall bun on top
  const geo = cap(20, [ellipsoidField(CX, 300, -30, 150, 95, 150), ellipsoidField(CX, 200, -25, 118, 70, 112)], { res: 104, box: [250, 40, -260, 774, 760, 260] });
  mesh(geo, m, 'cap', root);
  // the bun: a coil of thick rolls round its middle
  const coil = [];
  coil.push(ellipsoid(CX, 150, -25, 118, 92, 108, 32));
  coil.push(ring(CX, 150, -25, 92, 22, [Math.PI / 2 + 0.35, 0, 0], TAU, 48));
  coil.push(ring(CX, 112, -30, 48, 18, [Math.PI / 2 - 0.3, 0.4, 0], TAU, 40));
  coil.push(ring(CX, 190, -20, 108, 18, [Math.PI / 2 + 0.15, 0, 0], TAU, 48));
  mesh(merge(coil), m, 'bun', root);
  // a soft sweep from a side parting over the forehead, and a curl hanging at each ear
  const locks = [];
  locks.push(lock(0.4, 290, -1.0, 440, 18, 42, 12, 3));
  locks.push(lock(0.4, 290, 1.05, 420, 18, 26, 11, 3));
  const curl = spiral([CX - 182, 470, 40], [CX - 212, 650, 20], 14, 3, 9);
  mesh(merge([...locks, curl, mirrored(curl)]), m, 'locks', root);
  tiara(root, 228, 128, COLOUR.bun.gem, 1.0);
  earrings(root, COLOUR.bun.gem);
}

const STYLES = { braids, long, curly, bun };
export function hair(id) {
  const root = new T.Group();
  STYLES[id](root);
  return root;
}

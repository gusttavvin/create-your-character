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
import { blob, ellipsoid, ellipsoidField, GOLD, lighter, material, merge, mesh, mirrored, pair, ring, smax, sweep, tubeField, turned, W } from './lib.mjs';
import { HEAD } from './head.mjs';

const CX = W / 2;
const TAU = Math.PI * 2;
// the skull as an ellipsoid, for fields: centre and radii
const SK = { cx: CX, cy: 466.5, cz: 0, rx: 167, ry: 173.5, rz: 160 };
const skullE = (x, y, z) => Math.sqrt(((x - SK.cx) / SK.rx) ** 2 + ((y - SK.cy) / SK.ry) ** 2 + ((z - SK.cz) / SK.rz) ** 2);

const COLOUR = {
  braids: { hair: '#b1301c', gem: '#1d9a5a', groove: '#7d1e10' },
  long: { hair: '#7a3a16', gem: '#ff4fa0', groove: '#52250c' },
  curly: { hair: '#1b1416', gem: '#2f7be0', groove: '#0c0809' },
  bun: { hair: '#f0c24e', gem: '#8a4fd0', groove: '#c08f2a' },
};
const hairMat = (id) => material('Hair', COLOUR[id].hair, { roughness: 0.45, gloss: 0.7 });

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
    let f = Math.min(shell, face, (typeof bottom === 'function' ? bottom(x, z) : bottom) - y);
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
function strand(from, to, rx = 24, rz = 15, wave = 12, phase = 0, tension = 0.5, bends = 1) {
  const pts = [];
  const n = 9;
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const w = wave * Math.sin(u * Math.PI * 2 * bends + phase) * Math.sin(u * Math.PI * 0.9 + 0.1);
    pts.push([ax + (bx - ax) * u + w, ay + (by - ay) * u, az + (bz - az) * u + w * 0.35]);
  }
  // a lock keeps its width most of the way and rounds off at the tip
  return sweep(pts, (u) => rx * (1 - 0.35 * u * u), (u) => rz * (1 - 0.3 * u * u), { radial: 12, tension });
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

/**
 * Where the finished hair's surface is: a ray from outside, level, towards the skull's axis at
 * angle a (0 = front) and height y, and the first point of the hair it meets (null where
 * there is none, as in front of her face).
 */
function surfaceOf(geo) {
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }));
  const rc = new T.Raycaster();
  return (a, y) => {
    const dir = new T.Vector3(-Math.sin(a), 0, -Math.cos(a));
    rc.set(new T.Vector3(CX + 420 * Math.sin(a), -y, 420 * Math.cos(a)), dir);
    rc.far = 420;
    const hit = rc.intersectObject(m, false)[0];
    return hit ? [hit.point.x, -hit.point.y, hit.point.z] : null;
  };
}
/** A lock lying on the hair's surface from (a0, y0) to (a1, y1), `lift` out of it. */
function capLock(surface, a0, y0, a1, y1, lift, rx, rz) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const a = a0 + (a1 - a0) * u;
    const p = surface(a, y0 + (y1 - y0) * u);
    if (!p) return null;
    pts.push([p[0] + lift * Math.sin(a), p[1], p[2] + lift * Math.cos(a)]);
  }
  return sweep(pts, (u) => rx * (1 - 0.4 * u), (u) => rz * (1 - 0.3 * u), { radial: 8 });
}
/**
 * Grooves combed into the hair: thin darker strands lying on its surface from the crown down
 * (or up into a bun), so the mass reads as sculpted locks rather than a smooth ball.
 */
function grooves(root, id, surface, { n = 22, top = 300, bottom = 560, up = false } = {}) {
  const dark = material('HairGroove', COLOUR[id].groove, { roughness: 0.5, gloss: 0.6 });
  const lines = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.1;
    const twist = 0.22 * Math.sin(k * 1.7);
    const y0 = up ? bottom : top;
    const y1 = up ? top : bottom;
    const g = capLock(surface, a, y0 + (k % 3) * 14, a + twist, y1 - (k % 2) * 30, 1.5, 3.4, 2.6);
    if (g) lines.push(g);
  }
  if (lines.length) mesh(merge(lines), dark, 'grooves', root);
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
    // the mass of hair gathered at the back of her head
    ellipsoidField(CX, 440, -130, 150, 170, 85),
  ]);
  mesh(geo, m, 'cap', root);
  const surface = surfaceOf(geo);
  // twisted rolls over that mass, from the crown down and round to the braid
  const rolls = [];
  for (const [a0, a1, y0, y1] of [[Math.PI - 0.3, Math.PI + 0.55, 320, 500], [Math.PI + 0.4, Math.PI - 0.5, 380, 560], [Math.PI - 0.1, Math.PI + 0.9, 440, 540], [Math.PI + 0.9, Math.PI - 0.9, 300, 420]]) {
    const g = capLock(surface, a0, y0, a1, y1, -6, 30, 18);
    if (g) rolls.push(g);
  }
  mesh(merge(rolls), m, 'rolls', root);
  // combed lines over the crown and down the back
  grooves(root, 'braids', surface, { n: 24, top: 296, bottom: 560 });
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

const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Inside her face's open window: in front, below the hairline, within the oval of her face. */
function faceWindow(x, y, z, hairline = 395) {
  const ox = (x - CX) / 150;
  const oy = (y - 545) / 210;
  return Math.min((1 - Math.sqrt(ox * ox + oy * oy)) * 150, z + 5, y - hairline);
}

/**
 * Long brown hair, sculpted as one soft mass the way a doll's hair is: full over the crown,
 * parted a little to one side with a swept fringe; it falls past her cheeks in two curtains
 * over her shoulders and down the front of her dress, and in a round mass down her back. Its
 * whole surface is combed into big S-shaped waves running down to wavy ends. Nothing crosses
 * her face.
 */
function long(root) {
  const crown = ellipsoidField(CX, 335, -18, 180, 102, 174);
  const back = ellipsoidField(CX, 590, -100, 214, 300, 112);
  const curtain = [[CX - 152, 400, 8], [CX - 180, 520, 30], [CX - 198, 640, 60], [CX - 206, 760, 76], [CX - 200, 860, 72]];
  const curtainL = tubeField(curtain, (t) => 52 - 10 * t);
  const curtainR = tubeField(curtain.map(([x, y, z]) => [2 * CX - x, y, z]), (t) => 52 - 10 * t);
  // the fringe: from the parting over the forehead, sweeping down to her left temple; a
  // shorter sweep to her right
  const sweepTo = (a0, a1, y0, y1, lift) => Array.from({ length: 8 }, (_, i) => onSkull(a0 + ((a1 - a0) * i) / 7, y0 + ((y1 - y0) * i) / 7, lift));
  const fringeL = tubeField(sweepTo(0.2, -1.08, 292, 432, 18), (t) => 26 - 6 * t);
  const fringeR = tubeField(sweepTo(0.2, 1.02, 292, 414, 16), (t) => 20 - 6 * t);
  const geo = blob((x, y, z) => {
    const e = skullE(x, y, z);
    let f = (1 + 28 / 165 - e) * 165;
    f = smax(f, crown(x, y, z), 30);
    f = smax(f, back(x, y, z), 40);
    f = smax(f, curtainL(x, y, z), 30);
    f = smax(f, curtainR(x, y, z), 30);
    f = smax(f, fringeL(x, y, z), 12);
    f = smax(f, fringeR(x, y, z), 12);
    // never inside her head, never over her face
    f = Math.min(f, (e - 0.985) * 165, -faceWindow(x, y, z));
    // wavy ends
    const th = Math.atan2(x - CX, z + 40);
    f = Math.min(f, 876 + 30 * Math.cos(7 * th) - y);
    // big S-waves combed down the whole mass (the very top stays smooth)
    f += 5.5 * Math.cos(15 * th + 1.3 * Math.sin(y / 34 + 1.5 * th)) * smooth01(300, 380, y);
    return f;
  }, [186, 190, -270, 838, 935, 225], 150);
  mesh(lighter(geo, 90000), hairMat('long'), 'hair', root);
  tiara(root, 260, 132, COLOUR.long.gem, 0.95);
  earrings(root, COLOUR.long.gem);
}

/**
 * A ringlet: a corkscrew curl, a tube wound round an axis that hangs from its root down along
 * `axis` (sheet points), the coil `R` wide, thinning a little to its end.
 */
function ringlet(axis, { R = 11, pitch = 26, r = 8.5 } = {}) {
  const curve = new T.CatmullRomCurve3(axis.map(([x, y, z]) => new T.Vector3(x, y, z)), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(12, Math.round((len / pitch) * 9));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    // the coil turns about the axis: one way round it is outwards from her head
    const out = new T.Vector3(p.x - CX, 0, p.z + 20).normalize();
    const N = out.sub(tan.clone().multiplyScalar(out.dot(tan))).normalize();
    const B = new T.Vector3().crossVectors(tan, N);
    const a = (t * len * Math.PI * 2) / pitch;
    const k = 1 - 0.25 * t;
    pts.push([p.x + R * k * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + R * k * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + R * k * (Math.cos(a) * N.z + Math.sin(a) * B.z)]);
  }
  return sweep(pts, (t) => r * (1 - 0.3 * t), (t) => r * (1 - 0.3 * t), { radial: 6, seg: Math.round(n * 1.1), tension: 0.5 });
}

/**
 * Curly black hair, as in the mermaid doll's picture: a big head of corkscrew ringlets falling
 * in layers from her crown to her chest, framing her face, a few catching blue light, over a
 * soft dark mass that fills between them.
 */
function curly(root) {
  const under = ellipsoidField(CX, 492, -30, 196, 226, 168);
  const geo = blob((x, y, z) => {
    const e = skullE(x, y, z);
    let f = smax((1 + 26 / 165 - e) * 165, under(x, y, z), 30);
    f = Math.min(f, (e - 0.985) * 165, -faceWindow(x, y, z, 380), 740 - y);
    return f;
  }, [250, 220, -260, 774, 760, 200], 100);
  mesh(lighter(geo, 30000), material('HairUnder', '#120d0f', { roughness: 0.6 }), 'hair', root);

  // rows of ringlets from the crown down: the higher a row starts, the further out it lies,
  // so the crown's curls fall over the others as hair does
  const rows = [
    { y0: 252, lift: 78, n: 9 },
    { y0: 296, lift: 70, n: 14 },
    { y0: 345, lift: 60, n: 18 },
    { y0: 400, lift: 47, n: 22 },
    { y0: 455, lift: 35, n: 22 },
    { y0: 510, lift: 25, n: 20 },
  ];
  const base = (y) => (y < 470 ? Math.max(HEAD.r(y), 40) : 165 + (y - 470) * 0.14);
  const curls = [];
  const lights = [];
  let k = 0;
  rows.forEach((row, ri) => {
    for (let j = 0; j < row.n; j++) {
      const th = -Math.PI + ((j + (ri % 2) * 0.5) / row.n) * TAU;
      const front = Math.abs(th) < 1.0;
      // in front of her face only short curls along the top of her forehead
      if (front && (ri > 1 || Math.abs(th) > 0.9)) continue;
      const hash = Math.sin(j * 12.9898 + ri * 78.233) * 0.5 + 0.5;
      const y1 = front ? (ri === 0 ? 330 : 372) : 690 + 120 * Math.min(1, (Math.abs(th) - 1) / 1.6) - ri * 8 + 30 * (hash - 0.5);
      const axis = [];
      for (let y = row.y0; y <= y1 + 0.1; y += 14) {
        const rho = base(y) + row.lift + 5 * Math.sin(y / 40 + j);
        const a = th + 0.05 * Math.sin(y / 60 + j);
        axis.push([CX + rho * Math.sin(a), y, rho * Math.cos(a) * 0.96 - 18]);
      }
      if (axis.length < 3) continue;
      (k++ % 5 === 2 ? lights : curls).push(ringlet(axis, { R: front ? 9 : 11, r: front ? 7.5 : 8.5 }));
    }
  });
  // short curls over the top of her head, each lying along the curve of her crown from near the
  // top outwards, so no smooth patch shows from above or behind
  for (let j = 0; j < 12; j++) {
    const th = (j / 12) * TAU + 0.26;
    const axis = [];
    for (let s = 0; s <= 6; s++) {
      const phi = 0.12 + (0.62 * s) / 6;
      const L = 50;
      axis.push([CX + (SK.rx + L) * Math.sin(phi) * Math.sin(th), SK.cy - (SK.ry + L) * Math.cos(phi), (SK.rz + L) * Math.sin(phi) * Math.cos(th)]);
    }
    curls.push(ringlet(axis, { R: 10, r: 8 }));
  }
  mesh(lighter(merge(curls), 90000), hairMat('curly'), 'curls', root);
  mesh(lighter(merge(lights), 22000), material('CurlLight', '#253a66', { roughness: 0.35, gloss: 0.7 }), 'lights', root);
  tiara(root, 252, 124, COLOUR.curly.gem, 0.95);
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
  // hair combed up from the hairline into the bun (over the cap and the bun as one surface)
  grooves(root, 'bun', surfaceOf(merge([geo, ...coil.map((g) => g.clone())])), { n: 26, top: 120, bottom: 560, up: true });
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

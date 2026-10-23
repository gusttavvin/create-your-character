/**
 * Her dresses, modelled from Clara's doll pictures: every dress shares one body (her bare
 * shoulders and chest, a fitted bodice, puff sleeves with gold cuffs, arms curving down to
 * hands laid on the skirt, a gem at the neckline) and has its own skirt below the waist:
 *
 *   gown     three light-green tiers with gold hems under a dark-green overskirt that drapes
 *            up at the front and sides, with gold vines (as gold leaves on the overskirt)
 *   aline    a pink underskirt under a lilac overskirt open at the front, gold edges
 *   mermaid  a red peplum with a gold hem over a scaled tail that narrows and ends in a wide
 *            pearly fin
 *   star     a short blue skirt with a draped overskirt and gold buttons, legs and blue shoes
 *
 * Widths and depths of the skirts were measured on the flat dresses and their side views.
 */
import * as T from 'three';
import { curve, ellipsoid, GOLD, lathe, material, merge, mesh, pair, ring, SKIN, spun, sweep, turned, W } from './lib.mjs';

const CX = W / 2;
const TAU = Math.PI * 2;
const WAIST = 822;

const CLOTH = {
  gown: { top: '#2a8a55', under: '#cfe8c0', over: '#1f7a4a', gem: '#1d9a5a' },
  aline: { top: '#f5a3d2', under: '#f8c4e2', over: '#c48ae6', gem: '#ff4fa0' },
  mermaid: { top: '#f29ab8', under: '#d9385c', over: '#c21e3a', gem: '#d81e3a', fin: '#f7cdd4' },
  star: { top: '#86b6f2', under: '#d6e6fb', over: '#6ea3ee', gem: '#2f7be0' },
};
const cloth = (name, colour, extra = {}) => material(name, colour, { roughness: 0.5, ...extra });

/* ----------------------------------------------------------------- the body */
/** Half-width of the torso (without sleeves) at each y: shoulders, chest, waist, hips. */
const TORSO = curve([[640, 42], [665, 78], [690, 100], [740, 104], [790, 84], [WAIST, 76], [850, 86], [880, 100]]);
const TORSO_DEPTH = 0.72;

/** The front of the torso at (x, y), for laying things on it. */
export function torsoFront(x, y) {
  const r = TORSO(y);
  const dx = x - CX;
  if (Math.abs(dx) >= r) return -Infinity;
  return Math.sqrt(r * r - dx * dx) * TORSO_DEPTH;
}

function body(id, root) {
  const c = CLOTH[id];
  // bare shoulders and chest down to the neckline, in skin
  const skin = [];
  for (let y = 636; y <= 712; y += 6) skin.push([y, TORSO(y)]);
  mesh(spun(skin, { depth: TORSO_DEPTH, rings: 14, sides: 40 }), SKIN(), 'chest', root);
  // the bodice, from a sweetheart neckline to the waist: its top edge dips in the middle
  const neckline = (a) => 700 + 14 * Math.cos(a) * Math.max(0, Math.cos(a)) - 6 * Math.abs(Math.sin(a));
  mesh(
    lathe({ r: (y) => TORSO(y) + 2, yOf: (v, a) => neckline(a) + (WAIST + 8 - neckline(a)) * v, depth: TORSO_DEPTH, rings: 18, sides: 48, caps: 'both' }),
    cloth('Bodice', c.top), 'bodice', root,
  );
  // gold piping along the neckline and the waist
  const pipe = (yOf, lift = 0) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const y = yOf(a);
      const r = TORSO(y) + 3 + lift;
      pts.push([CX + r * Math.sin(a), y, r * Math.cos(a) * TORSO_DEPTH]);
    }
    return sweep(pts, 4, 4, { radial: 8, round: false });
  };
  mesh(merge([pipe(neckline), pipe(() => WAIST + 6)]), GOLD(), 'piping', root);
  // the gem at the neckline, in gold
  mesh(ellipsoid(CX, 724, torsoFront(CX, 724) + 4, 11, 14, 7, 16), material('Gem', c.gem, { roughness: 0.15 }), 'gem', root);
  mesh(ring(CX, 724, torsoFront(CX, 724) + 3, 13, 3, [0, 0, 0], TAU, 24), GOLD(), 'gemrim', root);
  // puff sleeves on each shoulder (their gold cuffs are put on round the arm, in arms())
  const sleeve = ellipsoid(CX - 150, 716, 0, 50, 44, 42, 24);
  mesh(pair(sleeve), cloth('Sleeve', c.top), 'sleeves', root);
}

/* small vector sums in sheet pixels (x right, y down, z forward) */
const vadd = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};

/**
 * The front of a skirt turned on a lathe — radius R(y), squashed in depth by `depth` — at angle
 * a round it (0 = the front) and height y: the point, and the way out of the cloth there (it
 * leans up where the skirt flares).
 */
function onSkirt(R, depth, a, y) {
  const r = R(y);
  const p = [CX + r * Math.sin(a), y, r * Math.cos(a) * depth];
  const flare = (R(y + 2) - R(y - 2)) / 4;
  const n = vnorm([Math.sin(a) / r, -flare / r, Math.cos(a) / (depth * r)]);
  return { p, n };
}

/** How thick each part of the arm is, from the shoulder (0) into the palm (1): a doll's soft arm. */
const ARM_RADIUS = curve([[0, 21], [0.16, 20.5], [0.42, 17], [0.52, 16.5], [0.76, 14.2], [0.9, 11], [1, 10.8]]);

/**
 * Her arms: from inside the puff sleeve, a soft upper arm down to the elbow by her waist, then
 * a forearm going straight on into the hand resting on the skirt — the hand at angle `a` round
 * the skirt and height `y`, on its surface (R, depth), with four fingers together and a thumb in
 * front. Forearm, wrist and hand are in one straight line: the hand carries on the way the
 * forearm points, with no turn at the wrist (turned to lie down the skirt, it bent there). The
 * tube runs on inside the palm, so the wrist has no seam and no neck. Where the straight
 * forearm would pass through the skirt, it is the elbow that moves out, not the wrist that bends.
 */
function arms(root, R, depth, a, y) {
  const { p: on, n } = onSkirt(R, depth, a, y);
  const palm = vadd(on, n, 8);
  const shoulder = [CX - 150, 735, 4];
  /** How far outside the skirt's oval a point is, beyond `rad`. */
  const clear = (p, rad) => {
    // measured square to the cloth: where the skirt flares out, the gap straight out sideways
    // is wider than the gap to the cloth itself
    const slope = (R(p[1] + 2) - R(p[1] - 2)) / 4;
    return (Math.hypot(p[0] - CX, p[2] / depth) - R(p[1])) / Math.sqrt(1 + slope * slope) - rad - 2;
  };
  // the forearm comes down along the cloth, nearly lying on it rather than pointing into it
  // (pointed at the hand from her waist, the hand carried on into the skirt and sank in it):
  // its direction is down the skirt at the hand, leaning into the cloth only as much as keeps
  // the elbow and forearm outside it (leaning in puts the elbow further out)
  const downCloth = vnorm(vadd([0, 1, 0], n, -n[1]));
  let elbow;
  let dir;
  let wrist;
  let lean = 0;
  for (lean = 0; lean <= 1.0; lean += 0.03) {
    dir = vnorm(vadd(downCloth.map((v) => v * Math.cos(lean)), n, -Math.sin(lean)));
    elbow = vadd(palm, dir, -112);
    wrist = vadd(palm, dir, -19);
    let ok = true;
    for (let s = 0; s <= 1.0001; s += 0.05) if (clear(vadd(elbow, vadd(wrist, elbow, -1), s), 16 - 7 * s) < 0) ok = false;
    if (ok) break;
  }
  // the hand's own directions: along the forearm, out of the cloth (square to the forearm), and
  // across, its thumb side forward
  const along = dir;
  const out = vnorm(vadd(n, along, -vdot(n, along)));
  let across = vnorm(vcross(out, along));
  if (across[2] < 0) across = across.map((v) => -v);
  const down = along;
  // a centripetal curve through the joints, sampled evenly, so the tube never loops or kinks;
  // from the elbow on, every point lies on the forearm's straight line
  const path = new T.CatmullRomCurve3(
    [shoulder, [CX - 166, 784, 0], elbow, vadd(elbow, vadd(wrist, elbow, -1), 0.5), wrist, vadd(palm, along, -6)].map(([x, yy, z]) => new T.Vector3(x, yy, z)),
    false, 'centripetal',
  );
  const pts = path.getSpacedPoints(36).map((v) => [v.x, v.y, v.z]);
  // the upper arm never goes into the bodice or the skirt: each point is kept its own thickness
  // and a little more outside them, measured round the skirt's oval
  pts.forEach((p, i) => {
    const t = i / (pts.length - 1);
    if (t > 0.4) return;
    const dx = p[0] - CX;
    const dz = p[2] / depth;
    const rho = Math.hypot(dx, dz);
    const need = R(p[1]) + ARM_RADIUS(t) + 3;
    if (rho < need) {
      p[0] = CX + (dx * need) / rho;
      p[2] = ((dz * need) / rho) * depth;
    }
  });
  const parts = [sweep(pts, ARM_RADIUS, ARM_RADIUS, { radial: 16, tension: 0.5 })];
  // the palm: a soft oval along the forearm's line, longer than it is wide
  const world = (v) => new T.Vector3(v[0], -v[1], v[2]);
  const basis = new T.Matrix4().makeBasis(world(across), world(down), world(out));
  if (basis.determinant() < 0) basis.makeBasis(world(across.map((v) => -v)), world(down), world(out));
  const oval = new T.SphereGeometry(1, 20, 14);
  oval.scale(16.5, 20, 9.5);
  oval.applyMatrix4(basis.setPosition(world(palm)));
  parts.push(oval);
  // four fingers side by side, the middle ones longest, carrying on the forearm's line and
  // curling gently onto the cloth
  for (let i = 0; i < 4; i++) {
    const side = (i - 1.5) * 7.8;
    const len = 23 - Math.abs(i - 1.5) * 3.2;
    // from the knuckles the fingers lie down on the cloth (the hand itself does not turn)
    const knuckle = vadd(palm, down, 8);
    const at = (d, o) => (d <= 8 ? vadd(vadd(vadd(palm, down, d), across, side), out, o) : vadd(vadd(vadd(knuckle, downCloth, d - 8), across, side * (1 + d / 200)), n, o + Math.sin(lean) * 8));
    parts.push(sweep([at(8, 0.5), at(8 + len * 0.55, -1), at(8 + len, -3.2)], (t) => 4.7 - 0.9 * t, (t) => 4.2 - 0.8 * t, { radial: 8 }));
  }
  // the thumb, from the base of the palm, lying forward along its edge
  const thumbAt = (d, side, o) => vadd(vadd(vadd(palm, down, d), across, side), out, o);
  parts.push(sweep([thumbAt(-8, 11, 1), thumbAt(2, 17.5, 2), thumbAt(12, 19.5, 0)], (t) => 5.4 - 1 * t, (t) => 4.8 - 0.8 * t, { radial: 8 }));
  mesh(pair(merge(parts)), SKIN(), 'arms', root);
  // the sleeve's gold cuff, snug round the arm where it comes out of the puff
  const k = pts.findIndex((p) => p[1] > 753);
  const here = new T.Vector3(...world(pts[k]).toArray());
  const axis = world(pts[k + 1]).sub(world(pts[k - 1])).normalize();
  const cuff = new T.TorusGeometry(ARM_RADIUS(k / (pts.length - 1)) + 2.5, 3.6, 10, 40);
  cuff.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), axis));
  cuff.translate(here.x, here.y, here.z);
  mesh(pair(cuff), GOLD(), 'cuffs', root);
}

/**
 * Her feet in little shoes, the pair standing on the floor at height y with the toes pointing
 * forward: a rounded slipper (a sole, a toe cap and a heel), a bow on the toe and, where the
 * leg shows (`bare`), the instep in skin; x is the left foot's middle, z its middle front to back.
 * Under a long skirt only the toes peep out at the front of the hem.
 */
function feet(root, x, y, z, colour, trim, { bare = false } = {}) {
  const shoe = cloth('Shoe', colour, { roughness: 0.25, gloss: 0.6 });
  const parts = [
    // the slipper: long, low and rounded, a little wider at the toes
    ellipsoid(x, y - 12, z + 8, 25, 13, 40, 24),
    ellipsoid(x, y - 10, z + 30, 23, 11, 22, 18),
    // the sole, a touch darker
  ];
  mesh(pair(merge(parts)), shoe, 'shoes', root);
  mesh(pair(ellipsoid(x, y - 2, z + 10, 26, 3.5, 43, 20)), cloth('Sole', '#6a4a3a', { roughness: 0.6 }), 'soles', root);
  // a bow on each toe: two loops and a knot
  const bow = merge([
    turned(x - 9, y - 22, z + 42, 9, 6, 4, 0, 0.35, 12),
    turned(x + 9, y - 22, z + 42, 9, 6, 4, 0, -0.35, 12),
    ellipsoid(x, y - 22, z + 45, 4.5, 4.5, 4, 10),
  ]);
  mesh(pair(bow), cloth('Bow', trim, { roughness: 0.3, gloss: 0.6 }), 'bows', root);
  // the top of the foot showing above a ballet flat
  if (bare) mesh(pair(ellipsoid(x, y - 22, z + 6, 17, 7, 24, 16)), SKIN(), 'insteps', root);
}

/* ---------------------------------------------------------------- the skirts */
/** A gold hem following a lathe's bottom edge (or any ring of it). */
function hemTrim(rOf, yOf, depth, radius = 5, cx = CX, a0 = 0, a1 = TAU) {
  const pts = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const y = yOf(a);
    const r = rOf(y, a) + 2;
    pts.push([cx + r * Math.sin(a), y, r * Math.cos(a) * depth]);
  }
  return sweep(pts, radius, radius, { radial: 8, round: a1 - a0 < TAU - 0.01 });
}

function gown(root) {
  const c = CLOTH.gown;
  const depth = 0.68;
  // the underskirt: three tiers, each flaring out over the one below
  const under = curve([[WAIST, 80], [870, 140], [960, 235], [1060, 300], [1160, 350], [1240, 390], [1250, 372], [1340, 420], [1380, 440], [1390, 422], [1480, 455], [1528, 468]]);
  const tiers = [];
  for (let y = WAIST; y <= 1530; y += 6) tiers.push([y, under(y)]);
  mesh(spun(tiers, { depth, rings: 70, sides: 64 }), cloth('Underskirt', c.under), 'underskirt', root);
  mesh(merge([hemTrim(under, () => 1246, depth, 6), hemTrim(under, () => 1386, depth, 6), hemTrim(under, () => 1527, depth, 6)]), GOLD(), 'tiertrims', root);
  // the overskirt: darker, hugging the top of the skirt and draped up in scallops, highest
  // at the front and at each side, hanging lowest between
  const scallop = (a) => 1150 - 70 * Math.max(0, Math.cos(2 * a)) - 30 * Math.max(0, Math.cos(a));
  const over = (y, a) => under(Math.min(y, 1240)) + 8 + (y > 1000 ? (y - 1000) * 0.05 : 0);
  mesh(lathe({ r: over, yOf: (v, a) => WAIST + (scallop(a) - WAIST) * v, depth, rings: 32, sides: 72, caps: 'top' }), cloth('Overskirt', c.over), 'overskirt', root);
  mesh(hemTrim(over, scallop, depth, 7), GOLD(), 'overtrim', root);
  // gold leaves on the overskirt, a sprig between each scallop
  const leaves = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8;
    for (let i = -2; i <= 2; i++) {
      const y = scallop(a) - 70 + Math.abs(i) * 8;
      const aa = a + i * 0.07;
      const r = over(y, aa) + 4;
      leaves.push(turned(CX + r * Math.sin(aa), y, r * Math.cos(aa) * depth, 7, 11, 3, aa, i * 0.5, 10));
    }
  }
  mesh(merge(leaves), GOLD('GoldLeaf'), 'leaves', root);
  arms(root, over, depth, -1.1, 915);
  // her toes peeping out at the front of the hem
  feet(root, CX - 44, 1536, under(1528) * depth - 34, '#e9c14f', c.over);
}

function aline(root) {
  const c = CLOTH.aline;
  const depth = 0.74;
  const under = curve([[WAIST, 80], [880, 130], [980, 200], [1100, 265], [1250, 310], [1350, 322], [1437, 330]]);
  const k = [];
  for (let y = WAIST; y <= 1437; y += 8) k.push([y, under(y)]);
  mesh(spun(k, { depth, rings: 60, sides: 64 }), cloth('Underskirt', c.under), 'underskirt', root);
  mesh(hemTrim(under, () => 1436, depth, 6), GOLD(), 'hemtrim', root);
  // the lilac overskirt: open at the front in a V, longer at the back
  const gap = 0.55;
  const hem = (a) => 1180 + 190 * Math.sin(Math.min(Math.PI, ((a - gap) / (TAU - 2 * gap)) * Math.PI));
  const over = (y) => under(y) + 7 + Math.max(0, (y - 950) * 0.04);
  mesh(lathe({ r: over, yOf: (v, a) => WAIST + (hem(a) - WAIST) * v, depth, rings: 36, sides: 56, a0: gap, a1: TAU - gap, caps: '' }), cloth('Overskirt', c.over, { side: T.DoubleSide }), 'overskirt', root);
  // its gold edge: down one side of the opening, along the hem, up the other
  const edge = [];
  for (let i = 0; i <= 10; i++) { const y = WAIST + ((hem(gap) - WAIST) * i) / 10; edge.push([CX + (over(y) + 2) * Math.sin(gap), y, (over(y) + 2) * Math.cos(gap) * depth]); }
  for (let i = 1; i <= 56; i++) { const a = gap + ((TAU - 2 * gap) * i) / 56; const y = hem(a); edge.push([CX + (over(y) + 2) * Math.sin(a), y, (over(y) + 2) * Math.cos(a) * depth]); }
  for (let i = 1; i <= 10; i++) { const y = hem(gap) - ((hem(gap) - WAIST) * i) / 10; edge.push([CX + (over(y) + 2) * Math.sin(TAU - gap), y, (over(y) + 2) * Math.cos(gap) * depth]); }
  mesh(sweep(edge, 6, 6, { radial: 8, round: true }), GOLD(), 'overtrim', root);
  arms(root, over, depth, -1.1, 905);
  // her toes peeping out at the front of the hem
  feet(root, CX - 42, 1446, under(1437) * depth - 34, '#f08cc8', '#e2b545');
}

function mermaid(root) {
  const c = CLOTH.mermaid;
  const depth = 0.72;
  // the tail: round at the hips, narrowing to the ankle, swelling into the fin
  const tail = curve([[WAIST, 80], [900, 150], [960, 170], [1040, 150], [1130, 100], [1216, 56], [1270, 60], [1310, 90]]);
  const t = [];
  for (let y = WAIST; y <= 1310; y += 8) t.push([y, tail(y)]);
  mesh(spun(t, { depth, rings: 60, sides: 48 }), cloth('Tail', c.under, { roughness: 0.35, metalness: 0.15 }), 'tail', root);
  // scales: rows of little domes over the tail, staggered
  const scales = [];
  for (let y = 1010; y <= 1290; y += 26) {
    const r = tail(y);
    const n = Math.max(6, Math.round(r / 11));
    for (let i = 0; i < n; i++) {
      const a = ((i + (y / 26) % 2 / 2) / n) * TAU;
      scales.push(turned(CX + r * Math.sin(a), y, r * Math.cos(a) * depth, 10, 12, 3, a, 0, 8));
    }
  }
  mesh(merge(scales), cloth('Scales', '#e04a6a', { roughness: 0.3, metalness: 0.2 }), 'scales', root);
  // the peplum: a flared red frill from the waist, scalloped up at the front and back
  // (a short bell, lowest at the sides, as in her picture; as deep as the side view shows)
  const frill = (a) => 1010 + 50 * Math.abs(Math.sin(a));
  const pepR = curve([[WAIST, 80], [880, 135], [940, 200], [1000, 258], [1060, 290]]);
  const pep = (y) => pepR(y);
  mesh(lathe({ r: pep, yOf: (v, a) => WAIST + (frill(a) - WAIST) * v, depth: 0.64, rings: 24, sides: 64, caps: 'top' }), cloth('Peplum', c.over, { side: T.DoubleSide }), 'peplum', root);
  mesh(hemTrim(pep, frill, 0.64, 7), GOLD(), 'peplumtrim', root);
  // a gold band and a gem where the fin starts
  mesh(ring(CX, 1312, 0, tail(1312) + 2, 6, [Math.PI / 2, 0, 0]), GOLD(), 'finband', root);
  mesh(ellipsoid(CX, 1312, tail(1312) * depth + 4, 10, 12, 6, 14), material('Gem', c.gem, { roughness: 0.15 }), 'fingem', root);
  // the fin: two broad lobes spreading out and down from the ankle, thin, edged in gold
  const lobe = (dir) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push([CX + dir * (20 + 230 * Math.sin(u * Math.PI * 0.55)), 1320 + 190 * u, 0]);
    }
    return sweep(pts, (u) => 20 + 95 * Math.sin(u * Math.PI * 0.75), (u) => 14 + 30 * Math.sin(u * Math.PI * 0.6), { radial: 16, seg: 40 });
  };
  mesh(pair(lobe(-1)), cloth('Fin', c.fin, { roughness: 0.3 }), 'fin', root);
  arms(root, pep, 0.64, -1.0, 905);
}

function star(root) {
  const c = CLOTH.star;
  const depth = 0.76;
  // a short full skirt: the light underskirt to the knee, a wavy hem
  const under = curve([[WAIST, 80], [880, 140], [960, 230], [1060, 300], [1160, 345], [1250, 355], [1300, 340], [1340, 320]]);
  const k = [];
  for (let y = WAIST; y <= 1340; y += 8) k.push([y, under(y)]);
  const wave = (y, a) => under(y) + (y > 1250 ? 6 * Math.sin(a * 12) * ((y - 1250) / 90) : 0);
  mesh(lathe({ r: wave, yOf: (v) => WAIST + (1340 - WAIST) * v, depth, rings: 50, sides: 96, caps: 'both' }), cloth('Underskirt', c.under), 'underskirt', root);
  mesh(hemTrim(wave, () => 1338, depth, 6), GOLD(), 'hemtrim', root);
  // the blue overskirt, draped up at the front and back with a gold button at each peak
  const scallop = (a) => 1230 - 60 * Math.max(0, Math.cos(2 * a + Math.PI));
  const over = (y) => under(Math.min(y, 1250)) + 8;
  mesh(lathe({ r: over, yOf: (v, a) => WAIST + (scallop(a) - WAIST) * v, depth, rings: 28, sides: 64, caps: 'top' }), cloth('Overskirt', c.over), 'overskirt', root);
  mesh(hemTrim(over, scallop, depth, 6), GOLD(), 'overtrim', root);
  const buttons = [];
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const y = scallop(a) + 4;
    const r = over(y) + 6;
    buttons.push(ellipsoid(CX + r * Math.sin(a), y, r * Math.cos(a) * depth, 11, 11, 11, 12));
  }
  mesh(merge(buttons), GOLD(), 'buttons', root);
  // legs, rounded at the knee and slimmer at the ankle, in blue ballet flats
  const leg = sweep([[CX - 50, 1250, 0], [CX - 53, 1350, 3], [CX - 55, 1440, 2], [CX - 56, 1488, 4]], (t) => 25 - 9 * t, (t) => 23 - 8 * t, { radial: 16 });
  mesh(pair(leg), SKIN(), 'legs', root);
  feet(root, CX - 57, 1500, 6, '#2f6fd8', '#e2b545', { bare: true });
  arms(root, over, depth, -1.15, 950);
}

const SKIRTS = { gown, aline, mermaid, star };

export function dress(id) {
  const root = new T.Group();
  body(id, root);
  SKIRTS[id](root);
  return root;
}

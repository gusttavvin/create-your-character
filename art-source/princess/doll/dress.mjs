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
  // puff sleeves, with a gold cuff, on each shoulder
  const sleeve = ellipsoid(CX - 150, 716, 0, 50, 44, 42, 24);
  const cuff = ring(CX - 150, 752, 0, 36, 5, [Math.PI / 2 - 0.25, 0, -0.35]);
  mesh(pair(sleeve), cloth('Sleeve', c.top), 'sleeves', root);
  mesh(pair(cuff), GOLD(), 'cuffs', root);
}

/**
 * An arm from the shoulder, bent at the elbow, to a hand laid on the skirt at (hx, hy), the
 * hand's front at hz: a plump upper arm, a forearm narrowing to the wrist, and a hand with a
 * palm, four fingers curled down over the skirt and a thumb, turned to lie along the skirt.
 */
function arms(root, hx, hy, hz, swing = 0) {
  const sx = CX - 150;
  const elbow = [sx - 26 - swing, 830, 26];
  const wrist = [hx + 8, hy - 18, hz - 6];
  const arm = sweep([[sx, 738, 8], [sx - 12, 785, 18], elbow, [hx + 12, hy - 55, hz - 16], wrist], (t) => 23 - 8 * t, (t) => 21 - 8 * t, { radial: 14, tension: 0.35 });
  // the hand, built flat (palm towards +z, fingers down) and turned to the skirt's slope there
  const angle = Math.atan2(hx - CX, hz);
  const palm = ellipsoid(0, 0, 0, 19, 24, 9, 18);
  const parts = [palm];
  for (let i = 0; i < 4; i++) {
    const fx = -14 + i * 9.5;
    const len = 26 - Math.abs(i - 1.5) * 3;
    parts.push(sweep([[fx, 16, 2], [fx, 16 + len * 0.6, 6], [fx + (i - 1.5) * 1.5, 16 + len, 2]], 5 - Math.abs(i - 1.5) * 0.5, 4.5, { radial: 8 }));
  }
  parts.push(sweep([[14, -8, 2], [25, 4, 7], [28, 16, 6]], 5.5, 5, { radial: 8 }));
  const hand = merge(parts);
  hand.rotateY(angle);
  hand.translate(hx, -(hy + 6), hz + 4);
  mesh(pair(merge([arm, hand])), SKIN(), 'arms', root);
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
  arms(root, CX - 232, 905, over(905, -0.75) * depth * Math.cos(0.75) + 10, 10);
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
  arms(root, CX - 205, 900, over(900) * depth * Math.cos(0.72) + 8, 6);
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
  arms(root, CX - 200, 880, pep(880) * 0.64 * Math.cos(0.7) + 6, 8);
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
  // legs and blue shoes under the skirt
  const leg = sweep([[CX - 52, 1250, 0], [CX - 54, 1360, 0], [CX - 56, 1470, 2]], 24, 22, { radial: 14 });
  mesh(pair(leg), SKIN(), 'legs', root);
  const shoe = merge([ellipsoid(CX - 58, 1490, 10, 30, 14, 42, 16), ellipsoid(CX - 58, 1482, 36, 14, 8, 10, 10)]);
  mesh(pair(shoe), cloth('Shoe', '#2f6fd8', { roughness: 0.3 }), 'shoes', root);
  arms(root, CX - 225, 960, over(960) * depth * Math.cos(0.78) + 8, 8);
}

const SKIRTS = { gown, aline, mermaid, star };

export function dress(id) {
  const root = new T.Group();
  body(id, root);
  SKIRTS[id](root);
  return root;
}

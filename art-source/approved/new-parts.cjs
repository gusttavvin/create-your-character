/**
 * Draws the mouths and the legs Clara asked for, and writes them beside the other extras.
 *
 *   node art-source/approved/new-parts.cjs
 *
 * She said the mouths look like one another and so do the legs: "quero que a boca tongue se
 * mantenha, mude as outras, pois estão muito parecidas, as legs vai manter bird e snake, as
 * outras mude também".
 *
 * She is right, and measurably so: laid on top of one another, the mouth cavities of all six
 * approved drawings match between 82% and 96%. Every one of them is the same wide bowl with
 * white slabs hanging from the upper lip and a pink tongue in the floor; they differ only in
 * how many slabs. There is nothing unused left in the drawings to cut a different mouth from
 * either — every shape in all six is already spoken for. So these are computed, the way the
 * claw hand is: built out of curves, in her line weight and her palette.
 *
 * What makes them different is structure, not detail:
 *
 *   smile   no cavity at all — one drawn line, turned up
 *   fangs   a closed mouth with two teeth hanging OUTSIDE it
 *   beak    not a mouth shape at all: a hard yellow beak
 *   long    legs with a leg — a shaft and a foot, where every other pair is two lumps
 *   paws    round and furry, green since Clara asked for them green
 *   tentacle two octopus tentacles to a side, curling at the tip, with suckers underneath —
 *            "isso não parece um tentacle", she said of the pink arms cut from Bubblegoo
 */
const fs = require('fs');
const path = require('path');

const r2 = (n) => Math.round(n * 100) / 100;
const P = (p) => `${r2(p[0])} ${r2(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => (len(a) ? mul(a, 1 / len(a)) : [0, 0]);

const INK = '#0B1B3B';
const WHITE = '#FFFFFF';
const MOUTH_DARK = '#7C2C4F';
const MOUTH_PINK = '#FF87A9';
const BEAK = '#FFC145';
const BEAK_DARK = '#E9A417';
const PURPLE = '#9B5DE5';
const PURPLE_DARK = '#7A43C9';
const ORANGE = '#FF8A47';
const ORANGE_LIGHT = '#FFA45C';
const TENTACLE = '#FF9BC9';
const SUCKER = '#FFD6EA';
/** The paws went green at Clara's asking, in the 2D and the 3D alike. */
const GREEN = '#6FD14A';
const GREEN_LIGHT = '#A8EC86';

/** A rounded blob as a path, so everything downstream deals with one kind of outline. */
function blob(cx, cy, rx, ry) {
  return `M ${P([cx - rx, cy])} A ${r2(rx)} ${r2(ry)} 0 1 0 ${P([cx + rx, cy])} A ${r2(rx)} ${r2(ry)} 0 1 0 ${P([cx - rx, cy])} Z`;
}

/** A stroke of constant width from a to b, with round ends — a limb, a toe, a tooth. */
function capsule(a, b, w) {
  const u = norm(sub(b, a));
  const n = [-u[1], u[0]];
  const p = mul(n, w);
  return [
    `M ${P(sub(a, p))}`,
    `L ${P(sub(b, p))}`,
    `A ${r2(w)} ${r2(w)} 0 0 1 ${P(add(b, p))}`,
    `L ${P(add(a, p))}`,
    `A ${r2(w)} ${r2(w)} 0 0 1 ${P(sub(a, p))}`,
    'Z',
  ].join(' ');
}

/**
 * A ring of fur round an ellipse, at the rhythm Fuzzbop's own body is drawn at: a bump about
 * a third as proud as it is long, round at the crest and cornered in the valleys.
 */
function furryBlob(cx, cy, rx, ry, chord, sag) {
  const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(7, Math.round(circumference / chord));
  const at = (t) => [cx + rx * Math.cos(t * Math.PI * 2), cy + ry * Math.sin(t * Math.PI * 2)];
  const out = (t) => norm([rx ? Math.cos(t * Math.PI * 2) / rx : 0, ry ? Math.sin(t * Math.PI * 2) / ry : 0]);
  let d = `M ${P(at(0))}`;
  for (let i = 0; i < n; i++) {
    const a = at(i / n);
    const b = at((i + 1) / n);
    const m = at((i + 0.38) / n);
    const crest = add(m, mul(out((i + 0.38) / n), sag));
    const along = norm(sub(b, a));
    const ease = (len(sub(b, a)) || 1) * 0.22;
    d += ` C ${P(add(a, mul(norm(sub(crest, a)), len(sub(crest, a)) * 0.45)))} ${P(sub(crest, mul(along, ease)))} ${P(crest)}`;
    d += ` C ${P(add(crest, mul(along, ease)))} ${P(add(b, mul(norm(sub(crest, b)), len(sub(crest, b)) * 0.45)))} ${P(b)}`;
  }
  return `${d} Z`;
}

/** A closed outline through a ring of points, smoothed into curves (Catmull-Rom). */
function smoothRing(pts) {
  const n = pts.length;
  let d = `M ${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C ${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return `${d} Z`;
}

/** A point on a cubic curve. */
function bez(a, b, c, d, t) {
  const u = 1 - t;
  return add(add(mul(a, u * u * u), mul(b, 3 * u * u * t)), add(mul(c, 3 * u * t * t), mul(d, t * t * t)));
}

/**
 * One octopus tentacle: thick where it leaves the body, thin and curled at the tip, with a
 * row of suckers down the side that faces into the curl.
 *
 * The middle of it runs along a wave (a cubic curve) and then winds into a little spiral,
 * and the outline is that middle line widened — by a lot at the root, by almost nothing at
 * the tip. `curl` is +1 or -1, the way the tip winds. Returns the tentacle and its suckers.
 */
function tentacle(root, c1, c2, tip, curl, rootWidth) {
  const mid = [];
  const N = 36;
  for (let i = 0; i <= N; i++) mid.push(bez(root, c1, c2, tip, i / N));
  // the curl: a spiral that starts along the direction the wave arrives in
  const along = norm(sub(mid[N], mid[N - 2]));
  const side = mul([-along[1], along[0]], curl);
  const r0 = rootWidth * 0.55;
  const centre = add(tip, mul(side, r0));
  const start = Math.atan2(tip[1] - centre[1], tip[0] - centre[0]);
  const M = 14;
  for (let i = 1; i <= M; i++) {
    const t = i / M;
    const a = start + curl * t * Math.PI * 1.35;
    const r = r0 * (1 - 0.55 * t);
    mid.push(add(centre, [Math.cos(a) * r, Math.sin(a) * r]));
  }
  const count = mid.length;
  const width = (i) => {
    const t = i / (count - 1);
    return rootWidth * (1 - 0.86 * Math.pow(t, 0.8)) + 0.6;
  };
  const normalAt = (i) => {
    const a = mid[Math.max(0, i - 1)];
    const b = mid[Math.min(count - 1, i + 1)];
    const u = norm(sub(b, a));
    return [-u[1], u[0]];
  };
  const left = [];
  const right = [];
  for (let i = 0; i < count; i++) {
    const n = normalAt(i);
    left.push(add(mid[i], mul(n, width(i))));
    right.push(sub(mid[i], mul(n, width(i))));
  }
  const body = smoothRing([...left, ...right.reverse()]);
  // suckers on the side that faces into the curl, smaller towards the tip
  const suckers = [];
  for (let i = 5; i < count - 8; i += 6) {
    const n = mul(normalAt(i), -curl);
    const w = width(i);
    suckers.push(blob(...add(mid[i], mul(n, w * 0.42)), w * 0.36, w * 0.33));
  }
  return { body, suckers };
}

/* ------------------------------------------------------------------ the mouths */

/** A big smile: one line, turned up, and nothing else. No other mouth here is a line. */
const smile = {
  box: { x: 0, y: 0, w: 210, h: 96 },
  add: [
    { d: 'M 18 28 C 52 88, 158 88, 192 28', stroke: INK, sw: 10 },
    // the two corners, tucked up, which is what turns a curve into a smile
    { d: 'M 18 28 C 14 20, 18 12, 26 10', stroke: INK, sw: 9 },
    { d: 'M 192 28 C 196 20, 192 12, 184 10', stroke: INK, sw: 9 },
    { d: blob(105, 66, 26, 9), fill: MOUTH_PINK },
  ],
};

/** Fangs: a shut mouth with two teeth hanging outside it, where every other mouth hides them. */
const fangs = (() => {
  const line = 'M 16 30 C 58 66, 152 66, 194 30';
  const tooth = (x, w, h) => `M ${P([x - w, 44])} L ${P([x + w, 44])} L ${P([x, 44 + h])} Z`;
  return {
    box: { x: 0, y: 0, w: 210, h: 120 },
    add: [
      { d: line, stroke: INK, sw: 9 },
      { d: tooth(62, 15, 52), fill: WHITE, stroke: INK, sw: 5 },
      { d: tooth(148, 13, 44), fill: WHITE, stroke: INK, sw: 5 },
    ],
  };
})();

/** A beak: hard, yellow, and not a bowl at all. */
const beak = {
  box: { x: 0, y: 0, w: 180, h: 130 },
  add: [
    { d: 'M 90 8 C 132 30, 168 52, 168 62 C 168 72, 132 76, 90 76 C 48 76, 12 72, 12 62 C 12 52, 48 30, 90 8 Z', fill: BEAK, stroke: INK, sw: 5 },
    { d: 'M 90 122 C 128 104, 158 86, 158 78 C 158 72, 128 70, 90 70 C 52 70, 22 72, 22 78 C 22 86, 52 104, 90 122 Z', fill: BEAK_DARK, stroke: INK, sw: 5 },
    { d: 'M 40 42 C 56 32, 74 24, 88 20', stroke: '#FFE3A3', sw: 7 },
  ],
};

/* -------------------------------------------------------------------- the legs */

/** Long legs: a shaft and a foot, where every other pair in the game is two lumps. */
const long = {
  box: { x: 0, y: 0, w: 210, h: 200 },
  add: [
    { d: capsule([68, 12], [62, 138], 15), fill: PURPLE, stroke: INK, sw: 5 },
    { d: capsule([142, 12], [148, 138], 15), fill: PURPLE, stroke: INK, sw: 5 },
    { d: blob(56, 160, 40, 24), fill: PURPLE_DARK, stroke: INK, sw: 5 },
    { d: blob(154, 160, 40, 24), fill: PURPLE_DARK, stroke: INK, sw: 5 },
    { d: 'M 30 160 L 82 160', stroke: INK, sw: 4 },
    { d: 'M 128 160 L 180 160', stroke: INK, sw: 4 },
  ],
};

/** Furry green paws. */
const paws = {
  box: { x: 0, y: 0, w: 240, h: 150 },
  add: [
    { d: furryBlob(62, 74, 50, 44, 30, 9), fill: GREEN, stroke: INK, sw: 5 },
    { d: furryBlob(178, 74, 50, 44, 30, 9), fill: GREEN, stroke: INK, sw: 5 },
    { d: blob(62, 92, 30, 20), fill: GREEN_LIGHT },
    { d: blob(178, 92, 30, 20), fill: GREEN_LIGHT },
    { d: 'M 44 96 L 44 112', stroke: INK, sw: 4 },
    { d: 'M 62 98 L 62 116', stroke: INK, sw: 4 },
    { d: 'M 80 96 L 80 112', stroke: INK, sw: 4 },
    { d: 'M 160 96 L 160 112', stroke: INK, sw: 4 },
    { d: 'M 178 98 L 178 116', stroke: INK, sw: 4 },
    { d: 'M 196 96 L 196 112', stroke: INK, sw: 4 },
  ],
};

/* -------------------------------------------------------------------- the arms */

/**
 * Tentacle arms: two to a side, one waving up and one hanging down, mirrored left and right.
 * The roots meet the body side by side; everything else is the tentacle's own.
 */
const tentacleArms = (() => {
  const W = 320;
  const flip = ([x, y]) => [W - x, y];
  // the roots leave the same hole for the body as every other pair (gen.cjs HOLE = 0.4), so
  // nothing is slid and the tentacles keep the size they are drawn at
  const up = [[100, 92], [70, 56], [46, 98], [22, 40]];
  const down = [[98, 124], [68, 146], [56, 110], [26, 176]];
  const left = [tentacle(...up, -1, 22), tentacle(...down, 1, 21)];
  const right = [tentacle(...up.map(flip), 1, 22), tentacle(...down.map(flip), -1, 21)];
  const all = [...left, ...right];
  return {
    box: { x: 0, y: 0, w: W, h: 200 },
    add: [
      ...all.map((t) => ({ d: t.body, fill: TENTACLE, stroke: INK, sw: 5 })),
      ...all.flatMap((t) => t.suckers.map((d) => ({ d, fill: SUCKER, stroke: INK, sw: 2.5 }))),
    ],
  };
})();

/* ------------------------------------------------------- which cut each replaces */
/**
 * A drawn piece stands in for the whole cut it replaces, so every shape of that drawing's
 * row is left out. Which drawing hardly matters any more — nothing is repainted — but each
 * one keeps the drawing its slot was measured from, so the sheet does not move.
 */
const FROM = {
  smile: ['1-Bricky', 'mouth'],
  fangs: ['6-SpikeaBoo', 'mouth'],
  beak: ['2-Fuzzbop', 'mouth'],
  long: ['1-Bricky', 'legs'],
  paws: ['2-Fuzzbop', 'legs'],
  tentacle: ['5-Bubblegoo', 'arms'],
};
const SHAPES = { smile, fangs, beak, long, paws, tentacle: tentacleArms };

const file = path.join(__dirname, 'extras.json');
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (const [id, [drawing, row]] of Object.entries(FROM)) {
  const cut = JSON.parse(fs.readFileSync(path.join(__dirname, 'cuts', `${drawing}.json`), 'utf8'));
  all[id] = { omit: cut[row], box: SHAPES[id].box, add: SHAPES[id].add };
}
fs.writeFileSync(file, `${JSON.stringify(all, null, 1)}\n`);
console.log('extras.json written');
for (const id of Object.keys(FROM)) console.log(` ${id.padEnd(7)} ${all[id].add.length} pieces, replacing ${FROM[id][0]} ${FROM[id][1]}`);

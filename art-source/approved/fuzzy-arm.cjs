/**
 * Makes the fuzzy arms furry, the way Fuzzbop's own body is furry.
 *
 *   node art-source/approved/fuzzy-arm.cjs
 *
 * Clara: "a arm fuzzy quero que seja peluda, como da foto". The arms she is looking at are
 * cut from Fuzzbop — his four arm shapes — and every one of them has a smooth outline, while
 * his BODY, in the same drawing, is a ring of twenty-six fur bumps. So the arms were the one
 * part of him that forgot it was furry.
 *
 * The bumps are not invented. They are measured off his own body and off the photograph she
 * sent, and the two agree:
 *
 *   his body   chord 42.3 units, sticking out 13.2 — a third of the chord — crests round,
 *              valleys sharp, the tangent breaking by about 113 degrees at each one
 *   her photo  tuft base 0.58 of the limb's width, sticking out 0.14 of the base, tips round,
 *              valleys sharp, and every tuft raked the same way along the limb
 *
 * So each run of outline is cut into whole periods, each period rises to a round crest pushed
 * out along the outward normal, and the crest sits a little before the middle of its period,
 * which is what makes the fur lean.
 */
const fs = require('fs');
const path = require('path');

const FLAT = JSON.parse(fs.readFileSync(path.join(__dirname, 'flat', '2-Fuzzbop.json'), 'utf8'));

/* ------------------------------------------------------------------ vectors */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => (len(a) ? mul(a, 1 / len(a)) : [0, 0]);
const r2 = (n) => Math.round(n * 100) / 100;
const P = (p) => `${r2(p[0])} ${r2(p[1])}`;

/* ------------------------------------------------- reading one of her paths */
/**
 * Samples an SVG path into a closed polygon.
 *
 * These four shapes use M, L, C, A and Z, absolute, which is what this reads — the mittens
 * are drawn with real circular arcs and those have to come out round, not chorded.
 */
function polygonOf(d, step = 1.2) {
  const tok = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let start = [0, 0];
  let cmd = 'M';
  const num = () => parseFloat(tok[i++]);
  const push = (p) => {
    if (!pts.length || len(sub(p, pts[pts.length - 1])) > 1e-6) pts.push(p);
  };
  const sample = (at, length) => {
    const n = Math.max(2, Math.ceil(length / step));
    for (let k = 1; k <= n; k++) push(at(k / n));
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z' || cmd === 'z') {
      cur = start;
      break;
    }
    if (cmd === 'M') {
      cur = [num(), num()];
      start = cur;
      push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      const to = [num(), num()];
      sample((t) => add(mul(cur, 1 - t), mul(to, t)), len(sub(to, cur)));
      cur = to;
    } else if (cmd === 'C') {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const to = [num(), num()];
      const rough = len(sub(c1, cur)) + len(sub(c2, c1)) + len(sub(to, c2));
      const from = cur;
      sample((t) => {
        const m = 1 - t;
        return [
          m * m * m * from[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * to[0],
          m * m * m * from[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * to[1],
        ];
      }, rough);
      cur = to;
    } else if (cmd === 'A') {
      const rx = Math.abs(num());
      const ry = Math.abs(num());
      const rot = (num() * Math.PI) / 180;
      const large = num();
      const sweep = num();
      const to = [num(), num()];
      sample(arcAt(cur, to, rx, ry, rot, large, sweep), Math.PI * (rx + ry) * 0.5);
      cur = to;
    } else {
      break;
    }
  }
  return pts;
}

/** The endpoint form of an SVG arc, turned into a point at t — the standard conversion. */
function arcAt(from, to, rx, ry, rot, large, sweep) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let RX = rx;
  let RY = ry;
  const check = (x1 * x1) / (RX * RX) + (y1 * y1) / (RY * RY);
  if (check > 1) {
    RX *= Math.sqrt(check);
    RY *= Math.sqrt(check);
  }
  const top = RX * RX * RY * RY - RX * RX * y1 * y1 - RY * RY * x1 * x1;
  const bottom = RX * RX * y1 * y1 + RY * RY * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, top / bottom));
  const cx1 = (k * RX * y1) / RY;
  const cy1 = (-k * RY * x1) / RX;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const angle = (ux, uy, vx, vy) => {
    const s = Math.sign(ux * vy - uy * vx) || 1;
    const c = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
    return s * Math.acos(c);
  };
  const start = angle(1, 0, (x1 - cx1) / RX, (y1 - cy1) / RY);
  let sweepAngle = angle((x1 - cx1) / RX, (y1 - cy1) / RY, (-x1 - cx1) / RX, (-y1 - cy1) / RY);
  if (!sweep && sweepAngle > 0) sweepAngle -= Math.PI * 2;
  if (sweep && sweepAngle < 0) sweepAngle += Math.PI * 2;
  return (t) => {
    const a = start + sweepAngle * t;
    const x = RX * Math.cos(a);
    const y = RY * Math.sin(a);
    return [cos * x - sin * y + cx, sin * x + cos * y + cy];
  };
}

/* ---------------------------------------------------------------- the fur */
/** Walks a closed polygon, returning a point and the outward normal at a distance along it. */
function walker(ring) {
  const n = ring.length;
  const steps = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const L = len(sub(ring[(i + 1) % n], ring[i]));
    steps.push(total);
    total += L;
  }
  /** Which way is out: the ring is walked one way round, and this says which. */
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const hand = area > 0 ? -1 : 1;
  const at = (s) => {
    const d = ((s % total) + total) % total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (steps[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    const a = ring[lo];
    const b = ring[(lo + 1) % n];
    const seg = len(sub(b, a)) || 1;
    const t = (d - steps[lo]) / seg;
    const dir = norm(sub(b, a));
    return { p: add(mul(a, 1 - t), mul(b, t)), dir, out: mul([-dir[1], dir[0]], hand) };
  };
  return { at, total };
}

/**
 * One furred outline.
 *
 * @param {number} chord  how long one tuft is along the edge
 * @param {number} sag    how far its crest stands proud of the edge
 * @param {number} rake   where the crest sits in its period — under a half leans it forward
 */
function furred(ring, { chord, sag, rake }) {
  const { at, total } = walker(ring);
  const n = Math.max(5, Math.round(total / chord));
  const step = total / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = at(i * step);
    const b = at((i + 1) * step);
    const m = at((i + rake) * step);
    const crest = add(m.p, mul(m.out, sag));
    const along = norm(sub(b.p, a.p));
    const ease = step * 0.22;
    if (!i) d = `M ${P(a.p)}`;
    // up to the crest: leaves the valley along its own line, arrives running with the edge
    const up1 = add(a.p, mul(norm(sub(crest, a.p)), len(sub(crest, a.p)) * 0.45));
    const up2 = sub(crest, mul(along, ease));
    d += ` C ${P(up1)} ${P(up2)} ${P(crest)}`;
    // and down into the next valley, which stays a corner
    const dn1 = add(crest, mul(along, ease));
    const dn2 = add(b.p, mul(norm(sub(crest, b.p)), len(sub(crest, b.p)) * 0.45));
    d += ` C ${P(dn1)} ${P(dn2)} ${P(b.p)}`;
  }
  return `${d} Z`;
}

/* ----------------------------------------------------- Fuzzbop's own arms */
/**
 * His two arms and his two mittens, with the numbers his own body's fur is drawn at.
 *
 * A tuft a third as proud as it is long is his; a tuft raked to 0.38 of its period is hers.
 * The mittens get a shorter tuft because their outline is shorter and a fat bump on a small
 * hand reads as a lump rather than as fur.
 */
const PIECES = [
  { i: 9, chord: 40, sag: 12 },
  { i: 11, chord: 40, sag: 12 },
  { i: 10, chord: 30, sag: 8 },
  { i: 12, chord: 30, sag: 8 },
];
const RAKE = 0.38;

const add2 = [];
const box = { x: Infinity, y: Infinity, X: -Infinity, Y: -Infinity };
for (const { i, chord, sag } of PIECES) {
  const s = FLAT[i];
  if (!s || !s.d) throw new Error(`shape ${i} is not a path`);
  // every one of these four carries the same translate, which the flattener left on them
  const shift = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(s.transform || '');
  const dx = shift ? parseFloat(shift[1]) : 0;
  const dy = shift ? parseFloat(shift[2]) : 0;
  const ring = polygonOf(s.d).map((p) => [p[0] + dx, p[1] + dy]);
  const d = furred(ring, { chord, sag, rake: RAKE });
  for (const p of ring) {
    box.x = Math.min(box.x, p[0] - sag);
    box.y = Math.min(box.y, p[1] - sag);
    box.X = Math.max(box.X, p[0] + sag);
    box.Y = Math.max(box.Y, p[1] + sag);
  }
  add2.push({ d, fill: s.fill, stroke: s.stroke, sw: parseFloat(s['stroke-width'] || 3.5) });
}

const pad = 2;
const out = {
  fuzzy: {
    /** His own four arm shapes, which these replace, fur and all. */
    omit: PIECES.map((p) => p.i),
    box: { x: r2(box.x - pad), y: r2(box.y - pad), w: r2(box.X - box.x + pad * 2), h: r2(box.Y - box.y + pad * 2) },
    add: add2,
  },
};

const file = path.join(__dirname, 'extras.json');
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
all.fuzzy = out.fuzzy;
fs.writeFileSync(file, `${JSON.stringify(all, null, 1)}\n`);
console.log('extras.json: fuzzy written');
for (const [n, p] of PIECES.entries()) {
  console.log(`  shape ${p.i}: tuft ${p.chord} long, ${p.sag} proud — ${(add2[n].d.match(/C/g) || []).length / 2} tufts`);
}
console.log(`  box ${out.fuzzy.box.x} ${out.fuzzy.box.y} ${out.fuzzy.box.w} ${out.fuzzy.box.h}`);

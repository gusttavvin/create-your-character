/**
 * Builds the claw hand by tracing the photograph Clara sent, and writes it where both
 * generators read it.
 *
 *   node art-source/approved/claw-hand.cjs
 *
 * She sent `hand-ref.png`: a crop of one of her monsters with its hand thrown open. Twice I
 * tried to build that hand out of parts — a palm with ovals laid over it — and twice it came
 * out as a bunch of separate blobs, because that is what it was. Her hand is ONE continuous
 * shape: four fingers of four different lengths and widths growing out of a palm, with deep
 * rounded notches between them, a single outline running all the way round, and a lighter
 * shape inside it holding the light.
 *
 * So this does not draw a hand. It reads her picture and walks the outline out of the pixels:
 *
 *   - the photograph holds two hands, a light one in front and a darker one behind it;
 *   - the four fingers of the front one are surrounded by paper, so their outline is real
 *     boundary and can be traced;
 *   - inside that outline the pale orange is one single region and the stronger orange-red is
 *     the band around it, which is why the hand is a light shape lying on a darker one and
 *     not a shape with a rim painted on;
 *   - only the underside of the palm has to be invented, because there the front hand runs
 *     into the one behind it — and that edge is where the forearm meets the hand anyway.
 *
 * The traced outline is smoothed and written as cubic Béziers: the curve a round thing needs.
 * A fan of short straight lines is what made the earlier attempts look cut out of paper.
 *
 * The hand is then measured into a frame of its own — across the wrist, and out along the way
 * it points — so it can be laid along either arm at any size, and mirrored for the other
 * hand, which is how every pair of parts in this project is drawn.
 */
const fs = require('fs');
const path = require('path');
const { readPng, at } = require('./png.cjs');

/* ------------------------------------------------------------------ vectors */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => (len(a) ? mul(a, 1 / len(a)) : [0, 0]);
const rad = (d) => (d * Math.PI) / 180;
const r2 = (n) => Math.round(n * 100) / 100;

/** Puts a point every `step` along a polyline, so smoothing treats every stretch alike. */
function resample(pts, step, loop) {
  const src = loop ? [...pts, pts[0]] : pts;
  const out = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const seg = sub(src[i], src[i - 1]);
    const L = len(seg);
    if (!L) continue;
    const u = mul(seg, 1 / L);
    let t = step - carry;
    while (t <= L) {
      out.push(add(src[i - 1], mul(u, t)));
      t += step;
    }
    carry = (L - (t - step)) % step;
  }
  if (loop) out.pop();
  else if (len(sub(src[src.length - 1], out[out.length - 1])) > step * 0.4) out.push(src[src.length - 1]);
  return out;
}

/** A [1,4,6,4,1] pass along the line, which takes the pixel staircase off a traced edge. */
function smooth(pts, times, loop) {
  const n = pts.length;
  const K = [1, 4, 6, 4, 1];
  let p = pts.map((q) => q.slice());
  for (let t = 0; t < times; t++) {
    const q = p.map((v) => v.slice());
    for (let i = 0; i < n; i++) {
      if (!loop && (i < 2 || i > n - 3)) continue;
      let sx = 0;
      let sy = 0;
      for (let k = -2; k <= 2; k++) {
        const j = loop ? (i + k + n) % n : Math.max(0, Math.min(n - 1, i + k));
        sx += K[k + 2] * p[j][0];
        sy += K[k + 2] * p[j][1];
      }
      q[i] = [sx / 16, sy / 16];
    }
    p = q;
  }
  return p;
}

/**
 * The polyline as cubic Béziers, through Catmull-Rom.
 *
 * Each segment gets the two control points that carry its neighbours' slope into it, so the
 * curve runs through every measured point and leaves it smoothly. This is the difference
 * between a traced circle and twenty short lines arranged in a ring.
 */
function cubics(pts, loop) {
  const n = pts.length;
  const P = (i) => (loop ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${r2(P(0)[0])} ${r2(P(0)[1])}`;
  const last = loop ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const c1 = add(P(i), mul(sub(P(i + 1), P(i - 1)), 1 / 6));
    const c2 = sub(P(i + 1), mul(sub(P(i + 2), P(i)), 1 / 6));
    d += ` C ${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(P(i + 1)[0])} ${r2(P(i + 1)[1])}`;
  }
  return loop ? `${d} Z` : d;
}

/* ------------------------------------------------------- reading the photograph */
const REF = readPng(path.join(__dirname, 'hand-ref.png'));
const { w: W, h: H } = REF;
const bright = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const isPaper = (r, g, b) => r > 232 && g > 230 && b > 218;
/** The crop carries a grey rounded frame, which is not part of the drawing. */
const isFrame = (r, g, b) => r - b < 40 && bright(r, g, b) < 130;

function maskOf(test) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = at(REF, x, y);
      m[y * W + x] = test(r, g, b, x, y) ? 1 : 0;
    }
  }
  return m;
}

/** Moore-neighbour tracing: walks the edge of the blob that holds `seed`, pixel by pixel. */
function trace(mask, seed) {
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  let sx = seed[0];
  const sy = seed[1];
  while (on(sx - 1, sy)) sx--;
  const ring = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out = [[sx, sy]];
  let cur = [sx, sy];
  let from = 4; // we arrived from the left
  for (let guard = 0; guard < 40000; guard++) {
    let next = null;
    for (let k = 1; k <= 8; k++) {
      const d = ring[(from + k) % 8];
      const p = [cur[0] + d[0], cur[1] + d[1]];
      if (on(p[0], p[1])) {
        next = p;
        from = (((from + k) % 8) + 4) % 8;
        break;
      }
    }
    if (!next) break;
    if (next[0] === out[0][0] && next[1] === out[0][1] && out.length > 8) break;
    out.push(next);
    cur = next;
  }
  return out;
}

const nearest = (pts, x, y) => {
  let bi = 0;
  let bd = Infinity;
  pts.forEach((p, i) => {
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi;
};

/**
 * Where the traced outline stops being the front hand.
 *
 * On the right it is where the palm meets the hand behind it; on the left it is where that
 * hand's fingers begin. Those two are read off a magnified copy of the photograph with a
 * pixel grid over it; everything between them is measured from the pixels.
 */
const CUT_RIGHT = [93, 50];
const CUT_LEFT = [46, 65];
const INSIDE_PALM = [62, 52];

/**
 * The hand is traced by its COLOUR, not by its ink.
 *
 * Two of her fingers have their outlines touching, so the edge of the ink runs round the pair
 * as a single lobe with a dent in it — which is exactly what Clara saw and called fingers
 * stuck together. The colour inside those fingers does not touch: the ink seam parts it, and
 * the edge of the colour follows the parting the whole way down. So the shape taken here is
 * the blob of orange that is the hand in front, and the drawn line goes along its edge, which
 * is where she drew hers.
 */
/**
 * The hand’s own colour, told apart from the line round it by how much red is in it.
 *
 * Her three fills are #F38547, #E74413 and the shaded #D52D0C, all of them above 210 red;
 * her line is #690A03 and its deepest shadow #911004, both under 150. Brightness alone does
 * not separate them — the shade and the line overlap there, and a threshold on it either ate
 * the shaded side of a finger or bridged the gap between two of them.
 */
const isSkin = (r, g, b) => !isPaper(r, g, b) && r >= 170 && r - b > 45;
const handMask = (() => {
  const skin = maskOf(isSkin);
  const keep = new Uint8Array(W * H);
  const seed = [60, 45]; // well inside the palm of the hand in front
  const q = [seed];
  keep[seed[1] * W + seed[0]] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const i = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || keep[i] || !skin[i]) continue;
      keep[i] = 1;
      q.push([nx, ny]);
    }
  }
  return keep;
})();
const outline = trace(handMask, [60, 45]);
const iRight = nearest(outline, CUT_RIGHT[0], CUT_RIGHT[1]);
const iLeft = nearest(outline, CUT_LEFT[0], CUT_LEFT[1]);

/** From the right-hand cut, backwards round all four fingers, to the left-hand cut. */
const fingersArc = [];
for (let i = iRight; i >= 0; i--) fingersArc.push(outline[i]);
for (let i = outline.length - 1; i >= iLeft; i--) fingersArc.push(outline[i]);

/**
 * Gently, and once.
 *
 * Each pass of that kernel blurs the line by about one step's worth, and the notches
 * between her fingers are only six or seven pixels across: smoothed four times over, the
 * fingers came out short and chubby with the gaps between them filled in. One pass at one
 * pixel takes the staircase off a traced edge and leaves the shape alone.
 */
// the drawn line sits on the edge of the colour, which is where she drew hers
let edge = resample(smooth(resample(fingersArc, 1, false), 1, false), 2, false);

/**
 * The underside of the palm, which the photograph does not show, as a shallow bulge.
 *
 * It is the only invented stretch of the whole outline, and the forearm covers most of it.
 */
const endL = edge[edge.length - 1];
const endR = edge[0];
const across = mul(add(endL, endR), 0.5);
const away = norm(sub(across, INSIDE_PALM));
const palmBack = [0.2, 0.4, 0.5, 0.6, 0.8].map((t) => {
  const p = add(mul(endL, 1 - t), mul(endR, t));
  return add(p, mul(away, 7 * Math.sin(t * Math.PI)));
});
/**
 * Opens the notches until there is paper between the drawn lines.
 *
 * Two of her fingers touch along a hairline. At the size she drew them that reads as two
 * fingers side by side; at the weight this monster's line is drawn at — five units, on a hand
 * a third the height of the creature — the two lines meet and the pair welds into one lobe
 * with a dent in it, which is what Clara saw. So wherever two facing walls come closer than a
 * line and a gap, they are pushed apart until they are not.
 *
 * Only walls that face each other across paper are moved: the pair is left alone unless the
 * point halfway between them lies outside the hand, which is what tells a notch from the two
 * sides of a fingertip.
 */
function openNotches(ring, gap) {
  const n = ring.length;
  const pts = ring.map((p) => p.slice());
  const outside = (p) => {
    let hit = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return !hit;
  };
  for (let pass = 0; pass < 30; pass++) {
    let worst = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 4; j < n; j++) {
        // a ring has two ways round, and near the seam the short way is the one that counts
        if (Math.min(j - i, n - (j - i)) < 4) continue;
        const away = sub(pts[j], pts[i]);
        const L = len(away);
        if (L >= gap || L < 1e-6) continue;
        if (!outside(mul(add(pts[i], pts[j]), 0.5))) continue;
        const push = mul(mul(away, 1 / L), (gap - L) * 0.25);
        pts[i] = sub(pts[i], push);
        pts[j] = add(pts[j], push);
        worst = Math.max(worst, gap - L);
      }
    }
    if (worst < 0.05) break;
  }
  return smooth(pts, 1, true);
}

/** A line and a gap, in the photograph's own pixels — see SIZE for what a unit is worth. */
const APART = 7;
const silhouette = openNotches(resample([...edge, ...palmBack], 2, true), APART);

/** The lighter shape inside: in the photograph the pale orange is one single region. */
function insideSilhouette(x, y) {
  let hit = false;
  for (let i = 0, j = silhouette.length - 1; i < silhouette.length; j = i++) {
    const [xi, yi] = silhouette[i];
    const [xj, yj] = silhouette[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const paleRaw = maskOf((r, g, b, x, y) => insideSilhouette(x + 0.5, y + 0.5) && !isPaper(r, g, b) && bright(r, g, b) >= 142);
// close the one-pixel nicks, so the light reads as one shape and not a row of islands
const pale = paleRaw.slice();
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    if (paleRaw[y * W + x]) continue;
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) n += paleRaw[(y + dy) * W + x + dx];
    if (n >= 3) pale[y * W + x] = 1;
  }
}
const light = resample(smooth(resample(trace(pale, [57, 41]), 1, true), 2, true), 2.4, true);

/**
 * The lines her drawing has inside the hand.
 *
 * Where one finger lies across the palm, or two of them touch along their whole length, the
 * paper shows through as a hairline that never reaches the outside of the hand — so walking
 * the outline cannot find it, and without it a finger reads as part of the palm. These are
 * the scraps of paper shut inside the silhouette: each one is thin and straightish, and each
 * is drawn as the line it is.
 */
function creasesInside() {
  const trapped = maskOf((r, g, b, x, y) => insideSilhouette(x + 0.5, y + 0.5) && !isSkin(r, g, b));
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!trapped[i] || seen[i]) continue;
      const stack = [[x, y]];
      seen[i] = 1;
      const px = [];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        px.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          const j = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j] || !trapped[j]) continue;
          seen[j] = 1;
          stack.push([nx, ny]);
        }
      }
      if (px.length < 6) continue;
      // the middle of the scrap, and the way it runs
      const c = mul(px.reduce((a, p) => add(a, p), [0, 0]), 1 / px.length);
      let sxx = 0;
      let sxy = 0;
      let syy = 0;
      for (const p of px) {
        sxx += (p[0] - c[0]) ** 2;
        sxy += (p[0] - c[0]) * (p[1] - c[1]);
        syy += (p[1] - c[1]) ** 2;
      }
      const u = (() => {
        const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        return [Math.cos(th), Math.sin(th)];
      })();
      const along = px.map((p) => dot(sub(p, c), u));
      const across = px.map((p) => dot(sub(p, c), [-u[1], u[0]]));
      const long = Math.max(...along) - Math.min(...along);
      const wide = Math.max(...across) - Math.min(...across);
      if (long < 5 || long < wide * 2.2) continue; // a line, not a nick
      // five points spaced along it, each the middle of the scrap thereabouts
      const lo = Math.min(...along);
      const line = [];
      for (let k = 0; k < 5; k++) {
        const t0 = lo + (long * k) / 5;
        const t1 = lo + (long * (k + 1)) / 5;
        const bin = px.filter((_, n) => along[n] >= t0 && along[n] <= t1);
        if (bin.length) line.push(add(mul(bin.reduce((a, p) => add(a, p), [0, 0]), 1 / bin.length), [0.5, 0.5]));
      }
      // the two ends of the scrap itself, so the line reaches as far as the paper does
      const end = (pick) => add(px[along.indexOf(pick(...along))], [0.5, 0.5]);
      if (line.length > 2) out.push([end(Math.min), ...line, end(Math.max)]);
    }
  }
  return out;
}
const creases = creasesInside();

/* --------------------------------------------- the hand in a frame of its own */
/**
 * The wrist is the chord the two cuts leave, and the hand points straight out of it.
 *
 * Measuring it this way, rather than from the middle of the palm, is what keeps the palm's
 * back edge square to the forearm when the hand is laid along one.
 */
const WRIST = mul(add(endL, endR), 0.5);
const chord = norm(sub(endR, endL));
const AIM = dot([-chord[1], chord[0]], norm(sub(INSIDE_PALM, WRIST))) > 0 ? [-chord[1], chord[0]] : [chord[1], -chord[0]];
const REACH = Math.max(...silhouette.map((p) => len(sub(p, WRIST))));

/** Along the way the hand points, and across it: the frame everything is measured in. */
const local = (p) => [dot(sub(p, WRIST), AIM) / REACH, dot(sub(p, WRIST), [-AIM[1], AIM[0]]) / REACH];
const LOCAL = { silhouette: silhouette.map(local), light: light.map(local), creases: creases.map((c) => c.map(local)) };

/**
 * How far the hand is cocked to one side of its own wrist.
 *
 * In the photograph the wrist is bent — the fan of fingers does not sit square to it. That is
 * true of a real hand and it is hers, but laid on a straight arm it reads as a hand snapped
 * sideways, so the placement turns it back by this much and the fingers keep their own angles
 * to each other.
 */
const BEND = (() => {
  const c = LOCAL.silhouette.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return (Math.atan2(c[1], c[0]) * 180) / Math.PI;
})();

/**
 * Lays the hand along one arm.
 *
 * @param {object} o
 * @param {[number,number]} o.wrist  where the forearm ends, in the drawing's own coordinates
 * @param {number} o.aim             which way the hand points, in degrees; y runs down the
 *                                   page, so 90 is straight down and 180 is to the left
 * @param {number} o.reach           how far the longest finger reaches from the wrist
 * @param {boolean} o.flip           mirrored, for the other hand of the pair
 */
function laid({ wrist, aim, reach, flip }) {
  const e1 = [Math.cos(rad(aim)), Math.sin(rad(aim))];
  const e2 = [-e1[1], e1[0]];
  const put = ([u, v]) => add(wrist, add(mul(e1, u * reach), mul(e2, (flip ? -v : v) * reach)));
  return {
    silhouette: LOCAL.silhouette.map(put),
    light: LOCAL.light.map(put),
    creases: LOCAL.creases.map((c) => c.map(put)),
  };
}

/* --------------------------------------------------------- Bricky's own forearms */
/**
 * His two forearms, read out of his drawing rather than guessed at.
 *
 * Each is a curved band ending in one straight line — the blunt end the hand he came with was
 * drawn over. That line is the wrist: its middle is where the hand goes and its own direction
 * is how the hand is turned. The band is sampled into a polygon as well, so the outline of
 * the new hand can be drawn everywhere the arm does not already cover it.
 */
const ARM_SHAPES = JSON.parse(fs.readFileSync(path.join(__dirname, 'flat', '1-Bricky.json'), 'utf8'));

/** Reads one of these paths — only M, L, C and Z appear in them — into a polygon. */
function polygonOf(d, steps = 18) {
  const tok = d.match(/[MLCZmlcz]|-?\d*\.?\d+/g) || [];
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = 'M';
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[MLCZmlcz]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z' || cmd === 'z') break;
    if (cmd === 'M' || cmd === 'L') {
      cur = [num(), num()];
      pts.push({ p: cur, cmd });
    } else if (cmd === 'C') {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const to = [num(), num()];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const m = 1 - t;
        pts.push({
          p: [
            m * m * m * cur[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * to[0],
            m * m * m * cur[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * to[1],
          ],
          cmd: 'C',
        });
      }
      cur = to;
    } else break;
  }
  return pts;
}

/** The forearm: its outline as a polygon, and the straight line that is its wrist. */
function forearm(index) {
  const pts = polygonOf(ARM_SHAPES[index].d);
  const cutAt = pts.findIndex((q, k) => k > 0 && q.cmd === 'L');
  if (cutAt < 1) throw new Error(`shape ${index}: no straight end to take for a wrist`);
  const a = pts[cutAt - 1].p;
  const b = pts[cutAt].p;
  const poly = pts.map((q) => q.p);
  const mid = mul(add(a, b), 0.5);
  const middle = poly.reduce((s, q) => add(s, q), [0, 0]);
  const axis = norm(sub(mid, mul(middle, 1 / poly.length)));
  return { poly, wrist: mid, width: len(sub(a, b)), axis };
}

/** Is this point already covered by the arm? Then the hand's line is not drawn there. */
function insidePoly(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ------------------------------------------ the two hands of the purple monster */
/**
 * The left arm sweeps down and out, the right is thrown up in a wave, and the two hands are
 * mirror images of each other — every part that comes in a pair in this project is.
 *
 * Each hand is turned so that it points the way its arm does, and pushed back into the arm far
 * enough for the palm to cover the blunt end it was cut off at.
 */
const SIZE = 84;
const TUCK = 15;
const HANDS = [
  { shape: 0, flip: false },
  { shape: 1, flip: true },
].map(({ shape, flip }) => {
  const arm = forearm(shape);
  const axis = (Math.atan2(arm.axis[1], arm.axis[0]) * 180) / Math.PI;
  return {
    arm,
    ...laid({
      wrist: sub(arm.wrist, mul(arm.axis, TUCK)),
      aim: axis + (flip ? BEND : -BEND),
      reach: SIZE,
      flip,
    }),
  };
});

const MAIN = '#9B5DE5';
const LIGHT = '#B584F0';
const INK = '#0B1B3B';
const STROKE = 5;

/**
 * One hand, as the three continuous shapes it is drawn with.
 *
 * The outline is a path of its own rather than a stroke around the silhouette, and it stops
 * where the arm hides it: in Clara's drawings a hand and its arm share one unbroken line, and
 * a stroked silhouette would lay a line straight across the wrist like the cuff of a mitten.
 * The two ends come to rest on the arm's own two side lines, which carry the outline on.
 *
 * It also gives the model a real round rod along the outline instead of a rim painted on the
 * surface.
 */
function pieces(hand) {
  const ring = hand.silhouette;
  const shown = ring.map((p) => !insidePoly(hand.arm.poly, p[0], p[1]));
  /** The one run of the ring that the arm does not cover, starting where the line starts. */
  const start = shown.findIndex((q, i) => q && !shown[(i - 1 + shown.length) % shown.length]);
  const inked = [];
  for (let k = 0; k < ring.length; k++) {
    const i = (start + k) % ring.length;
    if (!shown[i]) break;
    inked.push(ring[i]);
  }
  return [
    { d: cubics(ring, true), fill: MAIN },
    { d: cubics(hand.light, true), fill: LIGHT },
    // the lines inside come before the outline, which is the heaviest line on the hand
    ...hand.creases.map((c) => ({ d: cubics(c, false), stroke: INK, sw: STROKE * 0.8 })),
    { d: cubics(inked, false), stroke: INK, sw: STROKE },
  ];
}

const box = (() => {
  const all = HANDS.flatMap((h) => h.silhouette);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = STROKE / 2 + 0.5;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x: r2(x), y: r2(y), w: r2(Math.max(...xs) + pad - x), h: r2(Math.max(...ys) + pad - y) };
})();

const out = {
  claw: {
    /** Bricky's own hands, which these replace. */
    omit: [41, 42],
    /**
     * The room the hands take, which the generators add to the arms' own box.
     *
     * A hand bigger than the one it replaces would otherwise be measured against the old
     * piece, and the whole arm would be shrunk into the space the old hand took.
     */
    box,
    add: HANDS.flatMap(pieces),
  },
};

fs.writeFileSync(path.join(__dirname, 'extras.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log('extras.json written');
console.log(`  traced ${silhouette.length} points round the hand, ${light.length} round the light, ${creases.length} lines inside it`);
console.log(
  `  reference wrist ${WRIST.map((n) => n.toFixed(1)).join(',')}, reach ${REACH.toFixed(1)}px, aim ${((Math.atan2(AIM[1], AIM[0]) * 180) / Math.PI).toFixed(1)}deg`,
);
console.log(`  claw box ${box.x} ${box.y} ${box.w} ${box.h}, ${out.claw.add.length} pieces`);

/** For the check page beside it: the traced shapes in the photograph own coordinates. */
module.exports = { silhouette, light, creases, WRIST, AIM, REACH, BEND, cubics };

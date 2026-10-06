/**
 * Writes every drawn outline of every part out as plain data, so the modelled monster can
 * be built from the drawings themselves instead of from shapes arranged to look like them.
 *
 * The flat monster is a slice of a drawing. The modelled one is now the same slice given
 * thickness and inflated, so its silhouette IS the drawing's silhouette. For that the
 * renderer needs the outlines, not the finished SVG, which is what this emits: for each
 * word in the worksheet, the paths that make it, in painting order, with the colour each
 * one wears and what that colour is for.
 *
 *   node art-source/approved/genpaths.cjs
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..');

const ALL = ['1-Bricky', '2-Fuzzbop', '3-Wobble', '4-Bumblepop', '5-Bubblegoo', '6-SpikeaBoo'];
const CUT = {};
const SHAPES = {};
for (const n of ALL) {
  CUT[n] = JSON.parse(fs.readFileSync(path.join(HERE, 'cuts', `${n}.json`), 'utf8'));
  SHAPES[n] = JSON.parse(fs.readFileSync(path.join(HERE, 'flat', `${n}.json`), 'utf8'));
}
const BBOX = JSON.parse(fs.readFileSync(path.join(HERE, 'bbox.json'), 'utf8'));
const GRAD = JSON.parse(fs.readFileSync(path.join(HERE, 'gradients.json'), 'utf8'));
/** Pieces drawn by hand, in a file both generators read — see gen.cjs for the other half. */
const DRAWN = JSON.parse(fs.readFileSync(path.join(HERE, 'extras.json'), 'utf8'));
const { grownBox } = require('./drawn-jsx.cjs');

/** The creature's own base colour — what every other shade on it is measured from. */
const BASE = {
  '1-Bricky': '#9B5DE5',
  '2-Fuzzbop': '#FF8A47',
  '3-Wobble': '#5CDFC3',
  '4-Bumblepop': '#FFD24A',
  '5-Bubblegoo': '#FF86C0',
  '6-SpikeaBoo': '#5CC9F5',
};

/** Which drawing each word in the worksheet is cut from — the same table the flat kit uses. */
const OPTIONS = {
  body: {
    round: '2-Fuzzbop',
    egg: '3-Wobble',
    square: '1-Bricky',
    hourglass: '4-Bumblepop',
  },
  eyes: { stalks: '6-SpikeaBoo', multiple: '3-Wobble', one: '5-Bubblegoo', angry: '1-Bricky' },
  mouth: { smile: '1-Bricky', tongue: '3-Wobble', fangs: '6-SpikeaBoo', beak: '2-Fuzzbop' },
  arms: { claw: '1-Bricky', tentacle: '5-Bubblegoo', pincher: '6-SpikeaBoo', fuzzy: '2-Fuzzbop' },
  legs: { paws: '2-Fuzzbop', bird: '4-Bumblepop', long: '1-Bricky', snake: '5-Bubblegoo' },
};

/**
 * The two words no drawing covers, and the one brow that had to be turned over.
 *
 * Nobody among the six has eyes on stalks or a pincher, and the purple one wears his brows
 * raised, which reads as worried rather than cross. The flat kit answers all three the same
 * way — by building on another creature's own parts at his own line weight — and the model
 * has to answer them identically or the two views stop being the same monster.
 */
const EXTRA = {
  angry: {
    omit: [35, 36],
    rect: { x: 140, y: 129, w: 230, h: 119 },
    add: [
      { d: 'M 148 138 C 172 138 204 150 228 163', stroke: '#5E30B0', sw: 14 },
      { d: 'M 364 136 C 344 140 316 150 294 161', stroke: '#5E30B0', sw: 13 },
    ],
  },
  stalks: {
    omit: [54, 55],
    rect: { x: 142.2, y: 166.2, w: 227.6, h: 213 },
    add: [
      { d: 'M 198 262 C 195 306 200 336 205 362', stroke: '#5CC9F5', sw: 30, first: true },
      { d: 'M 318 256 C 320 300 316 330 311 360', stroke: '#5CC9F5', sw: 30, first: true },
    ],
  },
  pincher: {
    omit: [29, 31],
    rect: { x: 43, y: 356.2, w: 462, h: 164.8 },
    add: [
      { d: 'M 122 466 L 62 436', stroke: '#43BAEF', sw: 31 },
      { d: 'M 122 472 L 66 502', stroke: '#43BAEF', sw: 31 },
      { d: 'M 424 398 L 486 370', stroke: '#43BAEF', sw: 31 },
      { d: 'M 424 404 L 482 434', stroke: '#43BAEF', sw: 31 },
    ],
  },
};

/** A rough middle for a hand-written path: enough to know what it lies on. */
function middleOf(d) {
  const n = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  const mid = (a) => (Math.min(...a) + Math.max(...a)) / 2;
  return [r2(mid(xs)), r2(mid(ys))];
}

/* -------------------------------------------------------------- geometry */

const r2 = (n) => Math.round(n * 100) / 100;

/** An ellipse as a path, so everything downstream deals with one kind of outline. */
function ellipsePath(cx, cy, rx, ry) {
  return `M ${r2(cx - rx)} ${r2(cy)} a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0 Z`;
}

function toPath(s) {
  if (s.tag === 'path') return s.d;
  if (s.tag === 'circle') return ellipsePath(+s.cx, +s.cy, +s.r, +s.r);
  if (s.tag === 'ellipse') return ellipsePath(+s.cx, +s.cy, +s.rx, +s.ry);
  if (s.tag === 'rect') {
    const x = +s.x;
    const y = +s.y;
    const w = +s.width;
    const h = +s.height;
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return null;
}

/** A translate carried by a shape, baked into its points rather than left as an attribute. */
function shift(s) {
  const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(s.transform || '');
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}

function union(name, indices) {
  const boxes = BBOX[name];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of indices) {
    const b = boxes[i];
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
}

/* ---------------------------------------------------------------- colour */

const REPAINT = new Set(['main', 'dark', 'light']);

/** The colour halfway through a run of stops. */
function blend(list) {
  const rgb = list.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const avg = [0, 1, 2].map((c) => Math.round(rgb.reduce((s, v) => s + v[c], 0) / rgb.length));
  return '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** What a colour is: the creature's own, which is repainted, or the drawing's, which is not. */
function colourOf(name, value, roles) {
  if (!value || value === 'none') return null;
  if (value.startsWith('url(')) {
    const g = GRAD[name] && GRAD[name][value.slice(5, -1)];
    // A modelled piece gets its roundness from the light on it, so a painted gradient is
    // flattened to one colour. It has to be the gradient's MIDDLE, mixed from its ends:
    // taking a stop off the end turned the sunny monster olive.
    const mid = g ? blend(g.stops.map((s) => s.color)) : BASE[name];
    return { hex: mid, repaint: REPAINT.has(roles.get(value) || 'main') };
  }
  const role = roles.get(value) || 'fixed';
  return { hex: value, repaint: false, ink: role === 'ink' };
}

/* ----------------------------------------------------------------- build */

const out = {};
const boxes = {};
/** How far each pair of arms was slid together; the box closes up with it. */
const shrink = {};

/** The hole a pair of arms leaves, as a share of its width — the same number gen.cjs uses. */
const HOLE = 0.4;

for (const [category, opts] of Object.entries(OPTIONS)) {
  for (const [optionId, name] of Object.entries(opts)) {
    const roles = new Map(CUT[name].colorRoles.map((r) => [r.value, r.role]));
    const extra = EXTRA[optionId] || DRAWN[optionId];
    const omit = new Set((extra && extra.omit) || []);
    const indices = CUT[name][category].filter((i) => !omit.has(i));
    const pieces = [];
    const hand = (spec, i) => {
      const [cx, cy] = middleOf(spec.d);
      // these are shades of the creature's own colour, so they follow it when repainted
      return {
        i,
        d: spec.d,
        dx: 0,
        dy: 0,
        fill: spec.fill || null,
        repaint: false,
        stroke: spec.stroke || null,
        sw: spec.sw || 0,
        cx,
        cy,
        area: 0,
      };
    };
    for (const [n, spec] of ((extra && extra.add) || []).entries()) {
      if (spec.first) pieces.push(hand(spec, -1 - n));
    }
    for (const i of indices) {
      const s = SHAPES[name][i];
      const d = toPath(s);
      if (!d) continue;
      const [dx, dy] = shift(s);
      const fill = colourOf(name, s.fill, roles);
      const stroke = colourOf(name, s.stroke, roles);
      const sw = parseFloat(s['stroke-width'] || 0) || 0;
      const b = BBOX[name][i];
      pieces.push({
        i,
        d,
        dx,
        dy,
        fill: fill ? fill.hex : null,
        repaint: !!(fill && fill.repaint),
        stroke: stroke ? stroke.hex : null,
        sw,
        cx: r2(b.x + b.w / 2 + dx),
        cy: r2(b.y + b.h / 2 + dy),
        area: r2(b.w * b.h),
      });
    }
    for (const [n, spec] of ((extra && extra.add) || []).entries()) {
      if (!spec.first) pieces.push(hand(spec, -100 - n));
    }
    /**
     * Some drawings paint a silhouette twice: once filled, and again with nothing inside it,
     * to put the outline back on top of whatever was laid over it. The model gets its
     * outline from the camera, so the second copy is only a loose hoop floating round the
     * body, and it is dropped.
     */
    /**
     * The arms slide to a common hole, the same slide gen.cjs makes in the drawing.
     *
     * Every pair leaves a different gap for the body — the pincers almost touch, the little
     * tentacles are mostly gap — so each arm is moved sideways until the hole is the same
     * share of the pair's width everywhere. After that one plain size rule serves them all.
     */
    if (category === 'arms') {
      const spans = pieces.map((q) => {
        const xs = (q.d.match(/-?\d*\.?\d+/g) || []).map(Number).filter((_, k) => k % 2 === 0);
        return [Math.min(...xs) + q.dx, Math.max(...xs) + q.dx];
      });
      const sorted = spans.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).sort((a, b) => a[0] - b[0]);
      const merged = sorted.length ? [sorted[0].slice()] : [];
      for (const sp of sorted.slice(1)) {
        const last = merged[merged.length - 1];
        if (sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
        else merged.push(sp.slice());
      }
      let hole = merged.length ? null : undefined;
      for (let i = 1; i < merged.length; i++) {
        const gap = merged[i][0] - merged[i - 1][1];
        if (!hole || gap > hole.gap) hole = { gap, mid: (merged[i][0] + merged[i - 1][1]) / 2 };
      }
      const wide = merged.length ? merged[merged.length - 1][1] - merged[0][0] : NaN;
      const slide = hole && Number.isFinite(wide) ? r2((hole.gap - HOLE * wide) / (2 * (1 - HOLE))) : 0;
      if (slide && sorted.length > 1) {
        pieces.forEach((q, n) => {
          const by = (spans[n][0] + spans[n][1]) / 2 < hole.mid ? slide : -slide;
          q.dx = r2(q.dx + by);
          q.cx = r2(q.cx + by);
        });
        shrink[optionId] = slide;
      }
    }

    const filledPaths = new Set(pieces.filter((q) => q.fill).map((q) => q.d));
    for (const q of pieces) if (!q.fill && filledPaths.has(q.d)) q.echo = true;

    out[optionId] = { source: name.slice(2), base: BASE[name], pieces: pieces.filter((q) => !q.echo) };
    // a hand-drawn piece larger than the one it replaces brings its own room with it
    const mine = indices.length ? union(name, indices) : null;
    const grown = mine ? grownBox(mine, extra && extra.box) : extra.box;
    const closed = shrink[optionId] || 0;
    const wide = (extra && extra.rect) || grown;
    boxes[optionId] = {
      x: r2(wide.x + closed),
      y: r2(wide.y),
      w: r2(wide.w - 2 * closed),
      h: r2(wide.h),
    };
  }
}

const ts = `/**
 * Every drawn outline of every part, as plain data.
 *
 * The modelled monster is built from these: each outline is given thickness and inflated,
 * so it swells in the middle and thins to nothing at its edge. The silhouette of a modelled
 * piece is therefore exactly the silhouette of the drawn one, because it is the same
 * outline — what makes it a model and not a sticker is the volume put into it.
 *
 * Coordinates are the drawing's own, y running down the page. \`dx\`/\`dy\` is a shift the
 * drawing carried, already added to the measured centre but still to be applied to the
 * outline itself.
 *
 * GENERATED by art-source/approved/genpaths.cjs. Do not hand-edit.
 */

export interface DrawnPiece {
  /** Where it is in the drawing, for finding it again. */
  i: number;
  /** The outline, in SVG path syntax. */
  d: string;
  dx: number;
  dy: number;
  /** What it is painted, or null for an outline with nothing inside it. */
  fill: string | null;
  /** Whether that colour follows the creature's own colour or is part of the drawing. */
  repaint: boolean;
  stroke: string | null;
  /** The drawn line's width, in drawing units. */
  sw: number;
  cx: number;
  cy: number;
  area: number;
}

export interface DrawnPart {
  /** The approved drawing this part was cut from. */
  source: string;
  /** That creature's own colour, which repainting is measured from. */
  base: string;
  pieces: DrawnPiece[];
}

export const MONSTER_PIECES: Record<string, DrawnPart> = ${JSON.stringify(out, null, 1)
  .replace(/"([a-zA-Z]\w*)":/g, '$1:')
  .replace(/"/g, "'")};

/** Each part's own box in its drawing, which is what the body's slots are matched against. */
export const MONSTER_PART_RECT: Record<string, { x: number; y: number; w: number; h: number }> = ${JSON.stringify(
  boxes,
  null,
  1,
)
  .replace(/"([a-zA-Z]\w*)":/g, '$1:')
  .replace(/"/g, "'")};
`;

fs.writeFileSync(path.join(REPO, 'src/characters/monster/paths3d.ts'), ts);
console.log('paths3d.ts written');
for (const [id, p] of Object.entries(out)) {
  console.log(' ', id.padEnd(11), p.source.padEnd(10), String(p.pieces.length).padStart(2), 'pieces', JSON.stringify(boxes[id]));
}

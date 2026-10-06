/**
 * Builds the monster's parts out of the six drawings Clara approved.
 *
 * Nothing here is drawn from scratch. Each approved monster is a finished 520 x 620
 * picture; this cuts it along the lines the game needs — body, eyes, mouth, arms, legs —
 * and writes each piece out as a component whose viewBox is the piece's own measured box.
 * The compositor then places that box on the sheet, so a piece worn by the monster it came
 * from lands back exactly where the artist put it, down to the last curve.
 *
 * Inputs (all in this folder):
 *   flat/<name>.json   every shape of a drawing, in painting order, attributes resolved
 *   bbox.json          each shape's box, measured by a real renderer, stroke included
 *   gradients.json     the gradient stops the drawings declare
 *   cuts/<name>.json   which shapes make which part, and what each colour is for
 *
 *   node art-source/approved/gen.cjs
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..');

const BBOX = JSON.parse(fs.readFileSync(path.join(HERE, 'bbox.json'), 'utf8'));
/** Each trunk measured row by row, so a limb can be hung where the body actually is. */
const PROFILE = JSON.parse(fs.readFileSync(path.join(HERE, 'profile.json'), 'utf8'));
const GRAD = JSON.parse(fs.readFileSync(path.join(HERE, 'gradients.json'), 'utf8'));
/**
 * Pieces drawn by hand, in a file both generators read.
 *
 * `extras.json` is written by claw-hand.cjs, and the flat kit and the model are both
 * generated from it, so a piece drawn for one view cannot drift from the other. Clara
 * spent whole rounds on the flat monster and the modelled one not being one creature.
 */
const DRAWN = JSON.parse(fs.readFileSync(path.join(HERE, 'extras.json'), 'utf8'));
const { drawnJsx, grownBox } = require('./drawn-jsx.cjs');

const NAMES = ['1-Bricky', '2-Fuzzbop', '3-Wobble', '4-Bumblepop', '5-Bubblegoo', '6-SpikeaBoo'];
const CUT = {};
for (const n of NAMES) CUT[n] = JSON.parse(fs.readFileSync(path.join(HERE, 'cuts', `${n}.json`), 'utf8'));
const SHAPES = {};
for (const n of NAMES) SHAPES[n] = JSON.parse(fs.readFileSync(path.join(HERE, 'flat', `${n}.json`), 'utf8'));

/** The creature's own base colour in each drawing — what every other shade is measured from. */
const BASE = {
  '1-Bricky': '#9B5DE5',
  '2-Fuzzbop': '#FF8A47',
  '3-Wobble': '#5CDFC3',
  '4-Bumblepop': '#FFD24A',
  '5-Bubblegoo': '#FF86C0',
  '6-SpikeaBoo': '#5CC9F5',
};

/** The sheet a monster is laid out on. */
const VW = 600;
const VH = 720;
const MARGIN = 12;
const CATEGORIES = ['body', 'eyes', 'mouth', 'arms', 'legs'];

/**
 * The hole a pair of arms leaves for the body, as a share of how wide the pair is.
 *
 * Bricky's own pair leaves 0.38 of its width and Fuzzbop's 0.44; the pincers leave 0.21
 * and the little tentacles 0.59. Slid to one number, every pair can then be sized by the
 * plain rule below and still close on the body — which is what stopped the tentacles
 * floating and the pincers being blown off the sheet.
 */
const HOLE = 0.4;

/* ------------------------------------------------------------ hand-made pieces
 *
 * Four of the five rows are covered by the six drawings outright. Two words are not:
 * none of the approved monsters has eyes on stalks, and none has a pincher. Rather than
 * invent a new look for them, each is built on top of the blue monster's own parts —
 * his eyes, his arm — with the missing bit drawn at his line weight and in his colours,
 * so they belong to the same family as everything else.
 */
const STALKS = `      <path d="M 198 262 C 195 306 200 336 205 362" fill="none" stroke={INK} strokeWidth="37.2" strokeLinecap="round" />
      <path d="M 318 256 C 320 300 316 330 311 360" fill="none" stroke={INK} strokeWidth="37.2" strokeLinecap="round" />
      <path d="M 198 262 C 195 306 200 336 205 362" fill="none" stroke="#5CC9F5" strokeWidth="30" strokeLinecap="round" />
      <path d="M 318 256 C 320 300 316 330 311 360" fill="none" stroke="#5CC9F5" strokeWidth="30" strokeLinecap="round" />
      <ellipse cx="192" cy="310" rx="6" ry="22" fill="#A2E4FC" transform="rotate(-4 192 310)" />
      <ellipse cx="312" cy="306" rx="6" ry="22" fill="#A2E4FC" transform="rotate(3 312 306)" />`;

// The purple monster wears his eyebrows raised, which reads as worried rather than cross.
// These are his own brows — his colour, his weight, the same soft crescent — turned the
// other way up so they press down towards his nose.
const BROWS = `      <path d="M 148 138 C 172 138 204 150 228 163" fill="none" stroke="#5E30B0" strokeWidth="14" strokeLinecap="round" />
      <path d="M 364 136 C 344 140 316 150 294 161" fill="none" stroke="#5E30B0" strokeWidth="13" strokeLinecap="round" />`;

const PINCERS = `      <path d="M 122 466 L 62 436" fill="none" stroke={INK} strokeWidth="38.2" strokeLinecap="round" />
      <path d="M 122 472 L 66 502" fill="none" stroke={INK} strokeWidth="38.2" strokeLinecap="round" />
      <path d="M 122 466 L 62 436" fill="none" stroke="#43BAEF" strokeWidth="31" strokeLinecap="round" />
      <path d="M 122 472 L 66 502" fill="none" stroke="#43BAEF" strokeWidth="31" strokeLinecap="round" />
      <path d="M 424 398 L 486 370" fill="none" stroke={INK} strokeWidth="38.2" strokeLinecap="round" />
      <path d="M 424 404 L 482 434" fill="none" stroke={INK} strokeWidth="38.2" strokeLinecap="round" />
      <path d="M 424 398 L 486 370" fill="none" stroke="#43BAEF" strokeWidth="31" strokeLinecap="round" />
      <path d="M 424 404 L 482 434" fill="none" stroke="#43BAEF" strokeWidth="31" strokeLinecap="round" />
      <ellipse cx="88" cy="452" rx="16" ry="7" fill="#A2E4FC" transform="rotate(27 88 452)" />
      <ellipse cx="452" cy="386" rx="16" ry="7" fill="#A2E4FC" transform="rotate(-24 452 386)" />`;

/**
 * Which drawing each word in the worksheet is cut from.
 *
 * The four bodies are four whole creatures, and the four rows below them are cut from all
 * six, so a child mixing rows is always mixing pieces of monsters Clara approved.
 */
const OPTIONS = {
  body: {
    round: { from: '2-Fuzzbop', component: 'BodyRound' },
    egg: { from: '3-Wobble', component: 'BodyEgg' },
    square: { from: '1-Bricky', component: 'BodySquare' },
    hourglass: { from: '4-Bumblepop', component: 'BodyHourglass' },
  },
  eyes: {
    stalks: {
      from: '6-SpikeaBoo',
      component: 'EyesStalks',
      omit: [54, 55],
      before: STALKS,
      box: '142.2 166.2 227.6 213',
    },
    multiple: { from: '3-Wobble', component: 'EyesMultiple' },
    one: { from: '5-Bubblegoo', component: 'EyesOne' },
    angry: {
      from: '1-Bricky',
      component: 'EyesAngry',
      omit: [35, 36],
      after: BROWS,
      box: '140 129 230 119',
    },
  },
  mouth: {
    smile: { from: '1-Bricky', component: 'MouthSmile' },
    tongue: { from: '3-Wobble', component: 'MouthTongue' },
    fangs: { from: '6-SpikeaBoo', component: 'MouthFangs' },
    beak: { from: '2-Fuzzbop', component: 'MouthBeak' },
  },
  arms: {
    claw: { from: '1-Bricky', component: 'ArmClaw' },
    tentacle: { from: '5-Bubblegoo', component: 'ArmTentacle' },
    pincher: {
      from: '6-SpikeaBoo',
      component: 'ArmPincher',
      omit: [29, 31],
      after: PINCERS,
      box: '43 356.2 462 164.8',
    },
    fuzzy: { from: '2-Fuzzbop', component: 'ArmFuzzy' },
  },
  legs: {
    paws: { from: '2-Fuzzbop', component: 'LegsPaws' },
    bird: { from: '4-Bumblepop', component: 'LegsBird' },
    long: { from: '1-Bricky', component: 'LegsLong' },
    snake: { from: '5-Bubblegoo', component: 'LegsSnake' },
  },
};

/* ------------------------------------------------------------------ geometry */

const nl = String.fromCharCode(10);
const r2 = (n) => Math.round(n * 100) / 100;

function union(name, indices) {
  const boxes = BBOX[name];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const i of indices) {
    const b = boxes[i];
    if (!b) throw new Error(`${name}: no measured box for shape ${i}`);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
}

/** How big a drawing can be on the sheet without a raised arm or an antenna running off it. */
function placement(name) {
  const all = [].concat(...CATEGORIES.map((c) => CUT[name][c]));
  const f = union(name, all);
  const s = Math.min((VW - MARGIN * 2) / f.w, (VH - MARGIN * 2) / f.h);
  return { s, ox: VW / 2 - s * (f.x + f.w / 2), oy: VH / 2 - s * (f.y + f.h / 2) };
}

/** How wide the body's own silhouette is at that height, in the drawing's coordinates. */
function trunkWidthAt(name, y) {
  const p = PROFILE[name];
  if (!p) return null;
  const [, y0, , h] = p.box;
  const n = p.rows.length;
  const want = Math.round(((y - y0) / h) * (n - 1));
  for (let k = 0; k < n; k++) {
    for (const j of [want - k, want + k]) {
      const row = j >= 0 && j < n ? p.rows[j] : null;
      if (row) return row[1] - row[0];
    }
  }
  return null;
}

/**
 * The widest stretch of nothing between one arm and the other, in the drawing's units.
 *
 * It is what a pair of arms has to bridge: fit that to the body and the arms touch it,
 * whatever their shape. Fitting the whole box instead put the little tentacles out in the
 * air, because most of their box is the hole in the middle.
 */
function innerGap(name, indices, drawn) {
  const spans = indices.map((i) => [BBOX[name][i].x, BBOX[name][i].x + BBOX[name][i].w]);
  for (const piece of drawn || []) {
    const n = (piece.d.match(/-?\d*\.?\d+/g) || []).map(Number).filter((_, k) => k % 2 === 0);
    if (n.length) spans.push([Math.min(...n), Math.max(...n)]);
  }
  if (spans.length < 2) return null;
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [spans[0].slice()];
  for (const sp of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else merged.push(sp.slice());
  }
  let best = null;
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i][0] - merged[i - 1][1];
    // and where the middle of that hole is, because a creature that waves one arm has its
    // pair drawn off to one side of its own box
    if (!best || gap > best.gap) best = { gap, mid: (merged[i][0] + merged[i - 1][1]) / 2 };
  }
  // and how wide the whole pair is, which is what the hole is a share of
  if (best) best.wide = merged[merged.length - 1][1] - merged[0][0];
  return best;
}

function onSheet(name, box) {
  const p = placement(name);
  return {
    cx: r2(p.ox + p.s * (box.x + box.w / 2)),
    cy: r2(p.oy + p.s * (box.y + box.h / 2)),
    w: r2(p.s * box.w),
    h: r2(p.s * box.h),
  };
}

/* -------------------------------------------------------------------- colour */

/** Roles the palette repaints; everything else is part of the drawing and stays put. */
/**
 * Which colours follow the body they are worn on: none of them, now.
 *
 * Clara asked for it straight out — "as cores não vão mudar conforme o corpinho, eu quero
 * cada corpinho com uma cor e cada braço e perna com outra cor". So a monster is a mix: an
 * orange body with purple arms and yellow legs, each piece in the colours of the creature
 * it was cut from. Putting a role back in this set turns the repainting on again.
 */
const REPAINT = new Set();

function roleTable(name) {
  const m = new Map();
  for (const r of CUT[name].colorRoles) m.set(r.value, r.role);
  return m;
}

function colorAttr(value, roles, optionId, gradients) {
  if (!value || value === 'none') return { literal: 'none' };
  if (value.startsWith('url(')) {
    const gradName = value.slice(5, -1);
    gradients.add(gradName);
    return { expr: '`url(#' + optionId + '-' + gradName + '-${k})`' };
  }
  const role = roles.get(value) || 'fixed';
  if (role === 'ink') return { expr: 'INK' };
  if (REPAINT.has(role)) return { expr: `p('${value}')` };
  return { literal: value };
}

/* -------------------------------------------------------------------- shapes */

const GEOM = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2'];
const CAMEL = {
  'stroke-width': 'strokeWidth',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-linecap': 'strokeLinecap',
  'stroke-dasharray': 'strokeDasharray',
  'fill-opacity': 'fillOpacity',
  'stroke-opacity': 'strokeOpacity',
  opacity: 'opacity',
};

function shapeJsx(s, roles, optionId, gradients, key) {
  const a = [`key="${key}"`];
  for (const g of GEOM) if (s[g] !== undefined) a.push(`${g}="${s[g]}"`);
  if (s.transform) a.push(`transform="${s.transform}"`);
  for (const attr of ['fill', 'stroke']) {
    if (s[attr] === undefined) continue;
    const c = colorAttr(s[attr], roles, optionId, gradients);
    a.push(c.expr ? `${attr}={${c.expr}}` : `${attr}="${c.literal}"`);
  }
  if (s.stroke && s.stroke !== 'none') {
    for (const k of ['stroke-width', 'stroke-linejoin', 'stroke-linecap', 'stroke-dasharray']) {
      if (s[k] !== undefined) a.push(`${CAMEL[k]}="${s[k]}"`);
    }
  }
  for (const k of ['opacity', 'fill-opacity', 'stroke-opacity']) {
    if (s[k] !== undefined) a.push(`${CAMEL[k]}="${s[k]}"`);
  }
  return `      <${s.tag} ${a.join(' ')} />`;
}

function gradientJsx(name, gradName, optionId, roles) {
  const g = GRAD[name][gradName];
  const role = roles.get(`url(#${gradName})`) || 'main';
  const stops = g.stops
    .map((s) => {
      const c = REPAINT.has(role) ? `{p('${s.color}')}` : `"${s.color}"`;
      return `          <stop offset="${s.offset}" stopColor=${c} />`;
    })
    .join('\n');
  return `        <linearGradient id={\`${optionId}-${gradName}-\${k}\`} x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">
${stops}
        </linearGradient>`;
}

/* --------------------------------------------------------------------- build */

const WORDS = {
  round: 'Round', egg: 'Egg', square: 'Square', hourglass: 'Hourglass',
  stalks: 'Stalks', multiple: 'Multiple', one: 'One', angry: 'Angry',
  teeth: 'Teeth', tongue: 'Tongue', jagged: 'Jagged', big_tongue: 'Big Tongue',
  claw: 'Claw', tentacle: 'Tentacle', pincher: 'Pincher', fuzzy: 'Fuzzy',
  stubby: 'Stubby', bird: 'Bird', thick: 'Thick', snake: 'Snake',
};

const components = [];
const boxes = {};
/** Only the arms need one: it is the hole the pair leaves for the body. */
const spans = {};

for (const [category, opts] of Object.entries(OPTIONS)) {
  for (const [optionId, o] of Object.entries(opts)) {
    const name = o.from;
    const roles = roleTable(name);
    const byHand = DRAWN[optionId];
    const omit = new Set(o.omit || (byHand && byHand.omit) || []);
    const indices = CUT[name][category].filter((i) => !omit.has(i));
    const gradients = new Set();
    /**
     * How far each arm slides in, so this pair leaves the same hole as every other.
     *
     * Sliding a group inwards by d closes the hole by 2d and narrows the pair by 2d, so the
     * share works out at (gap - 2d) / (w - 2d) = HOLE.
     */
    const pair = category === 'arms' ? innerGap(name, indices, byHand && byHand.add) : null;
    /** The room the pair takes before it closes up — what the hole is a share of. */
    const flat = o.box
      ? (() => {
          const n = o.box.split(' ').map(Number);
          return { x: n[0], y: n[1], w: n[2], h: n[3] };
        })()
      : (() => {
          const own = indices.length ? union(name, indices) : null;
          return own ? grownBox(own, byHand && byHand.box) : byHand.box;
        })();
    const slide = pair ? r2((pair.gap - HOLE * flat.w) / (2 * (1 - HOLE))) : 0;
    /** Which side of the hole a piece is on: the left one slides right, the right one left. */
    const side = (lo, hi) => ((lo + hi) / 2 < pair.mid ? slide : -slide);
    /**
     * The same slide, for a block of JSX written by hand — one element to a line.
     *
     * The pincers are drawn straight into the component rather than cut from the drawing, and
     * they have to travel with the arm they belong to or the claws come off at the elbow.
     */
    const slideBlock = (block) =>
      !block || !pair || !slide
        ? block
        : block
            .split(nl)
            .map((line) => {
              const d = /d="([^"]+)"/.exec(line);
              const xs = d
                ? (d[1].match(/-?\d*\.?\d+/g) || []).map(Number).filter((_, k) => k % 2 === 0)
                : [parseFloat((/cx="([-\d.]+)"/.exec(line) || [])[1])].filter((n) => !Number.isNaN(n));
              if (!xs.length) return line;
              return `      <g transform="translate(${side(Math.min(...xs), Math.max(...xs))} 0)">${nl}  ${line}${nl}      </g>`;
            })
            .join(nl);

    const shapes = indices.map((i, n) => {
      const jsx = shapeJsx(SHAPES[name][i], roles, optionId, gradients, `s${n}`);
      if (!pair || !slide) return jsx;
      const b = BBOX[name][i];
      return `      <g transform="translate(${side(b.x, b.x + b.w)} 0)">\n  ${jsx}\n      </g>`;
    }).join('\n');

    // a hand-drawn piece larger than the one it replaces brings its own room with it
    const handDrawn = byHand
      ? byHand.add
          .map((spec, n) => {
            const jsx = drawnJsx(spec, roles, `h${n}`);
            if (!pair || !slide) return jsx;
            const xs = (spec.d.match(/-?\d*\.?\d+/g) || []).map(Number).filter((_, k) => k % 2 === 0);
            return `      <g transform="translate(${side(Math.min(...xs), Math.max(...xs))} 0)">\n  ${jsx}\n      </g>`;
          })
          .join(String.fromCharCode(10))
      : '';
    // the pair has closed up, so the room it needs has closed up with it
    const box = `${r2(flat.x + slide)} ${r2(flat.y)} ${r2(flat.w - 2 * slide)} ${r2(flat.h)}`;
    boxes[optionId] = box.split(' ').map(Number);
    if (pair) spans[optionId] = [r2(pair.gap - 2 * slide), r2(pair.mid)];

    const defs = [...gradients].map((g) => gradientJsx(name, g, optionId, roles)).join('\n');
    const body = [slideBlock(o.before), defs ? `      <defs>\n${defs}\n      </defs>` : '', shapes, handDrawn, slideBlock(o.after)]
      .filter(Boolean)
      .join('\n');

    // a piece drawn entirely in colours the palette never touches — a mouth, a pair of
    // eyes — needs neither the repainter nor a namespaced gradient id
    const usesP = body.includes("p('");
    const usesK = body.includes('${k}');
    const decl = [
      // with no palette — on a worksheet card — a piece shows in the colours it was drawn in
      usesP ? `  const c = colors.main || colors.body || '${BASE[name]}';` : '',
      usesK ? '  const k = useId().replace(/:/g, "");' : '',
      usesP ? `  const p = repainter(c, '${BASE[name]}');` : '',
    ]
      .filter(Boolean)
      .join('\n');

    components.push(`/** ${WORDS[optionId]} — cut from ${name.slice(2)}${o.before || o.after ? ', with the piece he never had drawn at his own weight' : ''}. */
export function ${o.component}({${usesP ? ' colors,' : ''} className }: PartSvgProps) {${decl ? `\n${decl}` : ''}
  return (
    <Part box="${box}" className={className}>
${body}
    </Part>
  );
}`);
  }
}

const spanLines = Object.entries(spans)
  .map(([id, g]) => `  ${/^[a-z_]+$/.test(id) ? id : `'${id}'`}: [${g.join(', ')}],`)
  .join(String.fromCharCode(10));

const partsFile = `/**
 * The monster's parts, cut out of the six drawings Clara approved.
 *
 * Nothing in this file was drawn shape by shape. Bricky, Fuzzbop, Wobble, Bumblepop,
 * Bubblegoo and Spike-a-Boo are six finished pictures she picked out, and every piece here
 * is a literal slice of one of them, at the coordinates and the line weight the picture was
 * drawn at. That is why a body worn with its own face and its own limbs comes back exactly
 * as she approved it, and why a body wearing another monster's mouth still looks like it
 * belongs to the same family.
 *
 * Each piece keeps the coordinates of the drawing it came from and carries its own measured
 * box as its viewBox, so placing it is a matter of putting that box somewhere on the sheet —
 * see MONSTER_PART_BOX and the layout in config.ts.
 *
 * GENERATED by art-source/approved/gen.cjs from the drawings beside it. Change a drawing, or
 * the cut it is sliced along, and run that again; do not hand-edit the shapes below.
 */
import { useId, type ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK${REPAINT.size ? ', repainter' : ''} } from '../../lib/color';

/** Kept for anything outside the monster that still asks for a default monster colour. */
export const MONSTER_GREEN = '#7ED957';

/** A slice of a drawing, still in the coordinates it was drawn in. */
function Part({ box, children, className }: { box: string; children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox={box}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
    >
      {children}
    </svg>
  );
}

/**
 * Every piece's own box, as \`[x, y, width, height]\` in the drawing it was cut from.
 *
 * The compositor needs it to keep a piece's shape: a slot on the body says how wide the
 * piece should be, and the height follows from these numbers rather than from a guess.
 */
/**
 * The hole between one arm and the other, and where its middle is, in the units of the
 * drawing the pair was cut from.
 *
 * A pair of arms is fitted by this rather than by its box: what has to match the body is
 * the gap the pair leaves for it. Fitted by the box, two little tentacles — which are mostly
 * hole — ended up out in the air beside the body.
 */
export const MONSTER_PART_SPAN: Record<string, [number, number]> = {
${spanLines}
};

export const MONSTER_PART_BOX: Record<string, [number, number, number, number]> = {
${Object.entries(boxes)
  .map(([id, b]) => `  ${/^[a-z_]+$/.test(id) ? id : `'${id}'`}: [${b.join(', ')}],`)
  .join('\n')}
};

${components.join('\n\n')}
`;

fs.writeFileSync(path.join(REPO, 'src/characters/monster/parts.tsx'), partsFile);

/* ------------------------------------------------------- the layout for config */

/**
 * How far in from the body's edge a pair of arms reaches, where it attaches.
 *
 * Clara: "os braços ainda não estão corretos, estão longe do corpo". They were being sized
 * from the body's BOX, and a body is not a box — Bricky's head is wide and his belly, which
 * is where his arms attach, is a third narrower, so the arms hung in the air beside it.
 *
 * Now the body is measured across at the height the arms sit, and the pair is fitted so the
 * hole between them lands this far across it. Bricky's own arms sit at 0.77 of his belly;
 * a little deeper than that, and nothing can float.
 */
/** How wide a pair of arms is drawn, against the body it hangs on. */
/** How much of the body sticks out as arm on each side — a stub you can always see. */
const SHOWS = 0.5;

/** And no pair of arms is drawn wider than this much of the body it hangs on. */
const WIDEST = 1.24;

/**
 * How wide a row is drawn on a body, as a share of that body's own width.
 *
 * Every creature's arms and legs were measured from its own drawing, and a drawing is drawn
 * at whatever size suits it: Fuzzbop throws his arms right across the sheet and Bumblepop
 * keeps hers in, so the same pair of arms came out half again as big on one body as on
 * another. Clara saw it at once — "o tamanho de todos os braços não está ajustando ao
 * tamanho do corpo do monstro".
 *
 * WHERE a limb attaches is still the body's own business, because that belongs to the
 * drawing; how big it is drawn is now the body's size, so every pair of arms is the same
 * size on the same monster. The two numbers are the average of what the four bodies were
 * already asking for, so no body moves far from where Clara approved it.
 */
const SPAN = { legs: 0.77 };

/**
 * Where the eyes go, read off the modelled monster.
 *
 * Clara asked for the eyes to come out of the top of the head in every character, and her
 * own sculpted one shows exactly what she means: measured by read-model.cjs, the middle of
 * his eyes sits three tenths of his head down from the crown — the top of them only a
 * seventh — and the pair spans three quarters of his width. The four drawn bodies each had
 * their own idea of it, from a quarter down to two fifths, so his is now the rule.
 */
const EYES = { down: 0.3 };

const layout = {};
for (const [bodyId, o] of Object.entries(OPTIONS.body)) {
  const name = o.from;
  const slots = {};
  for (const cat of CATEGORIES) {
    /**
     * The piece this creature wears in this row.
     *
     * If that piece was redrawn bigger than the one the drawing came with, the space the
     * body reserves for the row has to grow with it. Measured against the old piece alone,
     * a bigger hand only squeezes the whole arm down into the space the old hand took.
     */
    const worn = Object.entries(OPTIONS[cat] || {}).find(([, q]) => q.from === name);
    const drawn = worn && DRAWN[worn[0]];
    /**
     * A piece that stands in for its whole row is drawn in a space of its own.
     *
     * The claw hand was drawn where Bricky's hand was, in his coordinates, so the space the
     * body reserves had to grow to hold it. A mouth or a pair of legs computed from nothing
     * starts at the origin instead, and joining its box to the drawing's would drag the slot
     * off to the corner of the sheet — which is what it did: the beak landed across the eyes.
     */
    const ownSpace = drawn && CUT[name][cat].every((i) => (drawn.omit || []).includes(i));
    const bigger = drawn && !ownSpace ? drawn.box : null;
    slots[cat] = onSheet(name, grownBox(union(name, CUT[name][cat]), bigger));
  }
  for (const [cat, span] of Object.entries(SPAN)) {
    const k = (slots.body.w * span) / slots[cat].w;
    // and hung on the middle of the body: a creature that waves one arm has its pair drawn
    // off to one side, and borrowed by another body that left one of the two behind it
    slots[cat] = { ...slots[cat], cx: slots.body.cx, w: r2(slots[cat].w * k), h: r2(slots[cat].h * k) };
  }
  {
    /**
     * A pair of arms is as wide as the body is THERE, plus a stub of arm on each side.
     *
     * Clara, twice: first they hung in the air beside the body, then "eles não aparecem, para
     * aparecer tem que aumentar muito o tamanho". Both come of measuring against the body's
     * box. A body is not a box — Bricky's head is wide and his belly, where the arms attach,
     * is a third narrower — and a pair sized to the box either misses the belly or has to be
     * blown up until it does.
     *
     * So: the pair spans the belly, so its inner ends are behind the body wherever that body
     * is narrow, and a fixed share of the body sticks out past it, so there is always an arm
     * to see. This works for every option only because the arms were first slid to a common
     * hole in the drawing — see HOLE.
     */
    const own = union(name, CUT[name].arms);
    const trunk = trunkWidthAt(name, own.y + own.h / 2);
    if (trunk) {
      slots.arms = {
        ...slots.arms,
        cx: slots.body.cx,
        // and never wider than the paper it is drawn on
        w: r2(Math.min(placement(name).s * trunk + slots.body.w * SHOWS, VW * 0.97)),
      };
    }
  }
  {
    /**
     * The eyes move up the head; they do not change size.
     *
     * Stretching the row to a share of the head was a mistake with one shape in it: the model
     * carries a PAIR across three quarters of his face, and a creature with one big eye had
     * that single eye stretched to the width of a pair — which is the eye Clara photographed,
     * filling the head and standing out in front of it. Each option keeps the size it was
     * drawn at, on the creature it was drawn for.
     */
    slots.eyes = {
      ...slots.eyes,
      cx: slots.body.cx,
      cy: r2(slots.body.cy - slots.body.h / 2 + slots.body.h * EYES.down),
    };
  }
  layout[bodyId] = { source: name.slice(2), main: BASE[name], slots };
}
fs.writeFileSync(path.join(HERE, 'layout.json'), JSON.stringify(layout, null, 1));

const rect = (r) => `{ cx: ${r.cx}, cy: ${r.cy}, w: ${r.w}, h: ${r.h}${r.max ? `, max: ${r.max}` : ''} }`;
const layoutFile = `/**
 * Where each body carries the rest of the monster, in sheet units.
 *
 * A body is not a shape the game invents a face for: it is one of Clara's six drawings, and
 * these numbers are the measured boxes of that drawing's own eyes, mouth, arms and legs,
 * put on the sheet. A piece worn by the creature it was cut from therefore lands back
 * exactly where the artist drew it, and a piece borrowed from another creature is fitted to
 * the same width so it sits on the face rather than beside it.
 *
 * GENERATED by art-source/approved/gen.cjs together with parts.tsx. The two are one contract: the
 * boxes here are the boxes there, measured from the same drawing.
 */

/** A place on the ${VW} x ${VH} sheet, by its middle and its size. */
export interface SlotRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** As wide as this row may be drawn, whatever the fitting says. Only the arms carry one. */
  max?: number;
}

export interface BodyLayout {
  /** The approved drawing this body, and these places, were cut from. */
  source: string;
  /** That creature's own colour. Every piece it wears is repainted from this. */
  main: string;
  body: SlotRect;
  eyes: SlotRect;
  mouth: SlotRect;
  arms: SlotRect;
  legs: SlotRect;
}

export const MONSTER_SHEET = { vw: ${VW}, vh: ${VH} };

export const MONSTER_BODY_LAYOUT: Record<string, BodyLayout> = {
${Object.entries(layout)
  .map(
    ([id, l]) => `  // ${l.source}
  ${id}: {
    source: '${l.source}',
    main: '${l.main}',
    body: ${rect(l.slots.body)},
    eyes: ${rect(l.slots.eyes)},
    mouth: ${rect(l.slots.mouth)},
    arms: ${rect(l.slots.arms)},
    legs: ${rect(l.slots.legs)},
  },`,
  )
  .join('\n')}
};
`;
fs.writeFileSync(path.join(REPO, 'src/characters/monster/layout.ts'), layoutFile);

console.log('parts.tsx written:', components.length, 'pieces');
for (const [id, b] of Object.entries(boxes)) console.log('  ', id.padEnd(11), b.join(' '));
console.log('\nlayout.json written');
for (const [id, l] of Object.entries(layout)) {
  console.log('  ', id.padEnd(10), l.source.padEnd(10), l.main, JSON.stringify(l.slots.body));
}

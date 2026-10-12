/**
 * Cuts the four dragons Clara approved into the pieces of the dragon game.
 *
 *   node art-source/dragon/gen.cjs
 *
 * Sparky, Blaze, Splash and Pip are four whole pictures (the .svg files beside this one),
 * drawn the way the approved monsters were. Each is drawn in sections, back to front, and
 * every section starts with a comment saying what it is; that comment decides which row of
 * the sheet the section belongs to — tail, wings, eyes, mouth, and everything else (feet,
 * horns, crest, head, belly, cheeks) is the body.
 *
 * Writes src/characters/dragon/parts.tsx: one component per piece, still in the coordinates
 * it was drawn in, and the measurements the sheet needs to put a piece borrowed from one
 * dragon onto another:
 *
 *   box    the piece's whole box, outline included
 *   core   what it is centred and sized by — the two eyeballs, or the mouth itself without
 *          the fire or the bubbles coming out of it
 *   root   where a wing or a tail grows out of the body (the left wing's, for a pair)
 *
 * Do not hand-edit parts.tsx: change a drawing and run this again.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, '..', '..', 'src', 'characters', 'dragon', 'parts.tsx');

/** The four drawings, in the order of the cards (1 to 4), and the id each piece keeps. */
const DRAGONS = [
  { file: '1-Sparky.svg', body: 'classic', wings: 'bat', eyes: 'cute', mouth: 'smile', tail: 'lightning' },
  { file: '2-Blaze.svg', body: 'chubby', wings: 'feather', eyes: 'fierce', mouth: 'fire', tail: 'fire' },
  { file: '3-Splash.svg', body: 'tall', wings: 'butterfly', eyes: 'big', mouth: 'teeth', tail: 'ice' },
  { file: '4-Pip.svg', body: 'spiky', wings: 'tiny', eyes: 'star', mouth: 'tongue', tail: 'leaf' },
];
const ROWS = ['tail', 'wings', 'body', 'eyes', 'mouth'];
const NAME = { tail: 'Tail', wings: 'Wings', body: 'Body', eyes: 'Eyes', mouth: 'Mouth' };

/** Which row a section belongs to, from the comment that starts it. */
function rowOf(comment) {
  const c = comment.toLowerCase();
  if (/\btail\b/.test(c)) return 'tail';
  // a whole word: "blowing", in the blue one's mouth, has "wing" in it
  if (/\bwings?\b/.test(c)) return 'wings';
  if (/\beyes\b/.test(c)) return 'eyes';
  if (/mouth|smile/.test(c)) return 'mouth';
  return 'body';
}

/* ------------------------------------------------------------- reading a drawing */
function attrsOf(s) {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function read(file) {
  const src = fs.readFileSync(path.join(HERE, file), 'utf8');
  const gradients = {};
  for (const m of src.matchAll(/<linearGradient([^>]*)>([\s\S]*?)<\/linearGradient>/g)) {
    const a = attrsOf(m[1]);
    const stops = [...m[2].matchAll(/<stop([^>]*)\/>/g)].map((s) => attrsOf(s[1]));
    gradients[a.id] = { attrs: a, stops };
  }
  const body = src.slice(src.indexOf('<g '), src.lastIndexOf('</g>'));
  const groupAttrs = attrsOf(body.slice(0, body.indexOf('>')));
  const rows = Object.fromEntries(ROWS.map((r) => [r, []]));
  let row = 'body';
  // sections in order: a comment switches the row, elements go into the current one
  for (const m of body.matchAll(/<!--([\s\S]*?)-->|<(path|ellipse|circle)\s([^>]*?)\/>/g)) {
    if (m[1] !== undefined) {
      row = rowOf(m[1]);
      continue;
    }
    const attrs = attrsOf(m[3]);
    // the separate shapes the 3D is built from, where the flat drawing has one outline instead
    if (/\bonly-3d\b/.test(attrs.class ?? '')) continue;
    rows[row].push({ tag: m[2], attrs });
  }
  return { gradients, groupAttrs, rows };
}

/* ----------------------------------------------------------------- measuring */
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

/** Points along a path (absolute M, L, Q, C, A and Z only, which is all these use). */
function pathPoints(d) {
  const tok = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let start = [0, 0];
  let cmd = 'M';
  const num = () => parseFloat(tok[i++]);
  const N = 24;
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      start = cur;
      pts.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === 'Q') {
      const c = [num(), num()];
      const e = [num(), num()];
      for (let k = 1; k <= N; k++) {
        const t = k / N;
        const u = 1 - t;
        pts.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * e[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * e[1]]);
      }
      cur = e;
    } else if (cmd === 'C') {
      const a = [num(), num()];
      const b = [num(), num()];
      const e = [num(), num()];
      for (let k = 1; k <= N; k++) {
        const t = k / N;
        const u = 1 - t;
        pts.push([
          u * u * u * cur[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0],
          u * u * u * cur[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1],
        ]);
      }
      cur = e;
    } else if (cmd === 'A') {
      const rx = num();
      const ry = num();
      const rot = (num() * Math.PI) / 180;
      const large = num();
      const sweep = num();
      const e = [num(), num()];
      const at = arcAt(cur, e, rx, ry, rot, large, sweep);
      for (let k = 1; k <= N; k++) pts.push(at(k / N));
      cur = e;
    } else if (cmd === 'Z' || cmd === 'z') {
      cur = start;
    } else {
      throw new Error(`path command ${cmd} is not read here`);
    }
  }
  return pts;
}

/** An element's outline points, and how far its stroke reaches past them. */
function shapeOf(el, groupWidth) {
  const a = el.attrs;
  const stroked = a.stroke !== 'none';
  const pad = stroked ? parseFloat(a['stroke-width'] ?? groupWidth) / 2 : 0;
  let pts;
  if (el.tag === 'path') pts = pathPoints(a.d);
  else {
    const cx = +a.cx;
    const cy = +a.cy;
    const rx = +(a.rx ?? a.r);
    const ry = +(a.ry ?? a.r);
    pts = Array.from({ length: 48 }, (_, k) => [cx + rx * Math.cos((k / 48) * Math.PI * 2), cy + ry * Math.sin((k / 48) * Math.PI * 2)]);
  }
  return { pts, pad };
}

function boxOf(shapes) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const { pts, pad } of shapes)
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x - pad);
      y0 = Math.min(y0, y - pad);
      x1 = Math.max(x1, x + pad);
      y1 = Math.max(y1, y + pad);
    }
  const r = (n) => Math.round(n * 100) / 100;
  return [r(x0), r(y0), r(x1 - x0), r(y1 - y0)];
}

/** Where the left one of a pair of wings meets the body: the inner end of its root. */
function wingRoot(shapes) {
  const left = shapes.flatMap((s) => s.pts).filter(([x]) => x < 260);
  const inner = Math.max(...left.map(([x]) => x));
  const near = left.filter(([x]) => x > inner - 12);
  const y = near.reduce((s, p) => s + p[1], 0) / near.length;
  return [Math.round(inner), Math.round(y)];
}

/** Where a tail meets the body: its left-most end, which the body hides. */
function tailRoot(shapes) {
  const all = shapes.flatMap((s) => s.pts);
  const outer = Math.min(...all.map(([x]) => x));
  const near = all.filter(([x]) => x < outer + 12);
  const y = near.reduce((s, p) => s + p[1], 0) / near.length;
  return [Math.round(outer), Math.round(y)];
}

/* ------------------------------------------------------------------- writing */
const JSX_NAME = {
  'stroke-width': 'strokeWidth',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-linecap': 'strokeLinecap',
  'stop-color': 'stopColor',
  'fill-opacity': 'fillOpacity',
  // the fire and the bubbles are named so the stylesheet can make them flicker and float
  class: 'className',
};

/**
 * Skin is the colour of the body it is worn by: the lids of the sleepy eyes, which were blue
 * on every dragon, follow the body's colours. A tail keeps its own colour on any body, as
 * Clara asked.
 */
const SKIN_STOPS = ['skinTop', 'skin', 'skinDark'];
const TINTED = ['eyes'];

function element(el, idOf) {
  const parts = Object.entries(el.attrs).map(([k, v]) => {
    const name = JSX_NAME[k] ?? k;
    const url = /^url\(#(.+)\)$/.exec(v);
    if (url) return `${name}={\`url(#\${${idOf(url[1])}})\`}`;
    if (name === 'stroke' && v === '#0B1B3B') return `${name}={INK}`;
    return `${name}="${v}"`;
  });
  return `<${el.tag} ${parts.join(' ')} />`;
}

function component(name, row, dragon, els, box) {
  const used = new Set();
  for (const el of els)
    for (const v of Object.values(el.attrs)) {
      const m = /^url\(#(.+)\)$/.exec(v);
      if (m) used.add(m[1]);
    }
  const idOf = (g) => `${g}Id`;
  const ids = [...used].map((g) => `  const ${g}Id = \`${row}-${g}-\${k}\`;`);
  const defs = [...used].map((g) => {
    const grad = dragon.gradients[g];
    const a = Object.entries(grad.attrs)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const stops = grad.stops.map((s, n) => {
      const colour = TINTED.includes(row) && g === 'skin' ? `{colors.${SKIN_STOPS[n]} ?? '${s['stop-color']}'}` : `"${s['stop-color']}"`;
      return `          <stop offset="${s.offset}" stopColor=${colour} />`;
    });
    return `        <linearGradient id={${idOf(g)}} ${a}>\n${stops.join('\n')}\n        </linearGradient>`;
  });
  const ga = dragon.groupAttrs;
  const tinted = TINTED.includes(row) && used.has('skin');
  return `export function ${name}({ className, ${tinted ? 'colors = {}, ' : ''}view }: DragonPartProps) {
  ${used.size ? "const k = useId().replace(/:/g, '');" : ''}
${ids.join('\n')}
  return (
    <Part box={view ?? '${box.join(' ')}'} className={className}>
${used.size ? `      <defs>\n${defs.join('\n')}\n      </defs>\n` : ''}      <g stroke={INK} strokeWidth="${ga['stroke-width']}" strokeLinejoin="round" strokeLinecap="round">
${els.map((el) => `        ${element(el, idOf)}`).join('\n')}
      </g>
    </Part>
  );
}`.replace(/\n\s*\n\s*\n/g, '\n');
}

const pieces = {};
const components = [];
DRAGONS.forEach((d, n) => {
  const dragon = read(d.file);
  for (const row of ROWS) {
    const els = dragon.rows[row];
    if (!els.length) throw new Error(`${d.file} has no ${row}`);
    const shapes = els.map((el) => shapeOf(el, dragon.groupAttrs['stroke-width']));
    const box = boxOf(shapes);
    const meta = { box };
    if (row === 'eyes') {
      // the eyeballs themselves: the big white circles, not lids, lashes or brows
      const balls = els
        .map((el, i) => [el, shapes[i]])
        // (an almond-shaped eye is a path, named an eyeball in the drawing)
        .filter(([el]) => (el.tag === 'circle' && +el.attrs.r >= 25) || /dragon-eyeball/.test(el.attrs.class ?? ''));
      meta.core = boxOf(balls.map(([, s]) => s));
    } else if (row === 'mouth') {
      meta.core = boxOf([shapes[0]]);
    } else if (row === 'wings') {
      meta.root = wingRoot(shapes);
    } else if (row === 'tail') {
      meta.root = tailRoot(shapes);
    }
    const id = d[row];
    pieces[`${row}:${id}`] = meta;
    const name = `${NAME[row]}${n + 1}`;
    components.push(component(name, row, dragon, els, box));
  }
});

const out = `/**
 * The dragon's parts, cut out of the four dragons Clara approved.
 *
 * Sparky (green), Blaze (red), Splash (blue) and Pip (purple) are four whole pictures in
 * art-source/dragon/, and every piece here is a slice of one of them, at the coordinates and
 * the line weight it was drawn at. A dragon worn with its own pieces comes back exactly as
 * she approved it; a piece borrowed from another dragon is placed on this one by the
 * measurements in DRAGON_PIECES (see Dragon2D).
 *
 * GENERATED by art-source/dragon/gen.cjs from those drawings. Change a drawing and run it
 * again; do not hand-edit the shapes below.
 */
import { useId, type ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK } from '../../lib/color';

export interface DragonPartProps extends PartSvgProps {
  /** A different viewBox: one wing of a pair is shown by narrowing it to that half. */
  view?: string;
}

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

/** One piece's measurements, in the drawing it was cut from (520 by 620). */
export interface DragonPiece {
  /** [x, y, width, height], outline included. */
  box: [number, number, number, number];
  /** What eyes and mouths are centred and sized by. */
  core?: [number, number, number, number];
  /** Where a wing (the left one of the pair) or a tail grows out of the body. */
  root?: [number, number];
}

/** Every piece, by \`row:id\`. A body's own pieces say where that row goes on it. */
export const DRAGON_PIECES: Record<string, DragonPiece> = ${JSON.stringify(pieces, null, 2)};

/** The four bodies, in card order, and the pieces each was drawn with. */
export const DRAGON_OWN: Record<string, Record<string, string>> = ${JSON.stringify(
  Object.fromEntries(DRAGONS.map((d) => [d.body, { tail: d.tail, wings: d.wings, eyes: d.eyes, mouth: d.mouth }])),
  null,
  2,
)};

${components.join('\n\n')}
`;
fs.writeFileSync(OUT, out);
console.log(`parts.tsx: ${components.length} pieces`);
for (const [k, v] of Object.entries(pieces)) console.log(`  ${k.padEnd(16)} ${JSON.stringify(v)}`);

/**
 * Flattens one of the approved monster drawings into a numbered list of shapes.
 *
 * The drawings nest shapes inside <g> elements that carry the fill and the stroke for
 * everything under them, so a shape on its own does not say what colour it is. This walks
 * the tree, pushes every inherited presentation attribute down onto the shape itself, and
 * writes the result out as a flat array in drawing order. Everything downstream — the part
 * each shape belongs to, the colour role it plays, the box it is cut into — is keyed on the
 * index in that array, so the whole pipeline agrees on what "shape 12" means.
 *
 *   node flatten.cjs <in.svg> <out.json>
 */
const fs = require('fs');

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline']);
const INHERIT = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linejoin',
  'stroke-linecap',
  'stroke-dasharray',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
];

/** Reads the attributes of one tag body, e.g. `path d="M0 0" fill="#fff"`. */
function attrs(body) {
  const out = {};
  const re = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return out;
}

function parse(svg) {
  // <defs> hold gradients, not shapes; drop them whole so their stops are never walked.
  const body = svg.replace(/<defs[\s\S]*?<\/defs>/g, '');
  const tags = [...body.matchAll(/<\s*(\/?)([a-zA-Z]+)([^>]*?)(\/?)\s*>/g)];
  const stack = [{}];
  const out = [];
  for (const t of tags) {
    const [, closing, name, rest, selfClosing] = t;
    if (closing) {
      if (name === 'g' || name === 'svg') stack.pop();
      continue;
    }
    const a = attrs(rest);
    if (name === 'g' || name === 'svg') {
      const top = stack[stack.length - 1];
      const next = { ...top };
      for (const k of INHERIT) {
        if (a[k] === undefined) continue;
        // transforms compose, everything else simply overrides
        next[k] = k === 'transform' && top[k] ? `${top[k]} ${a[k]}` : a[k];
      }
      if (!selfClosing) stack.push(next);
      continue;
    }
    if (!SHAPES.has(name)) continue;
    const inherited = stack[stack.length - 1];
    const el = { i: out.length, tag: name };
    for (const k of INHERIT) {
      const v = a[k] !== undefined ? a[k] : inherited[k];
      if (v !== undefined) el[k] = k === 'transform' && a[k] && inherited[k] ? `${inherited[k]} ${a[k]}` : v;
    }
    // the shape's own geometry
    for (const [k, v] of Object.entries(a)) {
      if (INHERIT.includes(k)) continue;
      el[k] = v;
    }
    out.push(el);
  }
  return out;
}

const [, , inFile, outFile] = process.argv;
const shapes = parse(fs.readFileSync(inFile, 'utf8'));
fs.writeFileSync(outFile, JSON.stringify(shapes, null, 1));

// a short readable listing, so a person (or an agent) can see what each index is
for (const s of shapes) {
  const geom = s.d ? `d="${s.d.slice(0, 64)}${s.d.length > 64 ? '…' : ''}"` : Object.entries(s)
    .filter(([k]) => ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height'].includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(
    String(s.i).padStart(3),
    s.tag.padEnd(7),
    `fill=${(s.fill || '-').padEnd(16)}`,
    `stroke=${(s.stroke || '-').padEnd(9)}`,
    `sw=${(s['stroke-width'] || '-').padEnd(4)}`,
    geom,
  );
}

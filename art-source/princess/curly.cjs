/**
 * The curly hair (hair 3): Clara wanted it curly from the roots to the ends, at the front
 * and at the back, with dark blue lights. No picture of it exists, so it is drawn here, in
 * the colours and the outline of the black hair it replaces, on the same 1024 by 1536 canvas
 * as every other piece of the princess.
 *
 * A curl is drawn as what it is, a spring of hair: the strand goes round and round an axis
 * hanging from her head, and the half of each turn that is behind is drawn first, darker,
 * and the half in front over it, lit. On top of her head the curls are small and tight,
 * one beside the other from the parting down to her hairline.
 *
 * curlySvg() gives the two layers as SVG: behind her head and in front of it.
 */
const C = {
  ink: '#140C0C',
  back: '#151116',
  shade: '#1E191E',
  base: '#2F292E',
  lit: '#3D3640',
  light: '#22407A',
  shine: '#3D66C0',
};
const INK = 6.5;

/** A small seeded random, so the drawing is the same every time. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const f1 = (v) => v.toFixed(1);
const poly = (pts) => pts.map(([x, y], k) => (k ? 'L' : 'M') + f1(x) + ' ' + f1(y)).join(' ');

/**
 * A spring of hair hanging from (x, y): length, the radius of its turns (top, end), the width
 * of the strand (top, end), how many turns, which way it leans (degrees) and bends.
 */
function spring({ x, y, len, r0, r1, w0, w1, turns, tilt = 0, bend = 0, phase = 0, dir = 1 }) {
  const a = (tilt * Math.PI) / 180;
  const axis = (s) => {
    const d = s * len;
    // the axis bends a little as it falls
    const bx = bend * Math.sin((Math.PI * s) / 2) * len * 0.25;
    return [x + Math.sin(a) * d + Math.cos(a) * bx, y + Math.cos(a) * d - Math.sin(a) * bx];
  };
  const perp = [Math.cos(a), -Math.sin(a)];
  const N = Math.max(60, Math.round(turns * 40));
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    const th = 2 * Math.PI * turns * s + phase;
    const R = r0 + (r1 - r0) * s;
    const [ax, ay] = axis(s);
    // (a turn drops a little as it comes round: a spring seen from slightly above)
    const lift = Math.cos(th) * R * 0.28;
    pts.push({ x: ax + perp[0] * R * Math.sin(th) * dir, y: ay + perp[1] * R * Math.sin(th) * dir + lift, front: Math.cos(th) > 0, w: w0 + (w1 - w0) * s, s });
  }
  // cut it into half turns, behind and in front
  const segs = [];
  let cur = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    cur.push(pts[k]);
    if (pts[k].front !== pts[k - 1].front || k === pts.length - 1) {
      segs.push({ front: pts[k - 1].front, pts: cur, w: cur[Math.floor(cur.length / 2)].w });
      cur = [pts[k]];
    }
  }
  return segs;
}

function strokeSeg(seg, colour, extra = 0, cap = 'round') {
  return `<path d="${poly(seg.pts.map((p) => [p.x, p.y]))}" fill="none" stroke="${colour}" stroke-width="${f1(seg.w + extra)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
}
/** The lit stripe along a front half turn: towards its top, on the side the light comes from. */
function lightSeg(seg, light) {
  const p = seg.pts;
  if (p.length < 4) return '';
  const off = seg.w * 0.2;
  const shifted = p.map((q) => [q.x, q.y - off]);
  const mid = shifted.slice(Math.floor(p.length * 0.18), Math.ceil(p.length * 0.78));
  let out = `<path d="${poly(mid)}" fill="none" stroke="${C.light}" stroke-width="${f1(seg.w * 0.32)}" stroke-linecap="round" opacity="${light}"/>`;
  const mid2 = shifted.slice(Math.floor(p.length * 0.32), Math.ceil(p.length * 0.6));
  if (mid2.length > 1) out += `<path d="${poly(mid2)}" fill="none" stroke="${C.shine}" stroke-width="${f1(seg.w * 0.1)}" stroke-linecap="round" opacity="${light}"/>`;
  return out;
}

/** Draws springs: every behind half first, then every front half, each with its outline. */
function drawSprings(list, light = 1) {
  const all = list.map(spring);
  let out = '';
  for (const segs of all)
    for (const seg of segs.filter((q) => !q.front)) out += strokeSeg(seg, C.ink, INK * 2) + strokeSeg(seg, C.back);
  for (const segs of all)
    for (const seg of segs.filter((q) => q.front)) out += strokeSeg(seg, C.ink, INK * 2) + strokeSeg(seg, C.base) + lightSeg(seg, light);
  return out;
}

/**
 * A tight curl on top of her head, seen from above: a coil, a round lock with its strand going
 * round inside it. r is its size; turn says which way it winds.
 */
function coil(x, y, r, turn, rot) {
  const sp = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    const ang = rot + turn * t * Math.PI * 2.1;
    const rr = r * (0.18 + 0.62 * t);
    sp.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.86]);
  }
  let out = `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 0.86)}" fill="url(#coil)" stroke="${C.ink}" stroke-width="${INK}"/>`;
  // the strand winding in it: lit on its upper side, the line where it goes round
  out += `<path d="${poly(sp.slice(8).map(([px, py]) => [px, py - r * 0.08]))}" fill="none" stroke="${C.light}" stroke-width="${f1(r * 0.24)}" stroke-linecap="round"/>`;
  out += `<path d="${poly(sp.slice(16, 32).map(([px, py]) => [px, py - r * 0.1]))}" fill="none" stroke="${C.shine}" stroke-width="${f1(r * 0.07)}" stroke-linecap="round"/>`;
  out += `<path d="${poly(sp)}" fill="none" stroke="${C.ink}" stroke-width="${f1(Math.max(3.5, r * 0.11))}" stroke-linecap="round"/>`;
  return out;
}

const DEFS = `<defs>
<radialGradient id="coil" cx="0.4" cy="0.32" r="0.75"><stop offset="0" stop-color="${C.lit}"/><stop offset="0.55" stop-color="${C.base}"/><stop offset="1" stop-color="${C.shade}"/></radialGradient>
</defs>`;

/** Mirror a spring to her other side. */
const mirror = (s) => ({ ...s, x: 1024 - s.x, tilt: -(s.tilt ?? 0), bend: -(s.bend ?? 0), dir: -(s.dir ?? 1), phase: (s.phase ?? 0) + 0.7 });

/** The springs behind her: round the back of her head and down behind her shoulders. */
function backSprings() {
  const left = [
    { x: 300, y: 300, len: 400, r0: 22, r1: 17, w0: 25, w1: 15, turns: 8.2, tilt: 14, bend: 0.2 },
    { x: 262, y: 360, len: 400, r0: 22, r1: 17, w0: 25, w1: 15, turns: 8, tilt: 10, bend: 0.25, phase: 1.3 },
    { x: 236, y: 440, len: 330, r0: 21, r1: 16, w0: 24, w1: 14, turns: 6.8, tilt: 8, bend: 0.3, phase: 2.6 },
    { x: 304, y: 440, len: 330, r0: 21, r1: 16, w0: 24, w1: 14, turns: 6.8, tilt: 3, phase: 2.2 },
    { x: 360, y: 500, len: 260, r0: 20, r1: 16, w0: 23, w1: 14, turns: 5.4, tilt: 0, phase: 0.6 },
    { x: 424, y: 540, len: 210, r0: 20, r1: 16, w0: 22, w1: 14, turns: 4.2, tilt: -2, phase: 2.9 },
  ];
  return [...left, ...left.map(mirror)];
}
/** The springs in front of her ears, framing her face. */
function frontSprings() {
  const left = [
    { x: 300, y: 380, len: 360, r0: 22, r1: 16, w0: 25, w1: 14, turns: 7.4, tilt: 6, bend: 0.15, phase: 0.4 },
    { x: 340, y: 420, len: 300, r0: 20, r1: 15, w0: 23, w1: 13, turns: 6.2, tilt: 2, bend: -0.1, phase: 1.9 },
  ];
  return [...left, ...left.map(mirror)];
}

/**
 * The coils on top of her head, row by row from the crown down to her hairline: each row an
 * arc round her head, the lower rows over the upper ones.
 */
function topCoils() {
  const rnd = rng(7);
  const rows = [
    // [radius of the arc, how far round (degrees from straight up), size of the coils, count]
    { R: 224, span: 70, r: 30, n: 6 },
    { R: 206, span: 80, r: 30, n: 7 },
    { R: 186, span: 92, r: 29, n: 8 },
    { R: 168, span: 100, r: 27, n: 9 },
  ];
  const cx = 512, cy = 470;
  let out = '';
  rows.forEach((row, ri) => {
    for (let k = 0; k < row.n; k++) {
      const t = row.n === 1 ? 0.5 : k / (row.n - 1);
      const deg = -row.span + 2 * row.span * t + (ri % 2 ? 4 : -4);
      const a = ((deg - 90) * Math.PI) / 180;
      const x = cx + Math.cos(a) * row.R * 1.04;
      const y = cy + Math.sin(a) * row.R * 0.98;
      const r = row.r * (0.9 + rnd() * 0.22);
      out += coil(x, y, r, k % 2 ? 1 : -1, rnd() * Math.PI * 2);
    }
  });
  return out;
}

/** Her hair behind her head: its shape, and springs falling from it. */
function backSvg() {
  // the mass of it behind her head, round her face, to her shoulders
  const blobs = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (Math.PI * k) / 16;
    blobs.push([512 + Math.cos(a) * 226, 470 + Math.sin(a) * 226, 44]);
  }
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) blobs.push([512 + side * (226 - k * 10), 500 + k * 40, 40]);
  let out = '';
  for (const [x, y, r] of blobs) out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="${INK * 2}"/>`;
  out += `<path d="M288 470 Q288 250 512 244 Q736 250 736 470 L720 640 L304 640 Z" fill="${C.back}"/>`;
  for (const [x, y, r] of blobs) out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.back}"/>`;
  // coils round the back of her head
  const rnd = rng(3);
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI + (Math.PI * k) / 12;
    out += coil(512 + Math.cos(a) * 214, 470 + Math.sin(a) * 214, 32 + rnd() * 6, k % 2 ? 1 : -1, rnd() * 6);
  }
  out += drawSprings(backSprings(), 0.85);
  return DEFS + out;
}

/** Her hair in front: the coils on top of her head and the springs by her face. */
function frontSvg() {
  return DEFS + topCoils() + drawSprings(frontSprings());
}

function curlySvg() {
  return { back: backSvg(), front: frontSvg() };
}

module.exports = { curlySvg };

/**
 * Her head: a chibi skull turned from the profile of the flat princess's face (wide round
 * cheeks, a small chin), a neck, little ears, a button nose and a blush on each cheek. All the
 * faces, hair and crowns sit on this one skull, so `headFront` tells the other pieces where its
 * surface is.
 */
import * as T from 'three';
import { ellipsoid, finish, material, mesh, pair, SKIN, spun, W } from './lib.mjs';

/**
 * The skull is a formula, not a list of measures: an egg 334 wide and 347 tall (as the face on
 * head-light.webp), narrowing smoothly towards a small chin. Built from measured widths it had
 * a flat ring at every measure, and the light drew them across her face as waves.
 */
const SK = { cx: W / 2, cy: 466.5, rx: 167, ry: 173.5 };
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** How much narrower than the egg the face is at height y: only her jaw and chin. */
const taper = (y) => 1 - 0.3 * smoothstep(555, 655, y);
export const HEAD = {
  cx: SK.cx,
  top: SK.cy - SK.ry,
  chin: SK.cy + SK.ry,
  depth: 0.96,
  /** The half-width of her skull at height y. */
  r: (y) => {
    const c = (SK.cy - y) / SK.ry;
    return c >= 1 || c <= -1 ? 0 : SK.rx * taper(y) * Math.sqrt(1 - c * c);
  },
};
/** How far forward the skull's surface is at (x, y); -Infinity off it. */
export function headFront(x, y) {
  const r = HEAD.r(y);
  const dx = x - HEAD.cx;
  if (r <= 0 || Math.abs(dx) >= r) return -Infinity;
  return Math.sqrt(r * r - dx * dx) * HEAD.depth;
}
export const BLUSH = material('Blush', '#f3909b', { roughness: 0.75 });

export function head() {
  const root = new T.Group();
  // a fine sphere bent into her skull point by point, so it stays perfectly smooth
  const ball = new T.SphereGeometry(1, 96, 72);
  const p = ball.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const cos = p.getY(i);
    const y = SK.cy - SK.ry * cos;
    const k = SK.rx * taper(y);
    p.setXYZ(i, SK.cx + p.getX(i) * k, -y, p.getZ(i) * k * HEAD.depth);
  }
  mesh(finish(ball, 0.0001), SKIN(), 'skull', root);
  // the neck, from inside the skull down into the dress
  mesh(spun([[590, 40], [640, 38], [700, 40]], { rings: 6, sides: 24, depth: 0.9 }), SKIN(), 'neck', root);
  // ears, half sunk into the sides of the skull
  mesh(pair(ellipsoid(HEAD.cx - 166, 540, -8, 20, 30, 14, 20)), SKIN(), 'ears', root);
  // a button nose
  mesh(ellipsoid(HEAD.cx, 535, headFront(HEAD.cx, 535) - 2, 9, 7, 9, 16), SKIN(), 'nose', root);
  // a blush on each cheek, lying on the skin
  const blush = (x) => {
    const g = ellipsoid(x, 550, 0, 36, 19, 6, 20);
    g.translate(0, 0, headFront(x, 550) - 3);
    return g;
  };
  mesh(pair(blush(HEAD.cx - 88)), BLUSH, 'blush', root);
  return root;
}

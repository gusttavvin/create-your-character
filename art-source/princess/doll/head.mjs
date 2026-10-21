/**
 * Her head: a chibi skull turned from the profile of the flat princess's face (wide round
 * cheeks, a small chin), a neck, little ears, a button nose and a blush on each cheek. All the
 * faces, hair and crowns sit on this one skull, so `headFront` tells the other pieces where its
 * surface is.
 */
import * as T from 'three';
import { curve, ellipsoid, material, mesh, pair, SKIN, spun, W } from './lib.mjs';

export const HEAD = {
  cx: W / 2,
  top: 293,
  chin: 640,
  depth: 0.96,
  // half-width of the skull at each y (measured on head-light.webp, ears left out)
  r: curve([[293, 0], [297, 34], [306, 70], [320, 98], [345, 128], [390, 151], [440, 163], [490, 167], [530, 162], [565, 142], [595, 108], [618, 66], [634, 28], [640, 0]]),
};
/** How far forward the skull's surface is at (x, y); -Infinity off it. */
export function headFront(x, y) {
  const r = HEAD.r(y);
  const dx = x - HEAD.cx;
  if (r <= 0 || Math.abs(dx) >= r) return -Infinity;
  return Math.sqrt(r * r - dx * dx) * HEAD.depth;
}
export const BLUSH = material('Blush', '#f7a3a8', { roughness: 0.7 });

export function head() {
  const root = new T.Group();
  const knots = [];
  for (let y = HEAD.top; y <= HEAD.chin; y += 4) knots.push([y, HEAD.r(y)]);
  mesh(spun(knots, { depth: HEAD.depth, rings: 64, sides: 56 }), SKIN(), 'skull', root);
  // the neck, from inside the skull down into the dress
  mesh(spun([[590, 40], [640, 38], [700, 40]], { rings: 6, sides: 24, depth: 0.9 }), SKIN(), 'neck', root);
  // ears, half sunk into the sides of the skull
  mesh(pair(ellipsoid(HEAD.cx - 166, 540, -8, 20, 30, 14, 20)), SKIN(), 'ears', root);
  // a button nose
  mesh(ellipsoid(HEAD.cx, 535, headFront(HEAD.cx, 535) - 2, 9, 7, 9, 16), SKIN(), 'nose', root);
  // a blush on each cheek, lying on the skin
  const blush = (x) => {
    const g = ellipsoid(x, 548, 0, 30, 15, 5, 20);
    g.translate(0, 0, headFront(x, 548) - 2);
    return g;
  };
  mesh(pair(blush(HEAD.cx - 82)), BLUSH, 'blush', root);
  return root;
}

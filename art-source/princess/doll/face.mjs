/**
 * Her eyes and mouths, modelled: each eye a white ball sunk into the skull with a domed iris, a
 * pupil, shines (round, a star or a heart), a dark lid line with lashes, and a brow; each mouth
 * real lips, with teeth, a tongue or an open "oh" where the picture has them.
 */
import * as T from 'three';
import { ellipsoid, heart, material, merge, mesh, mirrored, plate, ring, star, sweep } from './lib.mjs';
import { headFront } from './head.mjs';

const EYE_Y = 492;
const EYE_X = 427; // her right eye (on the viewer's left); the other is its mirror
const WHITE = material('EyeWhite', '#ffffff', { roughness: 0.25 });
const INK = material('Ink', '#2a1611', { roughness: 0.6 });
const BROW = material('Brow', '#6b4226', { roughness: 0.7 });
const SHINE = material('Shine', '#ffffff', { roughness: 0.1 });
const LIP = material('Lip', '#e8626d', { roughness: 0.35 });
const MOUTH = material('MouthInside', '#6e1620', { roughness: 0.6 });
const TEETH = material('Teeth', '#fffaf4', { roughness: 0.3 });
const TONGUE = material('Tongue', '#f28a9b', { roughness: 0.45 });

const IRIS = { sparkly: '#6b3d1e', happy: '#2e55b5', wink: '#3a9a4a', sleepy: '#7a3fb5' };

/** The surface of the skull at (x, y), a little out. */
const on = (x, y, lift = 0) => headFront(x, y) + lift;

/** One open eye at (cx, cy): ball, iris, pupil, shines, lid line and lashes; everything in `eye`. */
function openEye(cx, cy, id, eye) {
  const RX = 58, RY = 50, RZ = 34;
  const front = on(cx, cy, 5);
  const z = front - RZ;
  mesh(ellipsoid(cx, cy, z, RX, RY, RZ, 28), WHITE, 'eyeball', eye);
  // the iris is a big dome on the ball, as a doll's is, the pupil a smaller dome on the iris
  mesh(ellipsoid(cx, cy + 3, front - 10, 44, 44, 13, 28), material('Iris', IRIS[id], { roughness: 0.3 }), 'iris', eye);
  mesh(ellipsoid(cx, cy + 4, front - 5, 23, 23, 9, 20), INK, 'pupil', eye);
  // shines: a big one up and outward, a small one down and inward
  const out = cx < 512 ? -1 : 1;
  if (id === 'happy') mesh(plate(star(cx + out * 10, cy - 10, 17, 7), front + 8, 3), SHINE, 'shine', eye);
  else if (id === 'sleepy') mesh(plate(heart(cx + out * 10, cy - 8, 26), front + 8, 3), SHINE, 'shine', eye);
  else mesh(ellipsoid(cx + out * 13, cy - 13, front + 4, 11, 11, 4, 16), SHINE, 'shine', eye);
  mesh(ellipsoid(cx - out * 12, cy + 15, front + 4, 5.5, 5.5, 3, 12), SHINE, 'shine2', eye);
  // the lid: a thick dark line over the top of the ball, thinner at its ends, with lashes
  const lid = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (0.06 + (0.88 * i) / 10);
    const x = cx + RX * 1.02 * Math.cos(a) * -1;
    const y = cy - RY * 1.02 * Math.sin(a);
    lid.push([x, y, on(x, y, 4) + Math.sqrt(Math.max(0, 1 - ((x - cx) / RX) ** 2 - ((y - cy) / RY) ** 2)) * RZ * 0.9]);
  }
  mesh(sweep(lid, (t) => 1.4 + 2.6 * Math.sin(t * Math.PI), (t) => 1.2 + 1.6 * Math.sin(t * Math.PI), { radial: 8 }), INK, 'lid', eye);
  // three short lashes flicking out and up from the outer corner
  const ox = cx + out * RX * 0.92;
  for (const [k, dy] of [[0, -18], [1, -8], [2, 2]]) {
    const y0 = cy - 22 + k * 6;
    const g = sweep([[ox - out * 4, y0, on(ox, y0, 6)], [ox + out * 10, y0 + dy * 0.5, on(ox, y0, 10)], [ox + out * 18, y0 + dy, on(ox, y0, 12)]], (t) => 2.6 * (1 - t) + 0.5, 1.8, { radial: 6 });
    mesh(g, INK, 'lash' + k, eye);
  }
}

/** A closed, winking eye: a curved lid line with lashes. */
function shutEye(cx, cy, eye) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = cx - 50 + 100 * t;
    const y = cy + 8 - 22 * Math.sin(t * Math.PI);
    pts.push([x, y, on(x, y, 5)]);
  }
  mesh(sweep(pts, (t) => 2.5 + 4 * Math.sin(t * Math.PI), 3, { radial: 8 }), INK, 'lid', eye);
  const out = cx < 512 ? -1 : 1;
  const ox = cx + out * 48;
  for (const [k, dy] of [[0, -10], [1, 4], [2, 16]]) {
    const y0 = cy + 2 + k * 4;
    mesh(sweep([[ox, y0, on(ox, y0, 6)], [ox + out * 18, y0 + dy, on(ox, y0, 10)]], (t) => 3 * (1 - t) + 0.6, 2, { radial: 6 }), INK, 'lash' + k, eye);
  }
}

function brow(cx, id) {
  // a thin arch well above the eye, its outer end a little higher than its inner end
  const y = id === 'wink' ? 390 : 396;
  const out = cx < 512 ? -1 : 1;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = cx - out * 36 + out * 80 * t;
    const yy = y - 11 * Math.sin(t * Math.PI) - 3 * t;
    pts.push([x, yy, on(x, yy, 4)]);
  }
  return sweep(pts, (t) => 1.3 + 2.2 * Math.sin(t * Math.PI * 0.8), 1.5, { radial: 8 });
}

/**
 * Turns an eye's parts to lie along the skull where the eye sits: built facing straight
 * forward, the outer edge of a ball stood out of the cheek, since the skull curves away there.
 */
function tilt(eye, cx, cy) {
  const front = on(cx, cy, 5);
  const angle = Math.atan2(cx - 512, front);
  for (const m of eye.children) {
    m.geometry.translate(-cx, cy, -(front - 12));
    m.geometry.rotateY(angle);
    m.geometry.translate(cx, -cy, front - 12);
  }
}

export function eyes(id) {
  const root = new T.Group();
  const group = new T.Group();
  group.name = 'Eyes';
  root.add(group);
  const left = new T.Group();
  openEye(EYE_X, EYE_Y, id, left);
  tilt(left, EYE_X, EYE_Y);
  for (const m of left.children) mesh(m.geometry, m.material, m.name, group);
  if (id === 'wink') shutEye(1024 - EYE_X, EYE_Y, group);
  else {
    // the other eye is the mirror of this one
    for (const m of left.children) mesh(mirrored(m.geometry), m.material, m.name + 'R', group);
  }
  mesh(merge([brow(EYE_X, id), mirrored(brow(EYE_X, id))]), BROW, 'brows', root);
  return root;
}

/* ------------------------------------------------------------------ mouths */
const MX = 511;
/** A smiling pair of lips: a plump lower lip under a thinner upper one. */
function smileLips(root, wide = 38, deep = 22, y = 564) {
  const lower = [];
  const upper = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = MX - wide + 2 * wide * t;
    const yy = y + deep * Math.sin(t * Math.PI);
    lower.push([x, yy + 3, on(x, yy, 3)]);
    upper.push([x, yy - 5, on(x, yy, 3)]);
  }
  mesh(sweep(lower, (t) => 3 + 7 * Math.sin(t * Math.PI), (t) => 2 + 4 * Math.sin(t * Math.PI), { radial: 10 }), LIP, 'lowerlip', root);
  mesh(sweep(upper, (t) => 2 + 3.5 * Math.sin(t * Math.PI), 2.5, { radial: 8 }), LIP, 'upperlip', root);
  // a glint of teeth between the lips
  mesh(ellipsoid(MX, y + deep * 0.55, on(MX, y + 10, 2), wide * 0.5, 4, 3, 12), TEETH, 'teeth', root);
}
export function mouth(id) {
  const root = new T.Group();
  if (id === 'smile') smileLips(root);
  else if (id === 'tongue') {
    smileLips(root);
    mesh(ellipsoid(MX, 596, on(MX, 596, 2), 15, 19, 9, 20), TONGUE, 'tongue', root);
  } else if (id === 'laugh') {
    const cy = 576;
    mesh(ellipsoid(MX, cy, on(MX, cy, -4), 36, 23, 10, 24), MOUTH, 'inside', root);
    mesh(ellipsoid(MX, cy - 13, on(MX, cy, 2), 28, 7, 5, 16), TEETH, 'teeth', root);
    mesh(ellipsoid(MX, cy + 13, on(MX, cy, 1), 18, 9, 6, 16), TONGUE, 'tongue', root);
    // lips round the opening, the lower one fuller
    const lips = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = MX + 38 * Math.cos(a);
      const yy = cy + 25 * Math.sin(a);
      lips.push([x, yy, on(x, yy, 4)]);
    }
    mesh(sweep(lips, (t) => 4 + 3 * Math.max(0, Math.sin(t * Math.PI * 2)), 3.5, { radial: 8, round: false }), LIP, 'lips', root);
  } else if (id === 'oh') {
    const cy = 578;
    mesh(ellipsoid(MX, cy, on(MX, cy, -3), 15, 19, 6, 20), MOUTH, 'inside', root);
    const g = ring(MX, cy, on(MX, cy, 3), 17, 6, [0, 0, 0], Math.PI * 2, 32);
    g.scale(1, 1.2, 1);
    g.translate(0, cy * 0.2, 0);
    mesh(g, LIP, 'lips', root);
  }
  return root;
}

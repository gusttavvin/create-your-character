/**
 * Her eyes and mouths, modelled: each eye a white ball sunk into the skull with a domed iris, a
 * pupil, shines (round, a star or a heart), a dark lid line with lashes, and a brow; each mouth
 * real lips, with teeth, a tongue or an open "oh" where the picture has them.
 */
import * as T from 'three';
import { ellipsoid, heart, material, merge, mesh, mirrored, plate, ring, SKIN, star, sweep } from './lib.mjs';
import { headFront } from './head.mjs';

const EYE_Y = 492;
const EYE_X = 427; // her right eye (on the viewer's left); the other is its mirror
const WHITE = material('EyeWhite', '#ffffff', { roughness: 0.25 });
const INK = material('Ink', '#2a1611', { roughness: 0.6 });
const BROW = material('Brow', '#6b4226', { roughness: 0.7 });
const SHINE = material('Shine', '#ffffff', { roughness: 0.1 });
const LIP = material('Lip', '#e8626d', { roughness: 0.3, gloss: 0.8 });
const MOUTH = material('MouthInside', '#6e1620', { roughness: 0.6 });
const TEETH = material('Teeth', '#fffaf4', { roughness: 0.3 });
const TONGUE = material('Tongue', '#f28a9b', { roughness: 0.45 });

const IRIS = { sparkly: '#6b3d1e', happy: '#2e55b5', wink: '#3a9a4a', sleepy: '#7a3fb5' };
const LIGHT = { sparkly: '#b5733a', happy: '#6f9ae8', wink: '#7fd08a', sleepy: '#b98ae6' };
const IRIS_RIM = { sparkly: '#3a1f0e', happy: '#16306e', wink: '#1d5226', sleepy: '#40206a' };

/** The surface of the skull at (x, y), a little out. */
const on = (x, y, lift = 0) => headFront(x, y) + lift;

/**
 * A soft dome lying on a surface: an oval (cx, cy, rx, ry) whose middle swells `h` above
 * `below(x, y)` and whose rim lies on it; closed behind, 2 px under it. The parts of the eye
 * are layered this way, each on the one beneath, so the eye is exactly the drawn oval, sitting
 * on her face (a ball half sunk into the skull showed less white than drawn, and the lid line
 * and lashes drawn round the oval floated beside it).
 */
function dome(cx, cy, rx, ry, h, below, { rings = 10, sides = 44, p = 0.5 } = {}) {
  const pos = [];
  const idx = [];
  const row = sides + 1;
  for (const front of [true, false])
    for (let r = 0; r <= rings; r++) {
      const rho = r / rings;
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const x = cx + rx * rho * Math.cos(a);
        const y = cy + ry * rho * Math.sin(a);
        const z = below(x, y) + (front ? h * Math.pow(Math.max(0, 1 - rho * rho), p) : -2);
        pos.push(x, -y, z);
      }
    }
  const back = row * (rings + 1);
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < sides; s++) {
      const a = r * row + s;
      const b = a + row;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
      idx.push(back + a, back + b, back + a + 1, back + a + 1, back + b, back + b + 1);
    }
  // the rim, front to back
  for (let s = 0; s < sides; s++) {
    const a = rings * row + s;
    idx.push(a, back + a, a + 1, a + 1, back + a, back + a + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, top: (x, y) => {
    const u = (x - cx) / rx;
    const v = (y - cy) / ry;
    return below(x, y) + h * Math.pow(Math.max(0, 1 - u * u - v * v), p);
  } };
}

/** One open eye at (cx, cy): white, iris, pupil, shines, lid line and lashes; everything in `eye`. */
function openEye(cx, cy, id, eye) {
  const RX = 54, RY = 47;
  const skin = (x, y) => on(x, y, 0.5);
  // the white of the eye, swelling a little out of her face
  const white = dome(cx, cy, RX, RY, 10, skin);
  mesh(white.geo, WHITE, 'eyeball', eye);
  // the iris: a dark rim, then the colour, a lighter crescent low down, the pupil
  const rim = dome(cx, cy + 3, 40, 40, 2.5, (x, y) => white.top(x, y) + 0.4);
  mesh(rim.geo, material('IrisRim', IRIS_RIM[id], { roughness: 0.2, gloss: 1 }), 'irisrim', eye);
  const iris = dome(cx, cy + 3, 35, 35, 2, (x, y) => rim.top(x, y) + 0.3);
  mesh(iris.geo, material('Iris', IRIS[id], { roughness: 0.2, gloss: 1 }), 'iris', eye);
  const light = dome(cx, cy + 20, 22, 11, 1, (x, y) => iris.top(x, y) + 0.3);
  mesh(light.geo, material('IrisLight', LIGHT[id], { roughness: 0.2, gloss: 1 }), 'irislight', eye);
  const pupil = dome(cx, cy + 4, 18, 18, 1.5, (x, y) => iris.top(x, y) + 0.4);
  mesh(pupil.geo, INK, 'pupil', eye);
  // shines: a big one up and outward, a small one down and inward
  const out = cx < 512 ? -1 : 1;
  // a star or a heart is a thin plate: laid against the eye, turned as her face turns there
  // (facing straight forward it stood out past the eye's edge when seen from the side)
  const flat = (shape, sx, sy) => {
    const g = plate(shape, 0, 1.6);
    g.translate(-sx, sy, 0);
    g.rotateY(Math.atan2(sx - 512, on(sx, sy, 0)));
    g.translate(sx, -sy, pupil.top(sx, sy) + 1.4);
    return g;
  };
  if (id === 'happy') mesh(flat(star(cx + out * 10, cy - 10, 16, 7), cx + out * 10, cy - 10), SHINE, 'shine', eye);
  else if (id === 'sleepy') mesh(flat(heart(cx + out * 10, cy - 8, 24), cx + out * 10, cy - 8), SHINE, 'shine', eye);
  else mesh(dome(cx + out * 13, cy - 12, 10, 10, 2, (x, y) => pupil.top(x, y) + 0.6).geo, SHINE, 'shine', eye);
  mesh(dome(cx - out * 12, cy + 15, 5, 5, 1.5, (x, y) => iris.top(x, y) + 1).geo, SHINE, 'shine2', eye);
  // the lid: a dark line lying along the top edge of the white, thickest in the middle
  const lid = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (1.04 + (0.92 * i) / 14);
    const x = cx + RX * Math.cos(a);
    const y = cy + RY * Math.sin(a);
    lid.push([x, y, white.top(x, y) + 1.5]);
  }
  mesh(sweep(lid, (t) => 1.8 + 3 * Math.sin(t * Math.PI), (t) => 1.6 + 1.8 * Math.sin(t * Math.PI), { radial: 8 }), INK, 'lid', eye);
  // three short lashes flicking out and up from the outer end of the lid
  const end = lid[out < 0 ? 0 : lid.length - 1];
  for (const [k, ang] of [[0, -1.0], [1, -0.55], [2, -0.12]]) {
    const dx = Math.cos(ang) * out;
    const dy = Math.sin(ang);
    const y0 = end[1] + k * 3;
    const g = sweep(
      [[end[0] - out * 2, y0, end[2]], [end[0] + dx * 9, y0 + dy * 9, on(end[0] + dx * 9, y0 + dy * 9, 3)], [end[0] + dx * 17, y0 + dy * 17, on(end[0] + dx * 17, y0 + dy * 17, 4)]],
      (t) => 2.6 * (1 - t) + 0.5, 1.8, { radial: 6 },
    );
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
  // (each part lies on her face already, so the eye is not turned to the skull any more)
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
/**
 * Her mouths are sculpted, not drawn: each lip is a soft cushion lying on her face, shaped by
 * its top and bottom edges and how far it swells out; an open mouth is a hollow sunk into her
 * face with teeth and a tongue inside it. Everything follows the curve of her face.
 */
const MX = 511;

/**
 * A cushion on her face between two edges: x = MX + w * u for u from -1 to 1, the top edge at
 * top(u) and the bottom edge at bot(u) (sheet pixels, y down), swelling out by lift(u) in the
 * middle (a negative lift is a hollow). Closed behind, inside her skin, so it is a solid.
 */
function cushion(w, top, bot, lift, { us = 28, vs = 10, base = 1, round = 0.75 } = {}) {
  const pos = [];
  const idx = [];
  const row = us + 1;
  const point = (i, j, front) => {
    const u = -1 + (2 * i) / us;
    const v = j / vs;
    const x = MX + w * u;
    const y = top(u) + (bot(u) - top(u)) * v;
    const swell = Math.pow(Math.sin(Math.PI * v), round) * lift(u);
    const z = on(x, y, base) + (front ? swell : -2);
    return [x, -y, z];
  };
  for (const front of [true, false])
    for (let j = 0; j <= vs; j++) for (let i = 0; i <= us; i++) pos.push(...point(i, j, front));
  const back = row * (vs + 1);
  for (let j = 0; j < vs; j++)
    for (let i = 0; i < us; i++) {
      const a = j * row + i;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
      idx.push(back + a, back + a + 1, back + b, back + a + 1, back + b + 1, back + b);
    }
  // the rim, joining front and back all round
  const rim = [];
  for (let i = 0; i <= us; i++) rim.push(i);
  for (let j = 1; j <= vs; j++) rim.push(j * row + us);
  for (let i = us - 1; i >= 0; i--) rim.push(vs * row + i);
  for (let j = vs - 1; j >= 1; j--) rim.push(j * row);
  for (let k = 0; k < rim.length; k++) {
    const a = rim[k];
    const b = rim[(k + 1) % rim.length];
    idx.push(a, b, back + a, b, back + b, back + a);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the swell can face either way depending on the edges: keep the faces pointing out
  return g;
}

const bump = (u, p = 1) => Math.pow(Math.max(0, 1 - u * u), p);
/** Her lips' parting: a smile, the corners up. */
const smileLine = (u) => 571 - 9 * u * u;

/** Closed smiling lips: a bowed upper lip and a fuller lower lip, a soft line between. */
function smileLips(root, { lower = 1 } = {}) {
  const w = 31;
  // the upper lip: thin at the corners, a cupid's bow dipping in the middle
  const upTop = (u) => smileLine(u) - (2 + 9 * bump(u, 0.7)) + 4 * Math.exp(-((u / 0.16) ** 2)) * bump(u);
  mesh(cushion(w, upTop, (u) => smileLine(u) + 0.5, (u) => 2 + 5 * bump(u, 0.8), { base: 1 }), LIP, 'upperlip', root);
  // the lower lip: fuller, swelling out further
  const lowBot = (u) => smileLine(u) + (2 + 12 * lower * bump(u, 0.8));
  mesh(cushion(w * 0.92, (u) => smileLine(u) - 0.5, lowBot, (u) => 2.5 + 8 * lower * bump(u, 0.9), { base: 1 }), LIP, 'lowerlip', root);
  // the parting, a fine darker line where the lips meet
  const seam = [];
  for (let i = 0; i <= 14; i++) {
    const u = -1 + (2 * i) / 14;
    const x = MX + w * 0.98 * u;
    const y = smileLine(u);
    seam.push([x, y, on(x, y, 3 + 3 * bump(u))]);
  }
  mesh(sweep(seam, 1.3, 1.3, { radial: 6 }), material('LipLine', '#a8303f', { roughness: 0.5 }), 'parting', root);
}

/** An open mouth: lips round a hollow sunk into her face, with what is inside. */
function openMouth(root, { w, top, bot, teeth = true, tongue = 0.6, lipUp = 6, lipLow = 8 }) {
  // the hollow, deep and dark
  mesh(cushion(w, top, bot, () => 0.3, { base: 0.4, round: 0.3 }), MOUTH, 'inside', root);
  // the upper teeth, a white band along the top of the opening
  if (teeth) {
    const tBot = (u) => top(u) + 7 * bump(u, 0.5);
    mesh(cushion(w * 0.78, (u) => top(u) + 0.5, tBot, () => 1.5, { base: 1 }), TEETH, 'teeth', root);
  }
  // the tongue, a soft mound rising from the bottom of the hollow
  if (tongue) {
    const h = (u) => bot(u) - top(u);
    mesh(cushion(w * 0.62, (u) => bot(u) - h(u) * tongue, (u) => bot(u) - 1, () => 3, { base: 1, round: 0.5 }), TONGUE, 'tongue', root);
  }
  // the lips framing it: a cushion along the top edge and a fuller one along the bottom
  mesh(cushion(w + 3, (u) => top(u) - lipUp * bump(u, 0.6) - 1.5, (u) => top(u) + 1.5, (u) => 2 + 4 * bump(u, 0.7)), LIP, 'upperlip', root);
  mesh(cushion(w + 3, (u) => bot(u) - 1.5, (u) => bot(u) + lipLow * bump(u, 0.6) + 1.5, (u) => 2 + 6 * bump(u, 0.7)), LIP, 'lowerlip', root);
}

export function mouth(id) {
  const root = new T.Group();
  if (id === 'smile') smileLips(root);
  else if (id === 'tongue') {
    smileLips(root, { lower: 0.8 });
    // the tip of her tongue poking out over her lower lip, with a groove down its middle
    const tip = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const y = 574 + 26 * t;
      tip.push([MX + 2, y, on(MX, y, 6 + 10 * Math.sin(t * Math.PI * 0.8))]);
    }
    mesh(sweep(tip, (t) => 13 - 2 * t, (t) => 6 - t, { radial: 14 }), TONGUE, 'tongue', root);
    mesh(sweep(tip.slice(1, 5).map(([x, y, z]) => [x, y, z + 5.5]), 1.2, 1, { radial: 6 }), material('TongueLine', '#d86a7e'), 'tongueline', root);
  } else if (id === 'laugh') {
    // a big happy D: flat-ish along the top, round below
    openMouth(root, {
      w: 30,
      top: (u) => 566 - 5 * u * u,
      bot: (u) => 566 - 5 * u * u + 30 * bump(u, 0.55),
      tongue: 0.5,
    });
  } else if (id === 'oh') {
    // a small round "oh"
    openMouth(root, {
      w: 14,
      top: (u) => 578 - 16 * bump(u, 0.5),
      bot: (u) => 578 + 18 * bump(u, 0.5),
      teeth: false,
      tongue: 0.35,
      lipUp: 5,
      lipLow: 6,
    });
  }
  return root;
}

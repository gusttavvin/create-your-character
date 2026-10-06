/**
 * Measures the modelled monster, so the built pieces can be given his proportions.
 *
 *   node art-source/approved/read-model.cjs
 *
 * Clara sent one sculpted monster, `public/models/monstrinho.glb`, and asked for the other
 * pieces to be like him. His shapes cannot be copied — the file holds one of each, and they
 * are his own — but what is BEHIND them can be read off and used: how deep he is for his
 * width, part by part. That one number is exactly what the builder needs, because a piece
 * built from a drawing swells by its own thickness times a factor, and that factor IS the
 * depth-to-width the model is asking for.
 *
 * It reads the glTF JSON chunk only: every accessor carries the min and max of what it holds,
 * so the boxes are in the file without decoding a single vertex.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'public', 'models', 'monstrinho.glb');
const buf = fs.readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb');
const jsonLength = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + jsonLength).toString('utf8'));

/** The node's own transform, as a 4x4 in column-major order, like three.js keeps them. */
function localMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** The box a subtree fills, in the model's own metres. */
function boxOf(index, parent, into) {
  const node = gltf.nodes[index];
  const world = multiply(parent, localMatrix(node));
  if (node.mesh !== undefined) {
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      if (!acc || !acc.min) continue;
      // the eight corners, because a rotated node turns the box
      for (let c = 0; c < 8; c++) {
        const p = apply(world, [
          c & 1 ? acc.max[0] : acc.min[0],
          c & 2 ? acc.max[1] : acc.min[1],
          c & 4 ? acc.max[2] : acc.min[2],
        ]);
        for (let k = 0; k < 3; k++) {
          into.min[k] = Math.min(into.min[k], p[k]);
          into.max[k] = Math.max(into.max[k], p[k]);
        }
      }
    }
  }
  for (const child of node.children || []) boxOf(child, world, into);
  return into;
}

const byName = new Map();
gltf.nodes.forEach((n, i) => {
  if (n.name && !byName.has(n.name)) byName.set(n.name, i);
});

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** The transform above a node, so a part measures where it really stands. */
function parentOf(index) {
  const up = new Map();
  gltf.nodes.forEach((n, i) => (n.children || []).forEach((c) => up.set(c, i)));
  let m = IDENTITY;
  const chain = [];
  for (let i = up.get(index); i !== undefined; i = up.get(i)) chain.unshift(i);
  for (const i of chain) m = multiply(m, localMatrix(gltf.nodes[i]));
  return m;
}

function measure(name) {
  const i = byName.get(name);
  if (i === undefined) return null;
  const box = boxOf(i, parentOf(i), { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  if (!Number.isFinite(box.min[0])) return null;
  const size = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
  return { name, size, min: box.min, max: box.max };
}

/**
 * The parts worth measuring, and what each one tells the builder.
 *
 * A limb is a tube: how deep it is against how thick it is across says how round to make a
 * built one. A body is a mound: how deep against how wide. A face piece lies on the body, so
 * what matters is how far it stands off it.
 */
const PARTS = ['Modelo', 'Corpo', 'Juba', 'Rosto', 'Olhos', 'Olho_E', 'Sobrancelhas', 'Boca', 'Braco_E', 'Mao_E', 'Braco_D', 'Pernas', 'Perna_E', 'Pe_E', 'Chifres', 'Bochechas'];
const r3 = (n) => Math.round(n * 1000) / 1000;

console.log('monstrinho.glb, measured in the model\'s own metres\n');
console.log('part            width   height  depth   depth/width  depth/thin');
const found = {};
for (const name of PARTS) {
  const m = measure(name);
  if (!m) continue;
  found[name] = m;
  const [w, h, d] = m.size;
  const thin = Math.min(w, h);
  console.log(
    name.padEnd(15),
    String(r3(w)).padEnd(7),
    String(r3(h)).padEnd(7),
    String(r3(d)).padEnd(7),
    String(r3(d / w)).padEnd(12),
    r3(d / thin),
  );
}

console.log('\nwhat the builder should take from this:');
const body = found.Corpo;
const arm = found.Braco_E;
const leg = found.Perna_E;
const eye = found.Olho_E;
const mouth = found.Boca;
const line = (what, value, why) => console.log(`  ${what.padEnd(22)} ${String(r3(value)).padEnd(7)} ${why}`);
if (body) line('ROUND.body', body.size[2] / Math.min(body.size[0], body.size[1]), 'his body is this deep for its width');
if (arm) line('ROUND.arms', arm.size[2] / Math.min(arm.size[0], arm.size[1]), 'his arm is this deep for its thickness');
if (leg) line('ROUND.legs', leg.size[2] / Math.min(leg.size[0], leg.size[1]), 'his leg, the same way');
if (eye) line('ROUND.eyes', eye.size[2] / Math.min(eye.size[0], eye.size[1]), 'one of his eyes, on its own');
if (mouth) line('ROUND.mouth', mouth.size[2] / Math.min(mouth.size[0], mouth.size[1]), 'his mouth is a shallow dish');
if (body && found.Rosto) {
  const stand = found.Rosto.max[2] - body.max[2];
  line('face stand-off', stand / body.size[0], "how far his face stands off the body, as a share of its width");
}
if (body && found.Bochechas) {
  const relief = found.Bochechas.max[2] - found.Rosto.max[2];
  line('marking relief', relief / Math.min(body.size[0], body.size[1]), 'how proud a cheek sits on the skin');
}
if (body && found.Modelo) line('body / whole', body.size[0] / found.Modelo.size[0], 'his body against his full span');

/* ------------------------------------------------- the table the game reads */
/**
 * Where each of his pieces is, so any body can wear it.
 *
 * Clara asked for his modelled pieces to be usable on every body, not only on his own. To put
 * one on a square monster the game has to know how big it is and where its middle sits, and
 * those are measured here once rather than in the browser on every render.
 */
const ROWS = {
  body: ['Corpo', 'Juba', 'Rosto', 'Bochechas', 'Pintinhas', 'Chifres', 'Topete'],
  eyes: ['Olhos', 'Sobrancelhas'],
  mouth: ['Boca'],
  arms: ['Braco_E', 'Braco_D'],
  legs: ['Pernas'],
};

const rows = {};
for (const [row, groups] of Object.entries(ROWS)) {
  const parts = groups.map(measure).filter(Boolean);
  if (!parts.length) continue;
  const min = [0, 1, 2].map((k) => Math.min(...parts.map((p) => p.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...parts.map((p) => p.max[k])));
  const entry = { groups, min: min.map(r3), max: max.map(r3) };
  if (row === 'arms') {
    // the hole the pair leaves for the body, the same measurement the drawn arms carry
    const left = measure('Braco_E');
    const right = measure('Braco_D');
    const a = Math.min(left.max[0], right.max[0]);
    const b = Math.max(left.min[0], right.min[0]);
    entry.gap = r3(b - a);
    entry.mid = r3((a + b) / 2);
  }
  rows[row] = entry;
}

const ts = `/**
 * Every piece of the modelled monster, measured.
 *
 * GENERATED by art-source/approved/read-model.cjs from public/models/monstrinho.glb. His
 * pieces can be worn by any body, and to place one the game needs its size and its middle in
 * the model's own metres. Run that script again if the model is replaced.
 */
export interface ModelRow {
  /** The named groups of the GLB this row switches on. */
  groups: string[];
  /** The box it fills, in the model's own metres — Y up, feet at nought, facing +Z. */
  min: [number, number, number];
  max: [number, number, number];
  /** Arms only: the hole between the two of them, and where its middle sits across. */
  gap?: number;
  mid?: number;
}

export const MONSTRINHO_ROWS: Record<string, ModelRow> = ${JSON.stringify(rows, null, 2)
  .replace(/"([a-z]+)":/g, '$1:')
  .replace(/"/g, "'")};
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'monstrinho-rows.ts'), ts);
console.log('\nsrc/components/monstrinho-rows.ts written');
for (const [row, e] of Object.entries(rows)) {
  console.log(` ${row.padEnd(6)} ${e.groups.join('+').padEnd(38)} ${(e.max[0] - e.min[0]).toFixed(3)} x ${(e.max[1] - e.min[1]).toFixed(3)} x ${(e.max[2] - e.min[2]).toFixed(3)}${e.gap ? `  hole ${e.gap}` : ''}`);
}

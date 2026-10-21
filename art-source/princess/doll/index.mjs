/**
 * Models the princess as a doll, piece by piece, the way the dragon is modelled: real solids
 * with their own colours, designed from Clara's doll pictures (../reference/v2) and laid out on
 * the flat princess's sheet so every piece lands where the 2D has it.
 *
 *   npm run models:princess            all the pieces
 *   node art-source/princess/doll/index.mjs head eyes mouth dress hair   (only some rows)
 *
 * Writes public/models/princess/<row>-<id>.glb (head.glb for the one head),
 * src/characters/princess/model-library.json (what each file holds) and
 * docs/princess-model-validation.json (the glTF validator's report).
 *
 * Pieces: head.mjs (skull, neck, ears, nose, blush); face.mjs (eyes with brows, mouths);
 * dress.mjs (bodice, sleeves, arms and hands, skirts, legs and shoes, trims and gems);
 * hair.mjs (cap and strands, braid, curls, bun; the tiara and earrings come with the hair).
 * lib.mjs has the shapes. Coordinates are the sheet's pixels, turned to metres at the end.
 */
import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import validator from 'gltf-validator';
import { toMetres, UNIT } from './lib.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:' + b.type + ';base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); }); }
};

const OUT = new URL('../../../public/models/princess/', import.meta.url);
const LIBRARY = new URL('../../../src/characters/princess/model-library.json', import.meta.url);
const REPORT = new URL('../../../docs/princess-model-validation.json', import.meta.url);
await fs.mkdir(OUT, { recursive: true });

const IDS = {
  head: [''],
  eyes: ['sparkly', 'happy', 'wink', 'sleepy'],
  mouth: ['smile', 'laugh', 'oh', 'tongue'],
  dress: ['gown', 'aline', 'mermaid', 'star'],
  hair: ['braids', 'long', 'curly', 'bun'],
};
const rows = process.argv.slice(2).filter((a) => IDS[a]);
const todo = rows.length ? rows : Object.keys(IDS);

async function builder(row) {
  if (row === 'head') return (await import('./head.mjs')).head;
  if (row === 'eyes') return (await import('./face.mjs')).eyes;
  if (row === 'mouth') return (await import('./face.mjs')).mouth;
  if (row === 'dress') return (await import('./dress.mjs')).dress;
  return (await import('./hair.mjs')).hair;
}

let catalogue = { unit: UNIT, pieces: {} };
let reports = [];
try { catalogue = JSON.parse(await fs.readFile(LIBRARY, 'utf8')); } catch {}
try { reports = JSON.parse(await fs.readFile(REPORT, 'utf8')); } catch {}
catalogue.unit = UNIT;
// pieces of the old, picture-based library are dropped
for (const key of Object.keys(catalogue.pieces)) if (/^head:/.test(key)) delete catalogue.pieces[key];

for (const row of todo) {
  const build = await builder(row);
  for (const id of IDS[row]) {
    const name = id ? row + '-' + id : row;
    const root = build(id);
    root.name = id ? row + '_' + id : row;
    toMetres(root);
    const data = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });
    await fs.writeFile(new URL(name + '.glb', OUT), Buffer.from(data));
    const v = await validator.validateBytes(new Uint8Array(data), { maxIssues: 20 });
    let tris = 0;
    root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
    const report = { piece: name, bytes: data.byteLength, triangles: Math.round(tris), errors: v.issues.numErrors, warnings: v.issues.numWarnings };
    reports = reports.filter((r) => r.piece !== name).concat(report);
    if (v.issues.numErrors) throw new Error(name + ': ' + JSON.stringify(v.issues.messages.slice(0, 5)));
    catalogue.pieces[id ? row + ':' + id : row] = { url: 'models/princess/' + name + '.glb', group: root.name };
    console.log(name.padEnd(16), String(data.byteLength).padStart(9), String(Math.round(tris)).padStart(7), v.issues.numWarnings ? v.issues.numWarnings + ' warnings' : '');
  }
}
reports.sort((a, b) => a.piece.localeCompare(b.piece));
await fs.writeFile(LIBRARY, JSON.stringify(catalogue));
await fs.writeFile(REPORT, JSON.stringify(reports, null, 2));

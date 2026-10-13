import * as THREE from 'three';
import { browsFile, CANVAS, filesOf, hairBack, hairFront, headFile, type SkinTone } from './pieces';
import { ball, G, loadImage, loft, maskOf, newCanvas, NX, sheet, stack, textureOf, U, type Mask, type Relief } from './relief';

/**
 * The approved artwork is the UV layout, in its original 1024 × 1536 coordinates.
 * Closed front/back surfaces retain the artwork's silhouette, with local depth for the
 * head, sleeves, arms and skirt. No redraw of the face or costume is involved.
 * Dimensions below are pixels in that layout; the final meshes are in metres, Y up, +Z front.
 */
export interface PortraitChoice {
  tone: SkinTone;
  dress: string | null;
  hair: string | null;
  eyes: string | null;
  mouth: string | null;
}

export interface PortraitModel {
  root: THREE.Group;
  eyes: THREE.Group | null;
  dispose(): void;
}

type Picture = HTMLCanvasElement | HTMLImageElement;
type Region = { canvas: HTMLCanvasElement; mask: Mask; form: Relief };
type Point = [number, number];
const W = CANVAS.w;
const H = CANVAS.h;
const regions = new Map<string, Region>();

/** Only immutable source canvases and depth fields are cached, never instance materials. */
function region(key: string, source: Picture, keep: (x: number, y: number) => boolean, rounded = true): Region {
  const known = regions.get(key);
  if (known) return known;
  const canvas = stack([source]);
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (!keep(x, y)) data.data[(y * W + x) * 4 + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const mask = maskOf(canvas);
  const result = { canvas, mask, form: rounded ? ball(mask) : loft(mask, { passes: 6 }) };
  // Skin tones share geometry but not paint. Keys include the tone for the source canvas.
  regions.set(key, result);
  return result;
}

function polygon(points: Point[]) {
  return (x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
}

/** Cuts follow the existing shoulder/waist seams and gaps beside the hands. */
const ARM = polygon([[354, 784], [431, 791], [414, 851], [379, 895], [307, 961], [293, 998], [257, 1034], [195, 1034], [195, 926], [295, 869]]);
const sleeveEdge = (y: number) => y < 720 ? 430 : 430 + (y - 720) * 0.06;
function dressRegion(x: number, y: number) {
  const leftX = Math.min(x, W - x);
  if (y >= 1216 && leftX >= 435 && leftX < 510) return 'legs';
  if (y >= 788 && y < 1034 && ARM(leftX, y)) return x < 512 ? 'arm-left' : 'arm-right';
  if (y < 800 && leftX < sleeveEdge(y)) return x < 512 ? 'sleeve-left' : 'sleeve-right';
  if (y < 854) return 'bodice';
  return 'skirt';
}

/** Side/back paint uses the same palette, without copying a face or pendant onto the back. */
function plain(source: Picture, color: string) {
  const canvas = stack([source]);
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

function soft(source: Picture) {
  const { canvas, ctx } = newCanvas(W / 4, H / 4);
  // Extend nearby paint underneath the transparent edge before filtering it.
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-over';
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) {
    ctx.drawImage(source, dx, dy, canvas.width, canvas.height);
  }
  ctx.globalCompositeOperation = 'source-atop';
  // a wide blur: rows of curls, each light in the middle and dark between, came out as
  // stripes along the side of the head when the blur was narrower than a curl
  ctx.filter = 'blur(14px)';
  ctx.drawImage(source, 0, 0, W / 4, H / 4);
  return canvas;
}

const SKINS: Record<SkinTone, string> = { light: '#fdc59b', tan: '#e4a074', brown: '#b2724a', dark: '#72462c' };
const HAIRS: Record<string, string> = { braids: '#a52e17', long: '#874523', curly: '#242028', bun: '#e3b357' };
const CLOTH: Record<string, [string, string]> = {
  gown: ['#43ad69', '#1f7950'], aline: ['#d487e8', '#9457c4'],
  mermaid: ['#ee5b67', '#a93449'], star: ['#71b9f4', '#438bcd'],
};

/** A separate back avoids a second necklace/neckline and mirrored front decoration. */
function dressBackPaint(source: Picture, dress: string) {
  const canvas = stack([source]);
  const ctx = canvas.getContext('2d')!;
  const original = ctx.getImageData(0, 0, W, H);
  const [light, dark] = CLOTH[dress];
  const gradient = ctx.createLinearGradient(80, 0, 930, 0);
  gradient.addColorStop(0, dark); gradient.addColorStop(0.38, light);
  gradient.addColorStop(0.65, light); gradient.addColorStop(1, dark);
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff35';
  for (const end of [230, 360, 512, 664, 794]) {
    ctx.beginPath(); ctx.moveTo(512 + (end - 512) * 0.15, 860);
    ctx.bezierCurveTo(end, 1100, end, 1250, end, 1536); ctx.stroke();
  }
  ctx.strokeStyle = '#eaca81'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(441, 847); ctx.quadraticCurveTo(512, 861, 583, 847); ctx.stroke();
  const result = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    const r = original.data[k], g = original.data[k + 1], b = original.data[k + 2];
    const exposed = y < 695 || (y > 790 && y < 1040 && ARM(Math.min(x, W - x), y)) || (dress === 'star' && y > 1216);
    if (exposed && r > g * 1.12 && g > b * 1.12) {
      for (let c = 0; c < 3; c++) result.data[k + c] = original.data[k + c];
    }
  }
  ctx.putImageData(result, 0, 0);
  return canvas;
}

/**
 * Her skull, measured on the head picture: from y = 293 to her chin near y = 635, 166 pixels
 * either side of the middle at its widest. An egg nearly as deep as it is wide. Made from the
 * outline instead, her ears and neck counted as head and she came out a flat disc.
 */
const SKULL = { cx: 512, cy: 464, rx: 166, ry: 172, rz: 152 };
const skullZ = (x: number, y: number) => ellipse(x, y, SKULL.cx, SKULL.cy, SKULL.rx, SKULL.ry, SKULL.rz);

/** The head picture as solids: the skull, her ears as small round lumps, her neck a tube. */
const heads = new WeakMap<Mask, (k: number) => number>();
function headShape(mask: Mask) {
  const known = heads.get(mask);
  if (known) return known;
  const rows = H / G + 1;
  const half = new Float32Array(rows);
  for (let j = 0; j < rows; j++) {
    let l = -1, r = -1;
    for (let i = 0; i < NX; i++) if (mask[j * NX + i]) { if (l < 0) l = i; r = i; }
    if (l >= 0) half[j] = ((r - l) / 2) * G;
  }
  const lump = ball(mask);
  const depth = new Float32Array(mask.length);
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k]) continue;
    const x = (k % NX) * G, y = Math.floor(k / NX) * G;
    const skull = skullZ(x, y);
    // the neck, under her chin only: as round as it is wide. Started higher, it took the jaw's
    // width for the neck's and stood out of her face as a pale band across her mouth
    const neckHalf = half[Math.floor(k / NX)];
    const neck = y > 622 ? 0.9 * Math.sqrt(Math.max(0, neckHalf * neckHalf - (x - 512) ** 2)) : 0;
    // her ears, and anything else of the picture beyond the skull: small and round
    const ear = skull > 0 ? 0 : lump.depth[k] * G * 0.55;
    depth[k] = Math.max(skull, neck, ear);
  }
  const smooth = smoothField(depth, mask, 4);
  const at = (k: number) => smooth[k];
  heads.set(mask, at);
  return at;
}

function profile(points: Point[], y: number) {
  for (let i = 1; i < points.length; i++) if (y <= points[i][0]) {
    const a = points[i - 1], b = points[i];
    return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1));
  }
  return points[points.length - 1][1];
}
const SKIRT: Record<string, Point[]> = {
  gown: [[840, 66], [900, 162], [1000, 265], [1150, 360], [1280, 440], [1380, 440], [1536, 370]],
  aline: [[850, 68], [930, 189], [1030, 285], [1120, 306], [1300, 287], [1495, 235]],
  star: [[850, 68], [920, 165], [1000, 256], [1100, 335], [1235, 409]],
  mermaid: [[850, 66], [930, 193], [1020, 268], [1100, 253], [1124, 116], [1210, 95], [1300, 64], [1350, 100], [1440, 206], [1486, 180]],
};

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, rz: number) {
  return rz * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2));
}

/** Smooth a field without moving its silhouette. Shared seams get identical coordinates. */
function smoothField(field: Float32Array, mask: Mask, passes = 3) {
  let current = field;
  for (let n = 0; n < passes; n++) {
    const next = current.slice();
    for (let y = 1; y < H / G; y++) for (let x = 1; x < NX - 1; x++) {
      const k = y * NX + x;
      if (!mask[k]) continue;
      let total = current[k] * 4, count = 4;
      for (const d of [-1, 1, -NX, NX]) if (mask[k + d]) { total += current[k + d]; count++; }
      next[k] = total / count;
    }
    current = next;
  }
  return current;
}

/** A restrained studio response preserves painted colours while the turn reveals form. */
function paint(map: THREE.Texture, sideMap: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, alphaTest: 0.03, alphaToCoverage: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.pSide = { value: sideMap ?? map };
    // eyes, brows and mouth are painted on her face: their sides are their own paint, never
    // the softened edge colour, which left a grey smear beside an eye as she turned
    s.uniforms.pDecal = { value: sideMap ? 0 : 1 };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 inset; varying vec2 pInset; varying float pFace; varying float pView;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\npInset = inset; pFace = abs(normal.z);')
      .replace('#include <project_vertex>', '#include <project_vertex>\npView = abs(normalize((modelViewMatrix * vec4(0.,0.,1.,0.)).xyz).z);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D pSide; uniform float pDecal; varying vec2 pInset; varying float pFace; varying float pView;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 art = texture2D(map, vMapUv);
          vec4 edge = texture2D(pSide, pInset);
          float frontView = smoothstep(0.87, 0.995, pView);
          float keep = max(max(frontView, pDecal), smoothstep(0.3, 0.9, pFace) * smoothstep(0.2, 0.85, pView));
          diffuseColor *= vec4(mix(edge.rgb, art.rgb, keep), art.a);
        #endif
      `)
      // lit about half way from every side, the painted shading and the real one together:
      // unlit from the front she was the flat picture, which is what read as a sticker
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(diffuseColor.rgb, outgoingLight, mix(0.58, 0.42, smoothstep(0.85, 0.995, pView)));\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'princess-portrait-volume-v2';
  return mat;
}

/**
 * Where the tiara is on a front-of-hair picture: row by row, from its first gold pixel to its
 * last (taking in the jewels and the line between), in the top of the picture where it sits.
 * `base` is the lowest row of gold, where it meets her hair.
 */
const tiaras = new Map<string, { has: (x: number, y: number) => boolean; gold: (x: number, y: number) => boolean; base: number }>();
function tiaraOf(img: HTMLImageElement) {
  const known = tiaras.get(img.src);
  if (known) return known;
  const TOP = 300;
  const { data } = stack([img]).getContext('2d')!.getImageData(0, 0, W, TOP);
  const from = new Int16Array(TOP).fill(-1);
  const to = new Int16Array(TOP).fill(-1);
  const goldAt = new Uint8Array(W * TOP);
  let base = 0;
  for (let y = 0; y < TOP; y++) {
    for (let x = 300; x < 724; x++) {
      const k = (y * W + x) * 4;
      const [r, g, b, a] = [data[k], data[k + 1], data[k + 2], data[k + 3]];
      const gold = a > 200 && r > 170 && g > 120 && b < 140 && r - b > 80 && g > r * 0.55;
      if (!gold) continue;
      goldAt[y * W + x] = 1;
      if (from[y] < 0) from[y] = x;
      to[y] = x;
      base = y;
    }
  }
  const pad = 5;
  const result = {
    base,
    gold: (x: number, y: number) => y < TOP && goldAt[y * W + x] === 1,
    has: (x: number, y: number) => {
      // a row and the rows round it, so the line under the gold comes with it
      for (let yy = Math.max(0, y - pad); yy <= Math.min(TOP - 1, y + pad); yy++) {
        if (from[yy] >= 0 && x >= from[yy] - pad && x <= to[yy] + pad) return true;
      }
      return false;
    },
  };
  tiaras.set(img.src, result);
  return result;
}

/**
 * Her hair seen from behind: the hair's own colour where the pictures show nothing (the back
 * of her head), with strands combed down from the crown; and over that the hair she does have,
 * the other way round — the back of a curl is that curl mirrored — a shade darker, since the
 * back of a lock is in its own shadow. A painted grid of rings, tried first for the curls,
 * looked like bubble wrap.
 */
function hairBackPaint(source: Picture, color: string, behindArt: Picture, frontArt: Picture) {
  const canvas = plain(source, color);
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  for (let n = 0; n <= 24; n++) {
    const x = 200 + n * 26;
    ctx.strokeStyle = n % 2 ? '#00000028' : '#fff3bf35'; ctx.lineWidth = n % 2 ? 8 : 12;
    ctx.beginPath(); ctx.moveTo(512, 180); ctx.bezierCurveTo(x, 220, x + 70 * Math.sin(n), 540, x, 1000); ctx.stroke();
  }
  // the hair behind her, the other way round, goes first: its picture is mostly one flat
  // mass (it is behind everything on the sheet), and over it goes the hole where her face
  // was, filled with the locks of the front picture brought in from either side, over the
  // back of her skull only, and then the front picture itself the other way round
  ctx.save();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(behindArt, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(512, 470, 230, 250, 0, 0, Math.PI * 2); ctx.clip();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.globalAlpha = 0.9;
  for (const shift of [-160, 160, -80, 80]) ctx.drawImage(frontArt, shift, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(frontArt, 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

/** A picture with some of its pixels taken out, remembered by name. */
const cutouts = new Map<string, HTMLCanvasElement>();
function cutout(key: string, source: Picture, keep: (x: number, y: number) => boolean) {
  const known = cutouts.get(key);
  if (known) return known;
  const canvas = stack([source]);
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!keep(x, y)) data.data[(y * W + x) * 4 + 3] = 0;
  ctx.putImageData(data, 0, 0);
  cutouts.set(key, canvas);
  return canvas;
}

/** A picture the other way round and a shade darker: the back of a tiara, of a lock. */
function mirrored(source: Picture, darken = 0.25) {
  const { canvas, ctx } = newCanvas();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(0, 0, 0, ${darken})`;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

/**
 * Her earrings, on a front-of-hair picture: what hangs beside her jaw that is not the colour of
 * her hair (a pearl, a gem), grown by a few pixels to take the line drawn round it.
 */
const earringSets = new Map<string, Uint8Array>();
function earringsOf(img: HTMLImageElement, hair: string) {
  const key = `${img.src}|${hair}`;
  const known = earringSets.get(key);
  if (known) return known;
  const { data } = stack([img]).getContext('2d')!.getImageData(0, 0, W, H);
  const n = parseInt(hair.slice(1), 16);
  const [hr, hg, hb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const found: number[] = [];
  for (let y = 430; y < 640; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - 512);
      if (dx < 95 || dx > 240) continue;
      const k = (y * W + x) * 4;
      if (data[k + 3] < 200) continue;
      const [r, g, b] = [data[k], data[k + 1], data[k + 2]];
      if (Math.hypot(r - hr, g - hg, b - hb) > 120 && Math.max(r, g, b) > 90) found.push(y * W + x);
    }
  }
  const m = new Uint8Array(W * H);
  for (const k of found) {
    const x = k % W, y = (k - x) / W;
    for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) {
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && data[(yy * W + xx) * 4 + 3] > 60) m[yy * W + xx] = 1;
    }
  }
  earringSets.set(key, m);
  return m;
}

export async function buildPortrait(c: PortraitChoice): Promise<PortraitModel> {
  const urls = {
    head: headFile(c.tone), dress: c.dress ? filesOf('dress', c.dress, c.tone)[0] : null,
    frontHair: c.hair ? hairFront(c.hair) : null, backHair: c.hair ? hairBack(c.hair) : null,
    eyes: c.eyes ? filesOf('eyes', c.eyes, c.tone)[1] : null,
    brows: c.eyes ? browsFile : null, mouth: c.mouth ? filesOf('mouth', c.mouth, c.tone)[0] : null,
  };
  const entries = await Promise.all(Object.entries(urls).map(async ([k, url]) => [k, url ? await loadImage(url) : null] as const));
  const images = Object.fromEntries(entries) as Record<keyof typeof urls, HTMLImageElement | null>;
  const root = new THREE.Group(); root.name = 'princess-portrait-3d';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const tex = (source: Picture) => { const t = textureOf(source); textures.push(t); return t; };
  const add = (name: string, geo: THREE.BufferGeometry, source: Picture, parent = root, side: Picture | null = source) => {
    const mat = paint(tex(source), side ? tex(soft(side)) : null);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name;
    geometries.push(geo); materials.push(mat); parent.add(mesh);
  };
  /** Surfaces meet at their silhouette on a common centre plane, closing each volume. */
  const solid = (name: string, r: Region, center: (k: number) => number, radius: (k: number) => number, rear: Picture, parent = root) => {
    for (const front of [true, false]) {
      const z = (k: number) => (center(k) + (front ? 1 : -1) * radius(k)) / G;
      add(`${name}-${front ? 'front' : 'back'}`, sheet(r.mask, z, front, { wear: r.form, rim: (k) => center(k) / G }), front ? r.canvas : rear, parent, rear);
    }
  };
  const head = region(`head:${c.tone}`, images.head!, () => true);
  /** The back of her dress, for hair to lie on: where it is, and how far back (pixels). */
  let dressBack: { mask: Mask; z: Float32Array } | null = null;
  const headDepth = headShape(head.mask);

  solid('head', head, () => 0, headDepth, plain(head.canvas, SKINS[c.tone]));

  if (images.dress && c.dress) {
    const r = region(`dress-whole:${c.dress}:${c.tone}`, images.dress, () => true, false);
    const round = ball(r.mask);
    const front = new Float32Array(r.mask.length);
    const back = new Float32Array(r.mask.length);
    /*
     * How deep a skirt is against how wide: a ball gown is a bell nearly as round as it is
     * wide. The mermaid is three things: a peplum that flares a little (half as deep as wide,
     * it was a ball), a tail that IS her body and so is round, and a fluke that is a fin,
     * thin from the side.
     */
    const ratioAt = (y: number) => (c.dress !== 'mermaid' ? 0.65 : y > 1310 ? 0.2 : y > 1110 ? 0.9 : 0.5);
    const bellAt = (x: number, y: number) => {
      const rx = profile(SKIRT[c.dress!], y);
      return ratioAt(y) * Math.sqrt(Math.max(0, rx * rx - (x - 512) ** 2));
    };
    // each arm's width, row by row, so it is round across itself: one depth for the whole
    // arm made it a slab, a flat band down the side of the dress seen from the side
    const rows = H / G + 1;
    const span: Record<string, Float32Array> = { 'arm-left': new Float32Array(rows * 2).fill(-1), 'arm-right': new Float32Array(rows * 2).fill(-1) };
    for (let k = 0; k < r.mask.length; k++) {
      if (!r.mask[k]) continue;
      const x = (k % NX) * G, y = Math.floor(k / NX) * G;
      const part = dressRegion(x, y);
      const sp = span[part];
      if (!sp) continue;
      const j = Math.floor(k / NX);
      if (sp[j * 2] < 0 || x < sp[j * 2]) sp[j * 2] = x;
      if (x > sp[j * 2 + 1]) sp[j * 2 + 1] = x;
    }
    for (let k = 0; k < r.mask.length; k++) {
      if (!r.mask[k]) continue;
      const x = (k % NX) * G, y = Math.floor(k / NX) * G;
      const dx = Math.abs(x - 512);
      let radius = 0;
      // Torso and neck share one continuous rounded surface under the bodice.
      if (y <= 925) {
        const rx = profile([[640, 28], [675, 94], [720, 88], [770, 79], [845, 65], [900, 120], [925, 150]], y);
        radius = Math.max(radius, 0.88 * Math.sqrt(Math.max(0, rx * rx - dx * dx)));
      }
      // Round the actual sleeve outline, which differs for each costume.
      if (y < 845) radius = round.depth[k] * G * 0.95;
      let center = 0;
      const part = dressRegion(x, y);
      if (part.startsWith('arm')) {
        const sp = span[part];
        const j = Math.floor(k / NX);
        const hw = (sp[j * 2 + 1] - sp[j * 2]) / 2 + 2;
        const cx = (sp[j * 2] + sp[j * 2 + 1]) / 2;
        radius = Math.max(3, 0.95 * Math.sqrt(Math.max(0, hw * hw - (x - cx) ** 2)));
        center = profile([[784, 0], [845, 24], [925, 48], [1034, 62]], y);
        // a hand resting on the skirt rests ON it: sunk to the skirt's middle, the arm was a
        // groove down the side of the dress, seen from the side
        if (y >= 845) center = Math.max(center, bellAt(x, y) - radius * 0.4);
      } else if (y >= 845 && !(c.dress === 'star' && y > 1216)) {
        const bell = bellAt(x, y);
        // Close only the last few pixels of a scalloped hem, not the whole lower skirt.
        const existing = r.form.depth[k] * G;
        radius = Math.max(radius, Math.min(bell, existing * 1.5));
      }
      if (c.dress === 'star' && y > 1216) {
        const legX = x < 512 ? 478 : 546;
        radius = Math.sqrt(Math.max(0, 23 ** 2 - (x - legX) ** 2));
        if (y > 1437) radius = Math.max(radius, ellipse(x, y, legX, 1458, 37, 20, 47));
      }
      front[k] = center + Math.max(2, radius);
      back[k] = center - Math.max(2, radius);
    }
    const f = smoothField(front, r.mask, 10), b = smoothField(back, r.mask, 10);
    dressBack = { mask: r.mask, z: b };
    const rearPaint = dressBackPaint(r.canvas, c.dress);
    for (const isFront of [true, false]) {
      const field = isFront ? f : b;
      add(`dress-${c.dress}-${isFront ? 'front' : 'back'}`, sheet(r.mask, (k) => field[k] / G, isFront, { wear: r.form, rim: (k) => (f[k] + b[k]) / (2 * G) }), isFront ? r.canvas : rearPaint, root, rearPaint);
    }
  }

  // Eyes are their original painted shapes, seated on the head, with a small convex bulge
  // inside each eye. Brows and mouth conform to the head without a flat card in front.
  let eyes: THREE.Group | null = null;
  for (const kind of ['brows', 'mouth', 'eyes'] as const) {
    const source = images[kind];
    if (!source) continue;
    const r = region(`${kind}:${kind === 'mouth' ? c.mouth : c.eyes}`, source, () => true);
    const at = (k: number) => {
      let bump = 0;
      if (kind === 'eyes') {
        const x = (k % NX) * G, y = Math.floor(k / NX) * G;
        for (const cx of [427, 597]) bump = Math.max(bump, 14 * Math.max(0, 1 - ((x - cx) / 64) ** 2 - ((y - 492) / 60) ** 2));
      }
      return (headDepth(k) + 2 + bump) / G;
    };
    const geo = sheet(r.mask, at, true, { wear: r.form, rim: at });
    const parent = new THREE.Group(); parent.name = kind;
    if (kind === 'eyes') {
      const eyeY = (H / 2 - 490) * U;
      parent.position.y = eyeY; geo.translate(0, -eyeY, 0); eyes = parent;
    }
    root.add(parent);
    add(kind, geo, r.canvas, parent, null);
  }

  if (images.frontHair && images.backHair && c.hair) {
    // the tiara is gold; a blonde bun is too, so hers stays part of her hair
    const tiara = c.hair === 'bun' ? null : tiaraOf(images.frontHair);
    const onTiara = (k: number) => !!tiara && tiara.has((k % NX) * G, Math.floor(k / NX) * G);
    // her earrings hang beside her jaw: solids of their own, not part of the hair's sheet
    const earrings = earringsOf(images.frontHair, HAIRS[c.hair]);
    /*
     * The front of her hair without the earrings, and with the tiara's gold painted the
     * colour of her hair: the hair keeps its surface under the tiara (cut out, the slivers of
     * hair between the tiara's points stood on their own and showed from the side as
     * stripes), and the tiara, a solid of its own, goes over it.
     */
    const hairArt = cutout(`hair-front:${c.hair}`, images.frontHair, (x, y) => !earrings[y * W + x]);
    if (tiara && !hairArt.dataset.painted) {
      const over = hairArt.getContext('2d')!;
      over.drawImage(plain(cutout(`tiara-gold:${c.hair}`, images.frontHair, (x, y) => tiara.gold(x, y)), HAIRS[c.hair]), 0, 0);
      hairArt.dataset.painted = '1';
    }
    const source = stack([]), ctx = source.getContext('2d')!;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 635); ctx.clip();
    ctx.drawImage(plain(images.head!, HAIRS[c.hair]), 0, 0); ctx.restore();
    ctx.drawImage(images.backHair, 0, 0); ctx.drawImage(hairArt, 0, 0);
    const r = region(`hair-whole:${c.hair}`, source, () => true);
    const frontArt = maskOf(stack([images.frontHair]));

    /*
     * Her hair as a dome over her skull: from the top of her hair (not of the tiara) down to her
     * chin, wider than her head by 55 pixels each side and a little deeper. Over her face it lies
     * on her skin; beside her face it comes forward round her head part of the way; behind, it is
     * the whole dome. Curls that spread out past the dome are small round locks of their own.
     */
    let top = 0;
    for (let k = 0; k < r.mask.length; k++) {
      const x = (k % NX) * G;
      if (r.mask[k] && frontArt[k] && !onTiara(k) && Math.abs(x - 512) < 90) { top = Math.floor(k / NX) * G; break; }
    }
    const dome = { rx: SKULL.rx + 55, rz: SKULL.rz + 10, up: Math.max(60, SKULL.cy - top), down: 635 - SKULL.cy };
    /*
     * Above the middle of her head, each row of hair is as deep as it is wide (up to the dome's
     * width): a bun or the top of her hair is round from every side. The dome alone narrowed
     * above her skull, and seen from the side her hair rose in a thin crest.
     */
    const rows = H / G + 1;
    const reach = new Float32Array(rows);
    for (let k = 0; k < r.mask.length; k++) {
      if (!r.mask[k] || onTiara(k)) continue;
      const j = Math.floor(k / NX);
      reach[j] = Math.max(reach[j], Math.abs((k % NX) * G - 512));
    }
    const even = new Float32Array(rows);
    for (let j = 0; j < rows; j++) {
      let sum = 0, n = 0;
      for (let d = -6; d <= 6; d++) if (j + d >= 0 && j + d < rows && reach[j + d] > 0) { sum += reach[j + d]; n++; }
      even[j] = n ? sum / n : 0;
    }
    const domeZ = (x: number, y: number, round = true) => {
      const lower = ellipse(x, y, SKULL.cx, SKULL.cy, dome.rx, y < SKULL.cy ? dome.up : dome.down, dome.rz);
      if (y >= SKULL.cy || !round) return lower;
      const e = Math.min(even[Math.round(y / G)], dome.rz + 10);
      return Math.max(lower, 0.85 * Math.sqrt(Math.max(0, e * e - (x - 512) ** 2)));
    };

    const f = new Float32Array(r.mask.length), b = new Float32Array(r.mask.length);
    for (let k = 0; k < r.mask.length; k++) {
      if (!r.mask[k]) continue;
      const x = (k % NX) * G, y = Math.floor(k / NX) * G;
      const rounded = r.form.depth[k] * G;
      const skull = head.mask[k] && y < 615 ? headDepth(k) : 0;
      const d = domeZ(x, y);
      // a lock past the dome: round, a little behind her
      const lock = Math.min(70, rounded * 0.6);
      // over her forehead the hair lies close on the skull; above her brow it is the whole
      // dome (the top of her head); beside her face it comes forward part of the way
      const aboveBrow = y < SKULL.cy - SKULL.ry * 0.45;
      let front = Math.max(skull > 0 ? Math.max(skull + 12, domeZ(x, y, false)) : aboveBrow ? d : d * 0.6, -20 + lock);
      let rear = Math.min(-(skull + 24), -d, -20 - lock);
      if (y > 580) {
        // below her chin the hair hangs behind her shoulders; the braid hangs in front
        const braid = c.hair === 'braids' && x > 570;
        const t = THREE.MathUtils.smoothstep(y, 580, 730);
        front = THREE.MathUtils.lerp(front, (braid ? 72 : -45) + Math.min(74, rounded * 0.8), t);
        rear = THREE.MathUtils.lerp(rear, (braid ? 72 : -45) - Math.min(74, rounded * 0.8), t);
      }
      // The back-hair layer must stay behind the neck, not bridge across it like a beard.
      // The source cuts include hidden overlap strips, which are harmless in 2D but
      // cannot be lifted above the cheeks/chin as if they were foreground locks.
      const faceGap = (y > 420 && y < 580 && Math.abs(x - 512) < 85)
        || (y >= 580 && y < 615 && Math.abs(x - 512) < 115)
        || (y >= 615 && Math.abs(x - 512) < 150);
      if (!frontArt[k] || faceGap) {
        front = head.mask[k] && y < 615 ? headDepth(k) - 12 : -45;
        rear = Math.min(rear, front - 16);
      }
      f[k] = front; b[k] = rear;
    }
    const front = smoothField(f, r.mask, 20), rear = smoothField(b, r.mask, 20);
    for (let k = 0; k < r.mask.length; k++) {
      if (!r.mask[k]) continue;
      const x = (k % NX) * G, y = Math.floor(k / NX) * G;
      if (head.mask[k] && y < 635) rear[k] = Math.min(rear[k], -headDepth(k) - 24);
      // smoothing must not lift a hidden strip out through her face: it stays under her skin
      const faceGap = (y > 420 && y < 580 && Math.abs(x - 512) < 85)
        || (y >= 580 && y < 615 && Math.abs(x - 512) < 115)
        || (y >= 615 && Math.abs(x - 512) < 150);
      if ((!frontArt[k] || faceGap) && head.mask[k] && y < 615) front[k] = Math.min(front[k], headDepth(k) - 12);
      // hair hanging down her back lies on the back of her dress, a layer as thick as the lock,
      // rather than a board standing behind her
      if (dressBack && dressBack.mask[k] && y > 600 && !(c.hair === 'braids' && x > 570)) {
        const lie = dressBack.z[k] - 14 - Math.min(46, r.form.depth[k] * G * 0.45);
        rear[k] = Math.min(rear[k], lie);
        front[k] = Math.min(front[k], dressBack.z[k] + 30);
      }
    }
    const rim = (k: number) => (front[k] + rear[k]) / (2 * G);
    // the sides of her hair wear the hair's own colour, not the drawn outline smeared round them
    const behind = hairBackPaint(r.canvas, HAIRS[c.hair], images.backHair, hairArt);
    add(`hair-${c.hair}-front`, sheet(r.mask, (k) => front[k] / G, true, { wear: r.form, rim }), r.canvas, root, behind);
    add(`hair-${c.hair}-back`, sheet(r.mask, (k) => rear[k] / G, false, { wear: r.form, rim }), behind);

    if (earrings.some((v) => v)) {
      const e = region(`earrings:${c.hair}`, images.frontHair, (x, y) => !!earrings[y * W + x]);
      const zc = (k: number) => Math.max(skullZ((k % NX) * G, Math.floor(k / NX) * G), 6);
      add('earrings-front', sheet(e.mask, (k) => (zc(k) + 7) / G, true, { wear: e.form, rim: (k) => zc(k) / G }), e.canvas, root, null);
      add('earrings-back', sheet(e.mask, (k) => (zc(k) - 7) / G, false, { wear: e.form, rim: (k) => zc(k) / G }), e.canvas, root, null);
    }

    if (tiara) {
      // the tiara stands on the dome where its base meets her hair, curving round her head
      const t = region(`tiara:${c.hair}`, images.frontHair, (x, y) => tiara.has(x, y));
      const ring = (x: number) => Math.max(14, domeZ(x, tiara.base) + 4);
      // it leans back as it rises, the way a tiara sits on a head
      const lean = (k: number) => Math.max(0, tiara.base - Math.floor(k / NX) * G) * 0.3;
      const tf = (k: number) => (ring((k % NX) * G) - lean(k) + 7) / G;
      const tb = (k: number) => (ring((k % NX) * G) - lean(k) - 7) / G;
      const middle = (k: number) => (ring((k % NX) * G) - lean(k)) / G;
      add('tiara-front', sheet(t.mask, tf, true, { wear: t.form, rim: middle }), t.canvas, root, null);
      add('tiara-back', sheet(t.mask, tb, false, { wear: t.form, rim: middle }), mirrored(t.canvas), root, null);
    }
  }
  return {
    root, eyes,
    dispose() {
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
    },
  };
}

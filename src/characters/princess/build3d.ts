import * as THREE from 'three';
import { boxOf, browsFile, CANVAS, filesOf, hairBack, hairFront, headFile, type SkinTone } from './pieces';
import { above, ball, G, loadImage, loft, maskOf, NX, NY, newCanvas, sheet, stack, textureOf, U, union, type Mask, type Relief } from './relief';

/**
 * The 3D princess, put together from the same pictures as the flat one (see relief.ts).
 *
 * The sheet stacks her pictures back to front: the back of her hair, her head, her dress,
 * eyes and mouth, the front of her hair. Here they become solids that sit the same way round:
 *
 *   her body — head and dress as one solid, wearing the head, the dress, her brows and her
 *     mouth on its front, as the sheet draws them;
 *   the front of her hair — laid over her head a little above the skin, and a solid of its own
 *     where it falls past her head, so it frames her face and lies on her shoulders;
 *   the back of her hair — tucked behind her body, showing round it;
 *   from behind, the back of her head is hair (or skin when she has none) and the back of
 *     her dress is her dress;
 *   her eyes — on the skin of her face, under the hair, so a lock over an eye stays over it,
 *     and they blink as the flat eyes do.
 */

/** Where the top of her head ends and her chin begins, on the picture (pixels). */
const SKULL_Y = 615;
/** How deep a part of her is, against how wide it is: 1 is as deep as it is wide. */
const ROUND_HEAD = 0.9;
const ROUND_DRESS = 0.75;
/**
 * Hair is a layer over her, not a solid of its own: where it lies on her it is her shape plus a
 * thickness, and only where it falls free of her is it given depth of its own — a third of its
 * width. As deep as it was wide, long hair hung behind her like a brick.
 */
const ROUND_HAIR = 0.35;
/** How thick the hair over the back of her head is, at most and at least (grid units). */
const HAIR_THICK: [number, number] = [3, 10];
/** Round her head, the hair is a shell up to this much wider than her head (grid units: 90 px)... */
const HAIR_SHELL = 90 / G;
/** ...coming forward round her face this much of the way, and fading out this far below her chin. */
const SHELL_FRONT = 0.7;
const SHELL_FADE = 120 / G;
/** The rows either side a row of the shell is evened out over (grid units: 40 px). */
const SHELL_EVEN = 10;

/**
 * The hair round her head, as a shell.
 *
 * In the picture, the hair beside her face lies outside her head's outline, so, given depth of
 * its own, it stood in the middle of her like a fin when she was seen from the side. Hair
 * round a head wraps it: so in the rows of her head the hair is the skin of a ball centred on
 * her head, as wide as the hair reaches there — but no more than HAIR_SHELL wider than her
 * head, so big hair is big without being a brick.
 */
function shellOf(skull: Mask, hair: Mask) {
  const rows = new Float32Array(NY * 3); // centre, head radius, fade
  let last = -1;
  for (let j = 0; j < NY; j++) {
    let l = -1;
    let r = -1;
    for (let i = 0; i < NX; i++) {
      if (!skull[j * NX + i]) continue;
      if (l < 0) l = i;
      r = i;
    }
    if (l >= 0) {
      rows.set([(l + r) / 2, (r - l) / 2, 1], j * 3);
      last = j;
    } else if (last >= 0 && j - last < SHELL_FADE) {
      rows.set([rows[last * 3], rows[last * 3 + 1], 1 - (j - last) / SHELL_FADE], j * 3);
    }
  }
  // how far the hair reaches either side of her head, row by row — evened out over the rows
  // round it, since a curl ending in one row and not the next made a step in the shell, and a
  // step showed as a dark line across her hair
  const reach = new Float32Array(NY * 2);
  for (let j = 0; j < NY; j++) {
    const c = rows[j * 3];
    if (!rows[j * 3 + 2]) continue;
    for (let i = 0; i < NX; i++) {
      if (!hair[j * NX + i]) continue;
      if (i < c) reach[j * 2] = Math.max(reach[j * 2], c - i);
      else reach[j * 2 + 1] = Math.max(reach[j * 2 + 1], i - c);
    }
  }
  const even = new Float32Array(NY * 2);
  for (let j = 0; j < NY; j++) {
    for (let side = 0; side < 2; side++) {
      let sum = 0;
      let n = 0;
      for (let d = -SHELL_EVEN; d <= SHELL_EVEN; d++) {
        const jj = j + d;
        if (jj < 0 || jj >= NY || !rows[jj * 3 + 2]) continue;
        sum += reach[jj * 2 + side];
        n++;
      }
      even[j * 2 + side] = n ? sum / n : 0;
    }
  }
  const out = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) {
    const [c, rh, fade] = [rows[j * 3], rows[j * 3 + 1], rows[j * 3 + 2]];
    if (!fade) continue;
    const reachL = even[j * 2];
    const reachR = even[j * 2 + 1];
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (!hair[k]) continue;
      const dx = i - c;
      const reach = dx < 0 ? reachL : reachR;
      const e = rh + Math.max(0, Math.min(reach - rh, HAIR_SHELL));
      out[k] = ROUND_HEAD * Math.sqrt(Math.max(0, e * e - dx * dx)) * fade;
    }
  }
  return out;
}
/** Hair is lofted as a mass: gaps up to 32 pixels between locks are closed, and smoothed long. */
const HAIR_LOFT = { close: 4, passes: 8 };
/** How far the hair sits above her skin, and her eyes above it (grid units). */
const HAIR_LIFT = 5 / G;
const EYE_LIFT = 2 / G;

export interface Choice {
  tone: SkinTone;
  dress: string | null;
  hair: string | null;
  eyes: string | null;
  mouth: string | null;
}

export interface Sheet {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export interface Built {
  sheets: Sheet[];
  /** Her eyes, apart, so they can blink: drawn about `eyeLine` (world units). */
  eyes: Sheet | null;
  eyeLine: number;
  dispose(): void;
}

/* -------------------------------------------------------------- remembered work */

/** The solids' depths, worked out once per outline: the slow part of building her. */
const reliefs = new Map<string, Relief>();
function reliefOf(key: string, mask: () => Mask, opts?: Parameters<typeof loft>[1], make: typeof loft = loft) {
  let r = reliefs.get(key);
  if (!r) {
    r = make(mask(), opts);
    reliefs.set(key, r);
  }
  return r;
}

const masks = new Map<string, Mask>();
function maskOfImage(url: string, img: HTMLImageElement) {
  let m = masks.get(url);
  if (!m) {
    m = maskOf(stack([img]));
    masks.set(url, m);
  }
  return m;
}

/** The usual colour of a picture over an area: her skin, or the colour of her hair. */
const colours = new Map<string, string>();
function colourOf(url: string, img: HTMLImageElement, area?: [number, number, number, number]) {
  const key = `${url}|${area?.join(',') ?? ''}`;
  let c = colours.get(key);
  if (c) return c;
  const { data } = stack([img]).getContext('2d')!.getImageData(0, 0, CANVAS.w, CANVAS.h);
  const [x0, y0, x1, y1] = area ?? [0, 0, CANVAS.w, CANVAS.h];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const k = (y * CANVAS.w + x) * 4;
      if (data[k + 3] < 200) continue;
      r += data[k];
      g += data[k + 1];
      b += data[k + 2];
      n++;
    }
  }
  c = n ? `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : '#c98a5a';
  colours.set(key, c);
  return c;
}

/* -------------------------------------------------------------- the pictures */

/** A picture's top, down to her chin, filled with one colour: the back of her head. */
function skullIn(head: HTMLImageElement, colour: string) {
  const { canvas, ctx } = newCanvas();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS.w, SKULL_Y);
  ctx.clip();
  ctx.drawImage(head, 0, 0);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, CANVAS.w, CANVAS.h);
  return canvas;
}

/**
 * The middle tone of a picture: the average of its pixels once the darkest (the ink line, the
 * shadows) and the lightest (the shine) are left out. For the back of her hair.
 */
const tones = new Map<string, [number, number, number]>();
function midTone(url: string, img: HTMLImageElement): [number, number, number] {
  let t = tones.get(url);
  if (t) return t;
  const { data } = stack([img]).getContext('2d')!.getImageData(0, 0, CANVAS.w, CANVAS.h);
  const px: [number, number, number, number][] = [];
  for (let k = 0; k < data.length; k += 4 * 5) {
    if (data[k + 3] < 220) continue;
    const [r, g, b] = [data[k], data[k + 1], data[k + 2]];
    px.push([0.3 * r + 0.59 * g + 0.11 * b, r, g, b]);
  }
  px.sort((a, b) => a[0] - b[0]);
  const from = Math.floor(px.length * 0.4);
  const to = Math.max(from + 1, Math.floor(px.length * 0.85));
  let [r, g, b] = [0, 0, 0];
  for (let k = from; k < to; k++) {
    r += px[k][1];
    g += px[k][2];
    b += px[k][3];
  }
  const n = Math.max(1, to - from);
  t = px.length ? [r / n, g / n, b / n] : [120, 80, 50];
  tones.set(url, t);
  return t;
}

const rgb = ([r, g, b]: [number, number, number], k = 1) =>
  `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;

/**
 * Her hair seen from behind. The front of her hair has a hole where her face is, and behind her
 * face is the back of her head, which the pictures never show: it is her hair, combed down from
 * the crown — the hair's middle tone, with strands a little darker and a little lighter — and
 * the hair she does have drawn goes over the top of it.
 */
function hairFromBehind(head: HTMLImageElement, layers: HTMLImageElement[], tone: [number, number, number]) {
  const { canvas, ctx } = newCanvas();
  ctx.drawImage(skullIn(head, rgb(tone)), 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  const crown: [number, number] = [512, 150];
  for (let n = 0; n < 70; n++) {
    // fanned out from the crown, down to below her chin
    const a = Math.PI * (0.08 + (0.84 * n) / 69);
    const reach = 520;
    const ex = crown[0] - Math.cos(a) * reach * 0.75;
    const ey = crown[1] + Math.sin(a) * reach;
    const bend = ((n * 37) % 11) - 5;
    ctx.strokeStyle = rgb(tone, n % 3 === 0 ? 1.18 : n % 3 === 1 ? 0.78 : 0.9);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 7 + (n % 4) * 2;
    ctx.beginPath();
    ctx.moveTo(crown[0], crown[1]);
    ctx.quadraticCurveTo((crown[0] + ex) / 2 + bend * 8, (crown[1] + ey) / 2, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
  for (const l of layers) ctx.drawImage(l, 0, 0);
  return canvas;
}

/** The brown of the line round her pictures. */
const INK = new THREE.Color('#3B2314').convertSRGBToLinear();

/**
 * A picture softened: what the sides of a solid wear. A side of her runs back from the edge of
 * the picture, so it can only ever show the few pixels at that edge, drawn out along it — one
 * row of a curl dark, the next light, and the hair came out striped from the side. The
 * softened picture has the same colours without the detail that turns into stripes.
 */
function softened(source: HTMLCanvasElement | HTMLImageElement) {
  const { canvas, ctx } = newCanvas(CANVAS.w / 2, CANVAS.h / 2);
  ctx.filter = 'blur(3px)';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Her surface: the picture, lit only half way — the other half is the picture as painted. The
 * pictures carry their own shading; lit fully on top of it, every steep little rim came out a
 * band of a different shade, stepped like the grid it is built on. Half lit, she is still
 * round to the eye and the rims sit quietly in the picture.
 *
 * Then a line of ink round her profile, as she turns. From straight in front her drawn outline
 * is the line; seen from the side that outline would be a seam down her middle, so the line
 * round her there is worked out per pixel, from how far the surface turns away (as ToonInk
 * does). And where the surface faces sideways on the solid it wears the softened picture
 * (`soft`), from just inside the outline (the \`inset\` coordinates).
 */
const LIT = 0.5;

function material(map: THREE.Texture, soft: THREE.Texture | null = null) {
  // the soft edge of a picture stays soft: its transparency is turned into how much of each
  // pixel it covers. Cut hard at half, the edge of an arm opened up and the line drawn round it
  // on the hair behind showed through as dark splinters; cut lower, the edge went hairy.
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.04, alphaToCoverage: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInk = { value: INK };
    shader.uniforms.uSoft = { value: soft };
    shader.uniforms.uLit = { value: LIT };
    let vertex = shader.vertexShader;
    let fragment = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLit;')
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(diffuseColor.rgb, outgoingLight, uLit);\n#include <opaque_fragment>');
    if (soft) {
      vertex = vertex
        .replace('#include <common>', '#include <common>\nattribute vec2 inset;\nvarying vec2 vInset;\nvarying float vFaceOn;\nvarying float vFromFront;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvInset = inset;')
        // how squarely we look at her picture: from straight in front her drawn outline is all
        // the line she needs; the more she turns, the more the line round her profile is drawn
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvFromFront = abs(dot(normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz), normalize(-mvPosition.xyz)));',
        )
        // how squarely this bit of her faces out of the picture, front or back
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvFaceOn = abs(normalize(objectNormal).z);');
      fragment = fragment
        .replace('#include <common>', '#include <common>\nuniform vec3 uInk;\nuniform sampler2D uSoft;\nvarying vec2 vInset;\nvarying float vFaceOn;\nvarying float vFromFront;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            // facing us: the picture exactly, its outline and all; turning away: the colour just
            // inside the outline, softened, so the side is not the edge pulled into stripes
            // and seen from straight in front she is the picture itself, edges and all
            float frontOn = smoothstep(0.93, 0.995, vFromFront);
            float faceOn = max(smoothstep(0.18, 0.55, vFaceOn), frontOn);
            vec2 at = mix(vInset, vMapUv, faceOn);
            vec4 sharp = texture2D(map, at);
            vec3 side = texture2D(uSoft, at).rgb;
            diffuseColor *= vec4(mix(side, sharp.rgb, faceOn), sharp.a);
          #endif`,
        )
        .replace(
          '#include <dithering_fragment>',
          `{
            float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
            float perPixel = max(fwidth(facing), 1e-5);
            float line = smoothstep(perPixel * 0.8, perPixel * 2.4, facing);
            line = max(line, smoothstep(0.16, 0.36, facing));
            line = max(line, smoothstep(0.82, 0.97, vFromFront));
            gl_FragColor.rgb = mix(uInk, gl_FragColor.rgb, line);
          }
          #include <dithering_fragment>`,
        );
    }
    shader.vertexShader = vertex;
    shader.fragmentShader = fragment;
  };
  m.customProgramCacheKey = () => (soft ? 'princess-solid' : 'princess-flat');
  return m;
}

/**
 * Her body: her head a ball on its neck, her dress turned slice by slice, the deeper of the two
 * wherever they meet. Each point wears its picture where the dress says (the dress is drawn
 * over her neck) and its own pixel elsewhere.
 */
const bodies = new Map<string, Relief>();
function bodyRelief(dress: string | null, headMask: Mask, dressMask: Mask | null, bodyMask: Mask): Relief {
  const key = `${dress}`;
  const known = bodies.get(key);
  if (known) return known;
  const head = reliefOf('head', () => headMask, undefined, ball);
  const gown = dressMask ? reliefOf(`dress|${dress}`, () => dressMask) : null;
  const depth = new Float32Array(bodyMask.length);
  const ux = new Float32Array(bodyMask.length);
  const uy = new Float32Array(bodyMask.length);
  for (let k = 0; k < bodyMask.length; k++) {
    const h = headMask[k] ? head.depth[k] * ROUND_HEAD : 0;
    const d = gown && dressMask?.[k] ? gown.depth[k] * ROUND_DRESS : 0;
    depth[k] = Math.max(h, d);
    const from = gown && dressMask?.[k] ? gown : head;
    ux[k] = from.ux[k];
    uy[k] = from.uy[k];
  }
  const out = { depth, ux, uy };
  bodies.set(key, out);
  return out;
}

/* -------------------------------------------------------------- her */

export async function buildPrincess(c: Choice): Promise<Built> {
  const want = {
    head: headFile(c.tone),
    dress: c.dress ? filesOf('dress', c.dress, c.tone)[0] : null,
    hairF: c.hair ? hairFront(c.hair) : null,
    hairB: c.hair ? hairBack(c.hair) : null,
    brows: c.eyes ? browsFile : null,
    eyes: c.eyes ? filesOf('eyes', c.eyes, c.tone)[1] : null,
    mouth: c.mouth ? filesOf('mouth', c.mouth, c.tone)[0] : null,
  };
  const entries = await Promise.all(
    Object.entries(want).map(async ([k, url]) => [k, url ? await loadImage(url) : null] as const),
  );
  const img = Object.fromEntries(entries) as Record<keyof typeof want, HTMLImageElement | null>;
  const head = img.head!;

  // outlines
  const headMask = maskOfImage(want.head, head);
  const dressMask = img.dress ? maskOfImage(want.dress!, img.dress) : null;
  const hfMask = img.hairF ? maskOfImage(want.hairF!, img.hairF) : null;
  const hbMask = img.hairB ? maskOfImage(want.hairB!, img.hairB) : null;
  const bodyMask = union(headMask, dressMask);
  const skull = above(headMask, SKULL_Y);
  const behindMask = c.hair ? union(hfMask, hbMask, skull) : null;

  // depths (grid units)
  const body = bodyRelief(c.dress, headMask, dressMask, bodyMask);
  const hf = hfMask ? reliefOf(`hf|${c.hair}`, () => hfMask, HAIR_LOFT) : null;
  const hb = hbMask ? reliefOf(`hb|${c.hair}`, () => hbMask, HAIR_LOFT) : null;
  const all = behindMask ? reliefOf(`behind|${c.hair}`, () => behindMask, HAIR_LOFT) : null;
  const bodyAt = (k: number) => body.depth[k];
  const shell = behindMask ? shellOf(skull, behindMask) : null;
  // the front of her hair lies on her where it covers her; beside her face it comes forward
  // round her head, part of the way
  const hfAt = (k: number) =>
    bodyMask[k] ? bodyAt(k) + HAIR_LIFT : Math.max(hf!.depth[k] * ROUND_HAIR, (shell?.[k] ?? 0) * SHELL_FRONT);

  // the pictures each face wears
  const skin = colourOf(want.head, head, [440, 380, 590, 470]);
  const front = stack([head, img.dress, img.brows, img.mouth]);
  const back = stack([skullIn(head, skin)]);
  back.getContext('2d')!.drawImage(head, 0, SKULL_Y, CANVAS.w, CANVAS.h - SKULL_Y, 0, SKULL_Y, CANVAS.w, CANVAS.h - SKULL_Y);
  if (img.dress) back.getContext('2d')!.drawImage(img.dress, 0, 0);

  const textures: THREE.Texture[] = [];
  const tex = (s: HTMLCanvasElement | HTMLImageElement) => {
    const t = textureOf(s);
    textures.push(t);
    return t;
  };
  const sheets: Sheet[] = [];
  const add = (geometry: THREE.BufferGeometry, source: HTMLCanvasElement | HTMLImageElement) =>
    sheets.push({ geometry, material: material(tex(source), tex(softened(source))) });

  add(sheet(bodyMask, bodyAt, true, { wear: body }), front);
  add(sheet(bodyMask, (k) => -bodyAt(k), false, { wear: body }), back);

  // where hair lies on her, its edge stays lying on her instead of dipping into her
  const onHer = (z: (k: number) => number) => (k: number) => (bodyMask[k] ? z(k) : 0);
  if (img.hairF && hfMask && hf) add(sheet(hfMask, hfAt, true, { wear: hf, rim: onHer(hfAt) }), img.hairF);
  if (img.hairB && hbMask && hb) {
    // tucked behind her body and under the front of her hair; it shows round them
    const hbAt = (k: number) => {
      let z = hb.depth[k] * ROUND_HAIR;
      if (bodyMask[k]) z = Math.min(z, bodyAt(k) - HAIR_LIFT);
      if (hfMask?.[k]) z = Math.min(z, hfAt(k) - HAIR_LIFT);
      return z;
    };
    add(sheet(hbMask, hbAt, true, { wear: hb, rim: onHer(hbAt) }), img.hairB);
  }
  if (behindMask && all && img.hairF) {
    const tone = midTone(want.hairF!, img.hairF);
    const layers = [img.hairB, img.hairF].filter(Boolean) as HTMLImageElement[];
    const behind = (k: number) => {
      const own = all.depth[k] * ROUND_HAIR;
      const thick = Math.min(HAIR_THICK[1], Math.max(HAIR_THICK[0], own * 0.4));
      return -Math.max(own, shell?.[k] ?? 0, bodyMask[k] ? bodyAt(k) + HAIR_LIFT + thick : 0);
    };
    add(sheet(behindMask, behind, false, { wear: all, rim: onHer(behind) }), hairFromBehind(head, layers, tone));
  }

  // her eyes, over the box the sheet gives them, on her skin
  let eyes: Sheet | null = null;
  let eyeLine = 0;
  if (img.eyes && c.eyes) {
    const [x, y, w, h] = boxOf('eyes', c.eyes);
    const geometry = sheet(bodyMask, (k) => bodyAt(k) + EYE_LIFT, true, { area: [x, y, x + w, y + h] });
    eyeLine = (CANVAS.h / 2 - (y + h * 0.55)) * U;
    geometry.translate(0, -eyeLine, 0);
    eyes = { geometry, material: material(tex(img.eyes)) };
  }

  return {
    sheets,
    eyes,
    eyeLine,
    dispose() {
      for (const s of [...sheets, ...(eyes ? [eyes] : [])]) {
        s.geometry.dispose();
        s.material.dispose();
      }
      for (const t of textures) t.dispose();
    },
  };
}


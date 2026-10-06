import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';

/** 3-step gradient for a cartoon (cel) look with meshToonMaterial. */
export function useGradientMap(steps = 3) {
  return useMemo(() => {
    const data = new Uint8Array(steps * 4);
    for (let i = 0; i < steps; i++) {
      const v = Math.round(255 * (0.5 + (0.5 * i) / (steps - 1)));
      data.set([v, v, v, 255], i * 4);
    }
    const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [steps]);
}

const cache = new Map<string, Promise<THREE.Texture>>();

function rasterize(markup: string, size: number): Promise<THREE.Texture> {
  const key = `${size}:${markup}`;
  let p = cache.get(key);
  if (p) return p;
  p = new Promise<THREE.Texture>((resolve, reject) => {
    const svg = markup.replace(/^<svg([^>]*)>/, (_m, attrs: string) => {
      const cleaned = attrs.replace(/\sstyle="[^"]*"/, '');
      return `<svg${cleaned} width="${size}" height="${size}">`;
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      URL.revokeObjectURL(url);
      resolve(t);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg rasterize failed'));
    };
    img.src = url;
  });
  cache.set(key, p);
  return p;
}

/** Rasterizes a React SVG element into a texture (so 3D faces reuse the 2D art). */
export function useSvgTexture(el: ReactElement | null, size = 512): THREE.Texture | null {
  const markup = useMemo(() => (el ? renderToStaticMarkup(el) : ''), [el]);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!markup) {
      setTex(null);
      return;
    }
    let cancelled = false;
    rasterize(markup, size)
      .then((t) => {
        if (!cancelled) setTex(t);
      })
      .catch(() => {
        if (!cancelled) setTex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [markup, size]);
  return tex;
}

/** Loads a PNG as a color texture. */
export function useImageTexture(url: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    new THREE.TextureLoader().load(url, (t) => {
      if (cancelled) return;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      setTex(t);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return tex;
}

export const INK3D = '#0B1B3B';

/** Builds a 5-point star Shape (for wands, star eyes...). */
export function starShape(rOut = 1, rIn = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function heartShape(size = 1) {
  const s = new THREE.Shape();
  const x = 0;
  const y = 0;
  s.moveTo(x, y + size * 0.35);
  s.bezierCurveTo(x, y + size * 0.35, x - size * 0.05, y + size * 0.6, x - size * 0.35, y + size * 0.6);
  s.bezierCurveTo(x - size * 0.8, y + size * 0.6, x - size * 0.8, y + size * 0.05, x - size * 0.8, y + size * 0.05);
  s.bezierCurveTo(x - size * 0.8, y - size * 0.3, x - size * 0.45, y - size * 0.6, x, y - size * 0.95);
  s.bezierCurveTo(x + size * 0.45, y - size * 0.6, x + size * 0.8, y - size * 0.3, x + size * 0.8, y + size * 0.05);
  s.bezierCurveTo(x + size * 0.8, y + size * 0.05, x + size * 0.8, y + size * 0.6, x + size * 0.35, y + size * 0.6);
  s.bezierCurveTo(x + size * 0.05, y + size * 0.6, x, y + size * 0.35, x, y + size * 0.35);
  return s;
}

/** Simple polygon Shape from [x,y] points. */
export function polyShape(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

/** Pointed leaf Shape, tip at +y and stem at -y (for the dragon's leaf tail). */
export function leafShape(size = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -size * 0.55);
  s.quadraticCurveTo(size * 0.6, -size * 0.12, 0, size * 0.78);
  s.quadraticCurveTo(-size * 0.6, -size * 0.12, 0, -size * 0.55);
  return s;
}

/**
 * Resolves a selected option id for the 3D builders.
 *
 * The eraser lets a child clear a category, which arrives as the empty string:
 * that must render nothing, so it resolves to `null`. A missing id still falls
 * back to the category's default.
 */
export function pickPart(id: string | undefined | null, fallback: string): string | null {
  if (id === '') return null;
  return id ?? fallback;
}

export { usePatternTexture, getPatternTexture } from './pattern';
export type { PatternKind, PatternSpec } from './pattern';

/**
 * A ball with soft lumps on it, the way the kit's round monster is drawn: the 2D
 * body is not a circle but a blob with rounded nubs around its outline, and a
 * plain sphere in 3D reads as a beach ball instead of the same creature.
 *
 * Bump centres are spread over the sphere with a golden-angle spiral (skipping the
 * underside, which the drawing leaves smooth) and every vertex is pushed out along
 * its own direction by the sum of a Gaussian falloff around each centre. Because
 * the displacement is a function of the direction alone, it is seamless: no gap at
 * the UV seam and no spike at the poles.
 */
export function blobGeometry(opts: {
  radius?: number;
  segments?: number;
  bumps?: number;
  /** Bump height, as a fraction of the radius. */
  amount?: number;
  /** Angular width of one bump, in radians. */
  spread?: number;
  /** Bumps below this height (-1 bottom, 1 top) are dropped. */
  minY?: number;
  /** Put every bump on the silhouette ring instead of all over the ball. */
  rim?: boolean;
  seed?: number;
} = {}) {
  const { radius = 1, segments = 96, bumps = 14, amount = 0.13, spread = 0.3, minY = -0.45, rim = false, seed = 1.7 } = opts;

  const centres: THREE.Vector3[] = [];
  if (rim) {
    // the drawing scallops only the outline, so the bumps ride the silhouette the
    // viewer sees and the face in front of them stays smooth enough to draw on
    for (let i = 0; i < bumps; i++) {
      const a = (i / bumps) * Math.PI * 2 + seed;
      centres.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
  } else {
    const candidates = Math.ceil(bumps * 1.7);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < candidates && centres.length < bumps; i++) {
      const y = 1 - (2 * (i + 0.5)) / candidates;
      if (y < minY) continue;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const a = golden * i + seed;
      centres.push(new THREE.Vector3(Math.cos(a) * ring, y, Math.sin(a) * ring));
    }
  }

  const geo = new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const twoSigmaSq = 2 * spread * spread;
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).normalize();
    let d = 0;
    for (const c of centres) {
      const ang = Math.acos(Math.min(1, Math.max(-1, v.dot(c))));
      d += Math.exp(-(ang * ang) / twoSigmaSq);
    }
    v.multiplyScalar(radius * (1 + amount * Math.min(d, 1.7)));
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * A body turned on a lathe from a profile drawn in the picture plane.
 *
 * The peanut-shaped monster used to be three balls stuck together, which read as a
 * snowman rather than the one soft body the kit draws. One revolved surface keeps the
 * waist and the two bulges without any seams.
 *
 * Points are [radius, height]; the first and last must sit on the axis so the shape closes.
 */
export function latheBody(points: [number, number][], radial = 48, steps = 80) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const profile = curve.getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(profile, radial);
}

/**
 * Stamps one small shape out many times over and welds the copies into a single geometry.
 *
 * A monster's coat is a few hundred little tufts. Drawn as a few hundred meshes they cost
 * a draw call each, and — worse — each one carries its own cartoon ink line, so the lines
 * pile up between overlapping tufts and the whole coat goes muddy. Welded into one piece
 * the coat takes a single ink line, which then traces the outside of the fur exactly the
 * way it traces the outside of a body.
 *
 * `base` is used as a stencil and is not modified.
 */
export function stamp(base: THREE.BufferGeometry, at: THREE.Matrix4[]) {
  const copies = at.map((m) => base.clone().applyMatrix4(m));
  let points = 0;
  let indices = 0;
  for (const g of copies) {
    points += g.attributes.position.count;
    indices += g.index ? g.index.count : 0;
  }
  const position = new Float32Array(points * 3);
  const normal = new Float32Array(points * 3);
  const index = new Uint32Array(indices);
  let p = 0;
  let i = 0;
  for (const g of copies) {
    position.set(g.attributes.position.array as ArrayLike<number>, p * 3);
    normal.set(g.attributes.normal.array as ArrayLike<number>, p * 3);
    const gi = g.index;
    if (gi) for (let k = 0; k < gi.count; k++) index[i + k] = gi.getX(k) + p;
    p += g.attributes.position.count;
    i += gi ? gi.count : 0;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

/**
 * A bending limb that thins out along its length.
 *
 * THREE.TubeGeometry keeps one radius from end to end, which makes an arm or a leg read
 * as a length of pipe; every limb in the kit is drawn fat where it leaves the body and
 * narrow at the hand. This is the same swept tube, with the radius eased from `root` to
 * `tip` as it travels.
 */
export function taperedTube(
  points: [number, number, number][],
  root: number,
  tip: number,
  steps = 40,
  radial = 16,
) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(steps, false);
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPointAt(t, p);
    // eased so the limb keeps its bulk near the body and narrows towards the end
    const r = root + (tip - root) * (t * t * (3 - 2 * t));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      position.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      normal.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // wound so the faces look outwards: the other way round, the normals derived from
      // them point into the limb and the toon shading paints the whole thing black
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  // The normals are the radial directions, as three's own TubeGeometry writes them, not
  // ones measured off the triangles: a limb that doubles back on itself, like the snake
  // leg, has triangles that face every which way, and reading the normals from them
  // shattered the leg into loose red shards.
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setIndex(index);
  return geo;
}

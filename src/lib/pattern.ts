import { useMemo } from 'react';
import * as THREE from 'three';
import { hexToRgb, shade } from './color';

/**
 * Procedural surface patterns for the 3D characters.
 *
 * The 2D kit is hand-drawn: the monster bodies are covered in spots, dots and
 * fur strokes, the dragon has a shaded belly, the princess's dress has trim.
 * A flat `meshToonMaterial` colour throws all of that away and the characters
 * read as smooth plastic, so every big surface gets a small tiling canvas
 * painted here and used as the material's `map`. The toon gradient ramp and the
 * ink outline are untouched, so the cel-shaded look survives.
 *
 * Textures are cached by their parameters: a tile is painted once per
 * (pattern, base, accent, scale) and shared by every mesh that asks for it.
 */

export type PatternKind = 'spots' | 'dots' | 'fur' | 'smooth' | 'stripes' | 'scales';

export interface PatternSpec {
  /** Main fill — normally the part's colour from the kit. */
  base: string;
  /** Mark colour. Defaults to `shade(base, -0.18)`, which reads at a distance without being noisy. */
  accent?: string;
  pattern: PatternKind;
  /** How many times the tile repeats over the mesh's UVs (default 1). */
  scale?: number;
}

const SIZE = 256;
const cache = new Map<string, THREE.CanvasTexture>();

function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic PRNG, so one spec always paints the exact same tile. */
function makeRng(seed: number) {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Draws the same marks nine times on a 3x3 grid of tile offsets, so anything
 * that runs off one edge comes back on the opposite one and the tile is seamless.
 */
function wrapped(ctx: CanvasRenderingContext2D, draw: () => void) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      ctx.save();
      ctx.translate(ox * SIZE, oy * SIZE);
      draw();
      ctx.restore();
    }
  }
}

type Pt = [number, number];

/** Closed blob through smoothed points (quadratics via edge midpoints). */
function blobPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[pts.length - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < pts.length; i++) {
    const next = mid(pts[i], pts[(i + 1) % pts.length]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], next[0], next[1]);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------- painters */

/** Irregular darker blobs — the round monster body, the claw arm, the dragon. */
function paintSpots(ctx: CanvasRenderingContext2D, accent: string, rnd: () => number) {
  const blobs: Pt[][] = [];
  for (let i = 0; i < 16; i++) {
    const cx = rnd() * SIZE;
    const cy = rnd() * SIZE;
    const r = SIZE * (0.035 + rnd() * 0.045);
    const n = 8;
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = r * (0.7 + rnd() * 0.6);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]);
    }
    blobs.push(pts);
  }
  wrapped(ctx, () => {
    ctx.fillStyle = accent;
    for (const pts of blobs) {
      blobPath(ctx, pts);
      ctx.fill();
    }
  });
}

/** Even polka dots — the egg body, the tentacle arm. */
function paintDots(ctx: CanvasRenderingContext2D, accent: string) {
  const n = 4;
  const step = SIZE / n;
  const r = step * 0.27;
  wrapped(ctx, () => {
    ctx.fillStyle = accent;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const x = col * step + step * (row % 2 ? 0.75 : 0.25);
        const y = row * step + step * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Short strokes all leaning the same way — the square body, the fuzzy arm, hair. */
function paintFur(ctx: CanvasRenderingContext2D, accent: string, rnd: () => number) {
  const strokes: { x: number; y: number; len: number; lean: number; w: number; a: number }[] = [];
  for (let i = 0; i < 210; i++) {
    strokes.push({
      x: rnd() * SIZE,
      y: rnd() * SIZE,
      len: SIZE * (0.045 + rnd() * 0.035),
      lean: 0.3 + rnd() * 0.28,
      w: 1.4 + rnd() * 1.6,
      a: 0.3 + rnd() * 0.45,
    });
  }
  wrapped(ctx, () => {
    ctx.lineCap = 'round';
    for (const s of strokes) {
      const dx = Math.sin(s.lean) * s.len;
      const dy = Math.cos(s.lean) * s.len;
      ctx.strokeStyle = rgba(accent, s.a);
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + dx * 0.35, s.y + dy * 0.6, s.x + dx, s.y + dy);
      ctx.stroke();
    }
  });
}

/** A plain wash with a soft highlight — the hourglass body, the pincher arm. */
function paintSmooth(ctx: CanvasRenderingContext2D, base: string, accent: string) {
  const lift = shade(base, 0.32);
  const g = ctx.createRadialGradient(SIZE * 0.34, SIZE * 0.26, SIZE * 0.02, SIZE * 0.34, SIZE * 0.26, SIZE * 0.4);
  g.addColorStop(0, rgba(lift, 0.9));
  g.addColorStop(1, rgba(lift, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const floor = ctx.createLinearGradient(0, SIZE * 0.6, 0, SIZE);
  floor.addColorStop(0, rgba(accent, 0));
  floor.addColorStop(1, rgba(accent, 0.45));
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

/** Soft bands — the dragon's belly, the gown's trim. */
function paintStripes(ctx: CanvasRenderingContext2D, accent: string) {
  const bands = 4;
  const step = SIZE / bands;
  const h = step * 0.4;
  ctx.fillStyle = rgba(accent, 0.8);
  for (let i = 0; i < bands; i++) {
    const y0 = i * step + step * 0.32;
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x += 4) ctx.lineTo(x, y0 + Math.sin((x / SIZE) * Math.PI * 4) * 3);
    for (let x = SIZE; x >= 0; x -= 4) ctx.lineTo(x, y0 + h + Math.sin((x / SIZE) * Math.PI * 4) * 3);
    ctx.closePath();
    ctx.fill();
  }
}

/** Overlapping arcs — the mermaid dress, dragon skin. */
function paintScales(ctx: CanvasRenderingContext2D, accent: string) {
  const rows = 4;
  const cols = 4;
  const w = SIZE / cols;
  const h = SIZE / rows;
  wrapped(ctx, () => {
    ctx.strokeStyle = rgba(accent, 0.85);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * w + (r % 2 ? w * 0.5 : 0) + w * 0.5;
        const y = r * h + h * 0.45;
        ctx.beginPath();
        ctx.arc(x, y, w * 0.52, Math.PI * 0.06, Math.PI * 0.94);
        ctx.stroke();
      }
    }
  });
}

/* --------------------------------------------------------------- build */

function build(base: string, accent: string, pattern: PatternKind, scale: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rnd = makeRng(hash(`${pattern}|${base}|${accent}`));
  switch (pattern) {
    case 'spots':
      paintSpots(ctx, accent, rnd);
      break;
    case 'dots':
      paintDots(ctx, accent);
      break;
    case 'fur':
      paintFur(ctx, accent, rnd);
      break;
    case 'stripes':
      paintStripes(ctx, accent);
      break;
    case 'scales':
      paintScales(ctx, accent);
      break;
    case 'smooth':
      paintSmooth(ctx, base, accent);
      break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(scale, scale);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Cached tile for one set of parameters. */
export function getPatternTexture(base: string, accent: string, pattern: PatternKind, scale: number) {
  const key = `${pattern}|${base}|${accent}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = build(base, accent, pattern, scale);
  if (tex) cache.set(key, tex);
  return tex;
}

/**
 * Surface pattern for a `meshToonMaterial`'s `map`. Pass `null` (or no pattern)
 * for a part that should stay a flat colour. The texture already carries the
 * base colour, so the material's own `color` should be white when a map is set.
 */
export function usePatternTexture(spec?: PatternSpec | null): THREE.Texture | null {
  const base = spec?.base ?? '';
  const pattern = spec?.pattern;
  const accent = spec?.accent ?? (base ? shade(base, -0.18) : '');
  const scale = spec?.scale ?? 1;
  return useMemo(
    () => (base && pattern ? getPatternTexture(base, accent, pattern, scale) : null),
    [base, accent, pattern, scale],
  );
}

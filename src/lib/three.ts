import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';

/** 3-step gradient for a cartoon (cel) look with meshToonMaterial. */
export function useGradientMap(steps = 3) {
  return useMemo(() => {
    const data = new Uint8Array(steps * 4);
    for (let i = 0; i < steps; i++) {
      const v = Math.round(255 * (0.55 + (0.45 * i) / (steps - 1)));
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

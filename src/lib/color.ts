/** Small color helpers for the vector parts. */

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** amt > 0 lightens toward white, amt < 0 darkens toward black (range -1..1). */
export function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export const INK = '#0B1B3B';

/** hex -> hue 0..360, saturation 0..1, lightness 0..1 */
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Repaints one creature's colours onto another.
 *
 * The monster parts are cut out of six finished drawings, so a piece arrives wearing the
 * colours of the creature it came from: an arm cut from the orange one is orange, and every
 * shade on it — the darker underside, the pale palm — was chosen against that orange. Tying
 * each of those shades to a fixed lighter-or-darker amount would flatten the drawing, so
 * instead this measures how far a colour sits from its own creature's base in hue,
 * saturation and lightness, and hangs that same distance on the new base.
 *
 * `repainter(target, source)` returns the function to run each colour of the piece through.
 * A piece worn by the creature it was drawn for gets its own colours back untouched, which
 * is what keeps those four monsters exactly as they were approved.
 */
export function repainter(target: string, source: string): (hex: string) => string {
  if (target.toLowerCase() === source.toLowerCase()) return (hex) => hex;
  const [th, ts, tl] = hexToHsl(target);
  const [sh, ss, sl] = hexToHsl(source);
  const cache = new Map<string, string>();
  return (hex) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const [h, s, l] = hexToHsl(hex);
    const out = hslToHex(
      th + (h - sh),
      Math.max(0, Math.min(1, ts + (s - ss))),
      Math.max(0, Math.min(1, tl + (l - sl))),
    );
    cache.set(hex, out);
    return out;
  };
}

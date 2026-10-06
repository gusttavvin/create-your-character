import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Turns a drawn shape into a modelled one.
 *
 * The monsters in this game are drawings, and the first modelled version of them was built
 * out of balls, cones and tubes arranged to look roughly like the drawings. It did not look
 * like them, and Clara was right to say so: a cone is not a horn, and no amount of nudging
 * a cone makes it one.
 *
 * So nothing here is arranged to resemble anything. Every piece of a modelled monster is
 * the drawn piece itself — the same outline, read straight out of the artwork — given
 * thickness and then inflated, so it swells in the middle and thins to nothing at its edge,
 * the way a soft toy or a vinyl figure does. The silhouette is therefore exactly the
 * drawing's silhouette, because it IS the drawing's silhouette, and what makes it a model
 * rather than a sticker is the volume put into it.
 */

const loader = new SVGLoader();

export interface DrawnShape {
  shape: THREE.Shape;
  /** The shape's own box, in drawing units. */
  box: THREE.Box2;
}

const shapeCache = new Map<string, DrawnShape[]>();

/**
 * Reads the outlines out of a fragment of SVG, in the drawing's own coordinates.
 *
 * Drawing coordinates run down the page and world coordinates run up it. An earlier version
 * turned each curve over by reaching inside it and negating its points, which quietly
 * wrecked every arc — and since these drawings are mostly arcs, the outlines came out as
 * scribbles, every piece measured as paper-thin, and the monsters were boards. The turn now
 * happens once, to the finished geometry, where it cannot go wrong.
 */
export function drawnShapes(key: string, svg: string): DrawnShape[] {
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const parsed = loader.parse(svg);
  const out: DrawnShape[] = [];
  for (const path of parsed.paths) {
    for (const shape of SVGLoader.createShapes(path)) {
      const box = new THREE.Box2();
      for (const p of shape.getPoints(24)) box.expandByPoint(p);
      out.push({ shape, box });
    }
  }
  shapeCache.set(key, out);
  return out;
}

/**
 * Turns a finished piece the right way up.
 *
 * Mirroring the points alone would leave every triangle wound backwards and the light would
 * fall on the inside of the piece, so the winding is reversed to match.
 */
function mirrorY(input: THREE.BufferGeometry, weld = true) {
  /**
   * Weld the vertices first.
   *
   * Cutting the faces up leaves every triangle with its own copy of each corner, so the
   * light is worked out per triangle and the piece comes out faceted, like a cut gem, with
   * the ink line catching on every crease. Welded, one corner is shared by the triangles
   * around it and the surface reads as the smooth thing it is meant to be.
   */
  // a swept tube arrives welded already, and running over it again costs whole seconds
  // and welds nothing, because every vertex of it carries its own texture coordinate
  const geo = weld ? mergeVertices(input, 1e-3) : input;
  geo.scale(1, -1, 1);
  const idx = geo.index;
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i + 2 < a.length; i += 3) {
      const t = a[i];
      a[i] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  } else {
    // an extruded shape comes without an index, so the triangles themselves are reordered
    for (const attr of Object.values(geo.attributes)) {
      const a = attr as THREE.BufferAttribute;
      const n = a.itemSize;
      const arr = a.array as Float32Array;
      for (let i = 0; i + 3 * n <= arr.length; i += 3 * n) {
        for (let k = 0; k < n; k++) {
          const t = arr[i + k];
          arr[i + k] = arr[i + 2 * n + k];
          arr[i + 2 * n + k] = t;
        }
      }
      a.needsUpdate = true;
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Evens out the direction the surface faces, without moving it.
 *
 * Each corner takes the average of the corners joined to it, a few times over. The shape
 * stays exactly where it was — only the direction it is taken to face is smoothed, which is
 * all the ink line reads.
 */
function smoothNormals(geo: THREE.BufferGeometry, passes = 3) {
  const idx = geo.index;
  const nor = geo.getAttribute('normal');
  if (!idx || !nor) return geo;
  const a = idx.array as ArrayLike<number>;
  const n = nor.count;
  let cur = nor.array as Float32Array;
  for (let pass = 0; pass < passes; pass++) {
    const sum = new Float32Array(n * 3);
    const hits = new Uint16Array(n);
    for (let i = 0; i + 2 < a.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = a[i + k];
        for (let j = 0; j < 3; j++) {
          if (j === k) continue;
          const w = a[i + j];
          sum[v * 3] += cur[w * 3];
          sum[v * 3 + 1] += cur[w * 3 + 1];
          sum[v * 3 + 2] += cur[w * 3 + 2];
          hits[v]++;
        }
      }
    }
    const next = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      // half its own, half its neighbours': enough to even out the grid without flattening
      const c = hits[v] || 1;
      let x = cur[v * 3] + sum[v * 3] / c;
      let y = cur[v * 3 + 1] + sum[v * 3 + 1] / c;
      let z = cur[v * 3 + 2] + sum[v * 3 + 2] / c;
      const len = Math.hypot(x, y, z) || 1;
      next[v * 3] = x / len;
      next[v * 3 + 1] = y / len;
      next[v * 3 + 2] = z / len;
    }
    cur = next;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(cur, 3));
  return geo;
}

export interface InflateOpts {
  /**
   * How round the piece comes out, from 0 (a flat cut-out) to 1 (as deep as it is wide).
   *
   * At 1 a drawn circle becomes a true ball and a drawn arm becomes a true tube, because
   * the depth at every point is taken from a circle: a point that sits `d` in from the
   * outline of a piece whose thickest place is `R` rises to sqrt(d(2R - d)) — the height
   * of a circle of radius R at that distance from its rim. Cartoon characters read best
   * a little flattened, so the usual value is just under 1.
   */
  round?: number;
  /** Lies on something else: only the front rises, and only this far in from the rim. */
  relief?: number;
  /** How thick the slab is before it is inflated. */
  depth?: number;
  /** Corner rounding on the rim. */
  bevel?: number;
  curveSegments?: number;
}

const ringCache = new WeakMap<THREE.Shape, number[][]>();
const radiusCache = new WeakMap<THREE.Shape, number>();

/**
 * Samples one curve by its own length, so the points land an even distance apart.
 *
 * A fixed number of points per curve spends as much effort on a two-unit nick as on a
 * four-hundred-unit sweep, which is how a circle ends up being drawn as a few straight
 * lines.
 */
function sampleCurve(c: THREE.Curve<THREE.Vector2>, step: number) {
  const len = c.getLength();
  return c.getPoints(Math.max(4, Math.min(400, Math.ceil(len / step))));
}

/** The outline as a dense list of points, worked out once per shape. */
function ringsOf(d: DrawnShape): number[][] {
  const hit = ringCache.get(d.shape);
  if (hit) return hit;
  const size = d.box.getSize(new THREE.Vector2());
  // about a two-hundredth of the piece between points, so what lies between them is
  // smaller than a pixel at any size this is ever drawn
  const step = Math.max(0.25, Math.max(size.x, size.y) / 200);
  const rings: number[][] = [];
  const ring = (path: THREE.Path | THREE.Shape) => {
    const flat: number[] = [];
    for (const c of path.curves) {
      const pts = sampleCurve(c, step);
      // the first point of a curve is the last point of the one before it
      for (let i = flat.length ? 1 : 0; i < pts.length; i++) flat.push(pts[i].x, pts[i].y);
    }
    if (flat.length >= 6) rings.push(flat);
  };
  ring(d.shape);
  for (const h of d.shape.holes) ring(h);
  ringCache.set(d.shape, rings);
  return rings;
}

/** The piece's thickness: the radius of the largest circle that fits inside it. */
function radiusOf(d: DrawnShape) {
  const hit = radiusCache.get(d.shape);
  if (hit !== undefined) return hit;
  const f = fieldOf(d);
  let best = 0;
  for (const v of f.grid) if (v > best) best = v;
  const r = Math.max(1e-4, best);
  radiusCache.set(d.shape, r);
  return r;
}

interface Field {
  grid: Float32Array;
  /** How thick the piece is at each cell — see thicknessOf. */
  thick: Float32Array;
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  /** The grid's spacing, the same both ways. */
  cell: number;
}
const fieldCache = new WeakMap<THREE.Shape, Field>();

/**
 * The exact distance transform of one row, after Felzenszwalb and Huttenlocher.
 *
 * It finds, for every cell, the lowest of a set of parabolas, which is what the squared
 * distance to the nearest marked cell is. Two passes of it — down the columns, then along
 * the rows — give the true Euclidean distance over the whole grid, in time that does not
 * care how complicated the outline was.
 */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/**
 * How far every point of a piece is from its outline.
 *
 * The shape is filled in on a fine square grid by running a line across every row and
 * marking what falls between the crossings — the outline's own rule for what is inside it —
 * and the distance is then measured exactly over that grid. The version before this tested
 * a coarse grid of points against a coarse polygon, which is two approximations stacked on
 * one another; this is the real outline, filled properly and measured properly.
 *
 * Points outside the piece read as nought, which is what a piece lying past the edge of the
 * thing it rests on should get.
 */
function fieldOf(d: DrawnShape, want = 200): Field {
  const hit = fieldCache.get(d.shape);
  if (hit) return hit;
  const rings = ringsOf(d);
  const size = d.box.getSize(new THREE.Vector2());
  const long = Math.max(1e-4, Math.max(size.x, size.y));
  // square cells, so a distance in cells is a distance in units whichever way it runs
  const cell = long / want;
  const pad = Math.ceil(want * 0.05);
  const nx = Math.ceil(size.x / cell) + pad * 2 + 1;
  const ny = Math.ceil(size.y / cell) + pad * 2 + 1;
  const x0 = d.box.min.x - pad * cell;
  const y0 = d.box.min.y - pad * cell;

  const INF = 1e12;
  const grid = new Float64Array(nx * ny);
  const xs: number[] = [];
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * cell;
    xs.length = 0;
    for (const ring of rings) {
      for (let k = 0, n = ring.length; k < n; k += 2) {
        const ay = ring[k + 1];
        const by = ring[(k + 3) % n];
        if (ay > y === by > y) continue;
        const ax = ring[k];
        const bx = ring[(k + 2) % n];
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    // between the first crossing and the second is inside; between the second and the
    // third is outside again, which is what puts the hole in a ring
    for (let t = 0; t + 1 < xs.length; t += 2) {
      const i0 = Math.max(0, Math.ceil((xs[t] - x0) / cell));
      const i1 = Math.min(nx - 1, Math.floor((xs[t + 1] - x0) / cell));
      for (let i = i0; i <= i1; i++) grid[j * nx + i] = INF;
    }
  }

  const m = Math.max(nx, ny);
  const f = new Float64Array(m);
  const dd = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) f[j] = grid[j * nx + i];
    edt1d(f, ny, dd, v, z);
    for (let j = 0; j < ny; j++) grid[j * nx + i] = dd[j];
  }
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) f[i] = grid[j * nx + i];
    edt1d(f, nx, dd, v, z);
    for (let i = 0; i < nx; i++) out[j * nx + i] = Math.sqrt(dd[i]) * cell;
  }

  const field = { grid: out, thick: thicknessOf(out, nx, ny, cell), nx, ny, x0, y0, cell };
  fieldCache.set(d.shape, field);
  return field;
}

/** Reads the field back, smoothly, at any point. */
/**
 * How thick the piece is at each cell: the radius of the biggest circle that fits inside the
 * shape AND covers that cell.
 *
 * Distance to the rim is not thickness. In the middle of a finger it is the finger's own
 * half-width, which is right, but the swelling was worked out from ONE radius for the whole
 * piece — the widest point of it — so a finger twelve units across on a palm forty across
 * came out as deep as the palm, and the hand modelled up into a bunch of sausages.
 *
 * Every point of the shape lies inside some largest inscribed circle; that circle's radius is
 * the thickness there. Painting those circles biggest first, and skipping any whose middle a
 * bigger one has already covered, gives every cell its own circle in close to one pass.
 */
function thicknessOf(grid: Float32Array, nx: number, ny: number, cell: number) {
  const thick = new Float32Array(nx * ny);
  const order: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] > 0) order.push(i);
  order.sort((a, b) => grid[b] - grid[a]);
  for (const c of order) {
    const r = grid[c];
    if (thick[c] >= r) continue;
    const cx = c % nx;
    const cy = (c / nx) | 0;
    const rc = r / cell;
    const span = Math.ceil(rc);
    for (let dy = -span; dy <= span; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= ny) continue;
      const dx = Math.floor(Math.sqrt(Math.max(0, rc * rc - dy * dy)));
      const row = y * nx;
      for (let x = Math.max(0, cx - dx); x <= Math.min(nx - 1, cx + dx); x++) {
        if (thick[row + x] < r) thick[row + x] = r;
      }
    }
  }
  /**
   * And softened, so a thin part meets a thick one on a slope instead of a step.
   *
   * Thickness is the radius of the biggest circle covering a point, and that number jumps
   * where one circle gives way to the next — a finger meeting a palm would come out with a
   * ledge across it. Two passes of a small blur turn the ledge into the shoulder a carved
   * thing has.
   */
  const soft = new Float32Array(thick.length);
  let from = thick;
  for (let pass = 0; pass < 2; pass++) {
    const to = pass % 2 ? thick : soft;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = y + dy;
            const i = x + dx;
            if (j < 0 || i < 0 || j >= ny || i >= nx) continue;
            const v = from[j * nx + i];
            if (v <= 0) continue;
            sum += v;
            n++;
          }
        }
        to[y * nx + x] = n ? sum / n : from[y * nx + x];
      }
    }
    from = to;
  }
  return from;
}

/** Bilinear read of one of the field's grids. */
function readAt(f: Field, grid: Float32Array, x: number, y: number) {
  const u = (x - f.x0) / f.cell;
  const v = (y - f.y0) / f.cell;
  if (u < 0 || v < 0 || u > f.nx - 1 || v > f.ny - 1) return 0;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const i1 = Math.min(f.nx - 1, i + 1);
  const j1 = Math.min(f.ny - 1, j + 1);
  const fu = u - i;
  const fv = v - j;
  const a = grid[j * f.nx + i] * (1 - fu) + grid[j * f.nx + i1] * fu;
  const b = grid[j1 * f.nx + i] * (1 - fu) + grid[j1 * f.nx + i1] * fu;
  return a * (1 - fv) + b * fv;
}

/** How thick the piece is where this point sits. */
function thickAt(d: DrawnShape, x: number, y: number) {
  const f = fieldOf(d);
  return readAt(f, f.thick, x, y);
}

function distAt(d: DrawnShape, x: number, y: number) {
  const f = fieldOf(d);
  const u = (x - f.x0) / f.cell;
  const v = (y - f.y0) / f.cell;
  if (u < 0 || v < 0 || u > f.nx - 1 || v > f.ny - 1) return 0;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const i1 = Math.min(f.nx - 1, i + 1);
  const j1 = Math.min(f.ny - 1, j + 1);
  const fu = u - i;
  const fv = v - j;
  const a = f.grid[j * f.nx + i] * (1 - fu) + f.grid[j * f.nx + i1] * fu;
  const b = f.grid[j1 * f.nx + i] * (1 - fu) + f.grid[j1 * f.nx + i1] * fu;
  return a * (1 - fv) + b * fv;
}

/**
 * How far a point on a piece has swelled — how far out its surface is there.
 *
 * A piece laid on top of another has to sit on that other one's surface, not float in
 * front of its flat outline, so whatever is worn on a body asks the body how high it is at
 * that spot and places itself there.
 */
export function domeAt(d: DrawnShape, x: number, y: number, round = 0.88) {
  const R = Math.max(1e-4, thickAt(d, x, y));
  const dist = Math.min(R, distAt(d, x, y));
  return Math.sqrt(Math.max(0, dist * (2 * R - dist))) * round;
}

const strokeCache = new Map<string, THREE.Vector2[][]>();

/**
 * The centre lines of a drawn stroke — an antenna's stalk, a toe line, an eyebrow.
 *
 * These are drawn with nothing inside them, so there is no outline to give thickness to.
 * What the model needs is the line itself, which is then swept into a round rod.
 */
export function drawnLines(key: string, svg: string): THREE.Vector2[][] {
  const hit = strokeCache.get(key);
  if (hit) return hit;
  const out: THREE.Vector2[][] = [];
  for (const p of loader.parse(svg).paths) {
    for (const sub of p.subPaths) {
      /**
       * Spaced along the whole line, not along each curve of it.
       *
       * `getPoints(n)` on a path gives n points to EVERY curve in it. On the traced hand,
       * whose outline is a hundred and thirty-odd little curves, that came to forty thousand
       * points, and the rod swept through them took a minute to build and weighed two million
       * vertices. `getSpacedPoints` measures the line and puts n points along it.
       */
      const want = Math.max(24, Math.min(300, Math.ceil(sub.getLength() / 1.5)));
      const pts = sub.getSpacedPoints(want).map((v) => new THREE.Vector2(v.x, v.y));
      if (pts.length > 1) out.push(pts);
    }
  }
  strokeCache.set(key, out);
  return out;
}

/** A drawn line swept into a round rod, so it reads as modelled rather than printed. */
export function rod(points: THREE.Vector2[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, 0)));
  // twelve sides is round at the width these lines are drawn at, and a quarter of the cost
  return mirrorY(new THREE.TubeGeometry(curve, Math.max(24, points.length), radius, 12, false), false);
}

// A hatch for looking at these numbers from the browser console while tuning. Dev only.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__svg3d = { drawnShapes, inflated, domeAt, svgOf };
}

/**
 * Bends a piece onto the one it lies on.
 *
 * A blush, a pale belly, an eye: each is a patch of skin, and skin follows the body. Placed
 * at one depth the whole patch is a flat plate tangent to a curved body, which is exactly
 * what it looks like from any angle but straight on. This asks the host how high it has
 * risen under every single point of the patch and lifts each point by that much, so the
 * patch curves with the thing it is on.
 *
 * The piece has already been turned the right way up and the host has not, so the host is
 * asked about the mirrored point.
 */
export function layOn(geo: THREE.BufferGeometry, host: DrawnShape, round = 0.88, lift = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, pos.getZ(i) + domeAt(host, pos.getX(i), -pos.getY(i), round) + lift);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export interface InflateOpts {
  /**
   * How round the piece comes out, from 0 (a flat cut-out) to 1 (as deep as it is wide).
   *
   * At 1 a drawn circle becomes a true ball and a drawn arm a true tube, because the depth
   * at every point is taken from a circle: a point that sits `d` in from the outline of a
   * piece whose thickest place is `R` rises to sqrt(d(2R - d)), the height of a circle of
   * radius R at that distance from its rim. Cartoon characters read best a little
   * flattened, so the usual value is just under 1.
   */
  round?: number;
  /** Lies on something else: only the front rises, and only this far in from the rim. */
  relief?: number;
  /** How thick the slab is before it is inflated. */
  depth?: number;
  /** Corner rounding on the rim. */
  bevel?: number;
  curveSegments?: number;
}

/**
 * Gives a drawn outline real volume.
 *
 * The shape is extruded into a thin slab, its flat faces are cut into smaller triangles,
 * and every point is then pushed out along the depth to the height a ball of the piece's
 * own thickness would have there. A drawn circle comes out a ball, a drawn arm comes out a
 * tube, a drawn body comes out a body — round from every side, not a board with a bulge on
 * the front.
 *
 * The cutting-up matters as much as the pushing. An extruded shape is triangulated from its
 * outline alone: every vertex of its faces sits ON the rim, where the swelling is meant to
 * be nought, so there is nothing in the middle to push and the piece stays as flat as it
 * started however hard it is blown up.
 *
 * A piece that lies on another one — a blush, a pale belly — asks for `relief` instead, and
 * only its front rises, by a little; `layOn` then bends it onto whatever it rests on.
 */
export function inflated(d: DrawnShape, opts: InflateOpts = {}) {
  const size = d.box.getSize(new THREE.Vector2());
  const small = Math.max(1e-4, Math.min(size.x, size.y));
  const {
    round = 0.88,
    relief = 0,
    depth = small * (relief ? 0.06 : 0.05),
    bevel = Math.min(depth * 0.4, small * 0.02),
    curveSegments = 64,
  } = opts;

  const slab = new THREE.ExtrudeGeometry(d.shape, {
    depth,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 6,
  });
  const geo = new TessellateModifier(Math.max(1, small / 20), 6).modify(slab);

  const pos = geo.attributes.position;
  const mid = depth / 2;
  const R = radiusOf(d);
  const rim = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const raw = distAt(d, pos.getX(i), pos.getY(i));
    rim[i] = raw;
    // the circle this point belongs to, not the widest one anywhere in the piece
    const here = Math.max(1e-4, thickAt(d, pos.getX(i), pos.getY(i)));
    const lift = relief ? Math.min(here, small * relief) : here;
    const dist = Math.min(lift, raw);
    // the height of a circle of radius `lift` at `dist` in from its rim
    const dome = Math.sqrt(Math.max(0, dist * (2 * lift - dist))) * round;
    const z = pos.getZ(i);
    if (relief) {
      if (z > mid) pos.setZ(i, z + dome);
    } else {
      pos.setZ(i, z + (z > mid ? dome : -dome));
    }
  }
  pos.needsUpdate = true;
  geo.setAttribute('rim', new THREE.BufferAttribute(rim, 1));
  // the piece's own thickness, which is what turns a distance measured flat on the drawing
  // into a distance measured along the curved surface it ended up on
  geo.userData.inRadius = R;
  geo.translate(0, 0, -mid);
  return smoothNormals(mirrorY(geo));
}

/**
 * Paints the drawn ink line onto the piece, along its own outline.
 *
 * The usual way to give a model a cartoon line is to wrap it in a copy of itself turned
 * inside out and made slightly bigger. That works on a smooth shape and fails on this one:
 * a ball of fur has a deep notch between every tuft, and in each notch the inflated copy
 * crosses back through the surface and scribbles over it.
 *
 * So the line is not a second object at all. Every vertex already knows how far it is from
 * the piece's outline, and the outline is exactly where the artist drew her line, so the
 * vertices within a line's width of it are simply painted navy. The line is therefore on
 * the surface, at the width the drawing gives it, and it cannot cross anything.
 */
export function inkRim(geo: THREE.BufferGeometry, ink: THREE.ColorRepresentation, width: number) {
  const rim = geo.getAttribute('rim');
  const n = geo.getAttribute('position').count;
  const far = new Float32Array(n);
  // the line fades out over its last third, which is what keeps it from looking like a
  // staircase where it runs across the triangles
  const w0 = width * 0.62;
  const w1 = width * 1.05;
  /**
   * Measured along the surface, not across the drawing.
   *
   * The piece is a dome, so near its rim the surface climbs steeply and a band of constant
   * width on the flat drawing covers a huge sweep of the finished surface — which is why
   * the line looked right from the front and turned into a wide black stripe the moment the
   * monster was turned. A point sitting `d` in from the rim of a dome of radius `R` is
   * sqrt(2Rd) away from the rim across the surface, and that is what the width is compared
   * against.
   */
  const R = (geo.userData.inRadius as number) || 0;
  for (let i = 0; i < n; i++) {
    const flat = rim ? rim.getX(i) : w1;
    far[i] = R > 0 ? Math.sqrt(2 * R * Math.max(0, flat)) : flat;
  }
  geo.setAttribute('rimd', new THREE.BufferAttribute(far, 1));
  geo.userData.inkLine = { w0, w1, ink: String(ink) };
  return geo;
}

/** Builds the SVG a set of drawn paths makes, so it can be read back as outlines. */
export function svgOf(paths: { d: string }[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg">${paths.map((q) => `<path d="${q.d}"/>`).join('')}</svg>`;
}

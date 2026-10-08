import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import Part3D from "../../components/Part3D";
import { MONSTRINHO_ROWS } from "../../components/monstrinho-rows";
import { MONSTER_BODY_LAYOUT, type SlotRect } from "./layout";
import rawLibrary from "./model-library.json";
import type { PartMap } from "../types";

const Fallback = lazy(() => import("./Monster3DFallback"));
type Row = "body" | "eyes" | "mouth" | "arms" | "legs";
type V3 = [number, number, number];
interface Asset {
  url: string;
  group: string;
  min: number[];
  max: number[];
  sourceBox: { x: number; y: number; w: number; h: number };
  surface?: { nx: number; ny: number; heights: number[] };
}
const library: Record<string, Asset> = rawLibrary;
const WORLD = 4.4 / 720;
const original: Record<Row, string> = {
  body: "round",
  eyes: "angry",
  mouth: "tongue",
  arms: "fuzzy",
  legs: "paws",
};
const rows: Row[] = ["body", "legs", "arms", "eyes", "mouth"];
const originalUrl = `${import.meta.env.BASE_URL}models/monstrinho.glb`;

/** Source cache is immutable. Each visible row owns materials and any bent geometry. */
function clonePart(scene: Group, names: string[]) {
  const result = new Group();
  const materials = new Map<Material, Material>();
  const geometries: BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  for (const name of names) {
    const src = scene.getObjectByName(name);
    if (!src) throw new Error(`Missing monster group: ${name}`);
    const node = src.clone(true);
    src.matrixWorld.decompose(node.position, node.quaternion, node.scale);
    node.updateMatrixWorld(true);
    node.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geometries.push(geo);
      o.geometry = geo;
      const own = (m: Material) => {
        if (!materials.has(m)) materials.set(m, m.clone());
        return materials.get(m)!;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(own)
        : own(o.material);
    });
    node.traverse((o) => {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
    });
    result.add(node);
  }
  return { root: result, materials: [...materials.values()], geometries };
}

/** The 2D eyebrows of the angry eyes; the model was made with dark orange ones. */
const BROW_PURPLE = "#5E30B0";

function meshesIn(node: Object3D | undefined, match = "") {
  const out: Mesh[] = [];
  node?.traverse((o) => {
    if (o instanceof Mesh && o.name.includes(match)) out.push(o);
  });
  return out;
}

function boxOf(meshes: Mesh[]) {
  const box = new Box3();
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!);
  }
  return box;
}

/**
 * Stretches a mesh about a point, keeping its shading: the normals take the inverse
 * stretch, as they must, instead of being worked out again from the new triangles.
 */
function stretch(geo: BufferGeometry, about: Vector3, s: Vector3, mirrorX = false) {
  const p = geo.attributes.position,
    n = geo.attributes.normal;
  const sx = mirrorX ? -s.x : s.x;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      about.x + (p.getX(i) - about.x) * sx,
      about.y + (p.getY(i) - about.y) * s.y,
      about.z + (p.getZ(i) - about.z) * s.z,
    );
    if (n) {
      const v = new Vector3(n.getX(i) / sx, n.getY(i) / s.y, n.getZ(i) / s.z).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
  }
  if (mirrorX) {
    // a mirror image is inside out: each triangle has to be wound the other way round
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i + 2 < idx.count; i += 3) {
        const a = idx.getX(i);
        idx.setX(i, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
      idx.needsUpdate = true;
    } else {
      for (const attr of Object.values(geo.attributes)) {
        for (let i = 0; i + 2 < attr.count; i += 3)
          for (let k = 0; k < attr.itemSize; k++) {
            const a = attr.getComponent(i, k);
            attr.setComponent(i, k, attr.getComponent(i + 2, k));
            attr.setComponent(i + 2, k, a);
          }
        attr.needsUpdate = true;
      }
    }
  }
  p.needsUpdate = true;
  if (n) n.needsUpdate = true;
  geo.computeBoundingBox();
}

/**
 * The angry eyes as they are drawn: round, with purple eyebrows.
 *
 * The modelled eyes came 8% taller than wide (their pupils 17%), so on the orange monster
 * they read as ovals beside the round eyes of every other option; and the eyebrows were
 * dark orange where the drawing has them purple. Each eye is pressed back to a circle about
 * its own middle, and the eyebrows come down by what the tops of the eyes moved, so they
 * still rest on them.
 */
function drawnEyes(root: Group, materials: Material[]) {
  let lowered = 0;
  for (const name of ["Olho_E", "Olho_D"]) {
    const eye = root.getObjectByName(name);
    const white = boxOf(meshesIn(eye, "Olhos_branco"));
    if (white.isEmpty()) continue;
    const size = white.getSize(new Vector3()),
      c = white.getCenter(new Vector3());
    const k = size.x / size.y;
    for (const m of meshesIn(eye)) stretch(m.geometry, c, new Vector3(1, k, 1));
    lowered = Math.max(lowered, ((1 - k) * size.y) / 2);
  }
  for (const m of meshesIn(root.getObjectByName("Sobrancelhas")))
    m.geometry.translate(0, -lowered, 0);
  for (const m of materials)
    if (m.name.startsWith("Sobrancelhas") && "color" in m)
      (m as Material & { color: { set: (c: string) => void } }).color.set(BROW_PURPLE);
}

/**
 * The 2D "tongue" mouth has two teeth; the model was made with one.
 *
 * The second is the first one mirrored across the mouth, then set as it is drawn: a little
 * narrower and shorter, and further from the middle. It hangs from the upper lip at its own
 * place, so it is lifted and brought forward by however much the lip is there.
 */
function secondTooth(root: Group, owned: BufferGeometry[]) {
  const tooth = root.getObjectByName("Dente");
  const lip = meshesIn(root.getObjectByName("Boca"), "Boca_amora")[0];
  const parts = meshesIn(tooth);
  if (!tooth || !lip || !parts.length) return;
  const mouth = boxOf([lip]),
    first = boxOf(parts);
  const mx = (mouth.min.x + mouth.max.x) / 2,
    tx = (first.min.x + first.max.x) / 2,
    top = first.max.y;
  const mirrored = 2 * mx - tx;
  // drawn: the left tooth 29 units from the middle, 32 wide and 23 tall; the right one 39, 22 and 19
  const target = mx + (mx - tx) * (39 / 29);
  const p = lip.geometry.attributes.position;
  /** The top edge of the mouth at a place across it, and how far forward it is there. */
  const edge = (x: number) => {
    let best = { y: -Infinity, z: 0 };
    for (let band = 0.006; best.y === -Infinity && band < 0.1; band *= 2)
      for (let i = 0; i < p.count; i++)
        if (Math.abs(p.getX(i) - x) < band && p.getY(i) > best.y)
          best = { y: p.getY(i), z: p.getZ(i) };
    return best;
  };
  const from = edge(mirrored),
    to = edge(target);
  for (const m of parts) {
    const geo = m.geometry.clone();
    stretch(geo, new Vector3(mx, top, 0), new Vector3(1, 1, 1), true);
    stretch(geo, new Vector3(mirrored, top, 0), new Vector3(22 / 32, 19 / 23, 1));
    geo.translate(target - mirrored, to.y - from.y, to.z - from.z);
    owned.push(geo);
    const copy = new Mesh(geo, m.material);
    copy.name = m.name.replace("Dente__", "Dente_D__");
    m.parent!.add(copy);
  }
}

/**
 * Where the stalk eyes stand on each body: how far the middle of the eyes is above the top
 * of the head, in eye widths.
 *
 * Measured off Clara's 2D pictures: held up above the head, on stalks that come out of the
 * top of it. On the orange one the head they stand on is his beige face, not his mane — she
 * asked for them "no topo do bege" after seeing them hang down his face from the top of the
 * mane, far bigger than on the others.
 */
const STALKS_ABOVE: Record<string, number> = {
  round: 0.9,
  egg: 1.2,
  square: 0.95,
  hourglass: 0.88,
};

/**
 * How far forward the stalks stand, in eye widths, beyond where they meet the front of the
 * head. Clara asked for the egg's and the hourglass's a little further forward.
 */
const STALKS_FORWARD: Record<string, number> = {
  egg: 0.25,
  hourglass: 0.25,
};

/**
 * Eye options made smaller than the room the sheet gives them, on the bodies where Clara
 * found them too big: the single eye covered most of every face and ran into the mouth, the
 * three eyes did the same on the hourglass, whose head is small for its body, and the stalk
 * eyes on the orange one came out a third bigger than on the other bodies.
 */
const EYE_SIZE: Record<string, Record<string, number>> = {
  one: { round: 0.75, egg: 0.75, square: 0.75, hourglass: 0.75 },
  multiple: { hourglass: 0.78 },
  stalks: { round: 0.76 },
};

/**
 * Eye options lifted on the bodies where they still ran into the mouth, as a share of their
 * own height. The hourglass has a small head with its mouth high on it: even made smaller,
 * the single eye and the three eyes overlapped the mouth by a sixth of their height.
 */
const EYE_LIFT: Record<string, Record<string, number>> = {
  one: { hourglass: 0.24 },
  multiple: { hourglass: 0.24 },
};

interface Head {
  /** The highest point of the head, in the scene's units. */
  top: number;
  /** The top of the head straight above a place across it. */
  topAt: (x: number) => number;
}

/**
 * The top of a body's head — the head itself, not the horns or antennae on it.
 *
 * On the orange monster that is his beige face, inside the mane; on the others it is the
 * widest solid piece that reaches highest (the egg is one piece; the square and the hourglass
 * have a separate head).
 */
function headOf(body: string, scene: Group): Head {
  scene.updateMatrixWorld(true);
  const all: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh) all.push(o);
  });
  let pieces: Mesh[];
  if (body === "round") pieces = all.filter((m) => m.name.startsWith("Rosto__"));
  else {
    const asset = library[body];
    const wide = all.filter((m) => {
      if (!m.name.endsWith("_solid")) return false;
      const b = new Box3().setFromObject(m);
      return b.max.x - b.min.x >= 0.4 * (asset.max[0] - asset.min[0]);
    });
    const tops = wide.map((m) => new Box3().setFromObject(m).max.y);
    pieces = wide.length ? [wide[tops.indexOf(Math.max(...tops))]] : all;
  }
  // from the model's own metres to the scene, the way the body row is placed
  let toScene: (v: Vector3) => Vector3;
  if (body === "round") {
    const s = stand();
    toScene = (v) => new Vector3(v.x * s.scale, v.y * s.scale + s.floor, v.z * s.scale);
  } else {
    const slot = MONSTER_BODY_LAYOUT[body].body,
      f = fit(library[body].min, library[body].max, slot);
    const px = (slot.cx - 300) * WORLD,
      py = (360 - slot.cy) * WORLD;
    toScene = (v) =>
      new Vector3(
        (v.x - f.center[0]) * f.scale + px,
        (v.y - f.center[1]) * f.scale + py,
        (v.z - f.center[2]) * f.scale,
      );
  }
  const points: Vector3[] = [];
  for (const m of pieces) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      points.push(toScene(new Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)));
  }
  const top = Math.max(...points.map((v) => v.y));
  const width = Math.max(...points.map((v) => v.x)) - Math.min(...points.map((v) => v.x));
  return {
    top,
    topAt: (x) => {
      let best = -Infinity;
      for (const v of points) if (Math.abs(v.x - x) < width * 0.03 && v.y > best) best = v.y;
      return best === -Infinity ? top : best;
    },
  };
}

function fit(min: number[], max: number[], slot: SlotRect) {
  const w = max[0] - min[0],
    h = max[1] - min[1];
  const scale = Math.min((slot.w * WORLD) / w, (slot.h * 2.2 * WORLD) / h);
  return { scale, center: min.map((v, i) => (v + max[i]) / 2) };
}

function stand() {
  const l = MONSTER_BODY_LAYOUT.round;
  const top = (360 - l.body.cy + l.body.h / 2) * WORLD;
  const floor = (360 - l.legs.cy - l.legs.h / 2) * WORLD;
  return { floor, scale: (top - floor) / 1.2 };
}
function slotFor(body: string, row: Row): SlotRect {
  const l = MONSTER_BODY_LAYOUT[body] ?? MONSTER_BODY_LAYOUT.round;
  if (body !== "round" || row === "body" || row === "arms" || row === "legs")
    return l[row];
  const r = MONSTRINHO_ROWS[row],
    s = stand();
  return {
    cx: 300 + (((r.min[0] + r.max[0]) / 2) * s.scale) / WORLD,
    cy: 360 - (((r.min[1] + r.max[1]) / 2) * s.scale + s.floor) / WORLD,
    w: ((r.max[0] - r.min[0]) * s.scale) / WORLD,
    h: ((r.max[1] - r.min[1]) * s.scale) / WORLD,
  };
}

/** Bilinear sampling of the surface ray-cast by the offline model generator. */
function skin(body: string, x: number, y: number) {
  const asset = library[body],
    surface = asset.surface!;
  const slot = MONSTER_BODY_LAYOUT[body].body,
    f = fit(asset.min, asset.max, slot);
  const originalStand = stand();
  const lx =
    body === "round"
      ? x / originalStand.scale
      : (x - (slot.cx - 300) * WORLD) / f.scale + f.center[0];
  const ly =
    body === "round"
      ? (y - originalStand.floor) / originalStand.scale
      : (y - (360 - slot.cy) * WORLD) / f.scale + f.center[1];
  const u = Math.max(
    0,
    Math.min(
      surface.nx - 1,
      ((lx - asset.min[0]) / (asset.max[0] - asset.min[0])) * (surface.nx - 1),
    ),
  );
  const v = Math.max(
    0,
    Math.min(
      surface.ny - 1,
      ((ly - asset.min[1]) / (asset.max[1] - asset.min[1])) * (surface.ny - 1),
    ),
  );
  const ix = Math.min(surface.nx - 2, Math.floor(u)),
    iy = Math.min(surface.ny - 2, Math.floor(v)),
    a = u - ix,
    b = v - iy;
  const at = (dx: number, dy: number) =>
    surface.heights[(iy + dy) * surface.nx + ix + dx];
  const height =
    (at(0, 0) * (1 - a) + at(1, 0) * a) * (1 - b) +
    (at(0, 1) * (1 - a) + at(1, 1) * a) * b;
  return body === "round"
    ? height * originalStand.scale
    : (height - f.center[2]) * f.scale;
}

function ModelPart({ row, id, body }: { row: Row; id: string; body: string }) {
  const native = id === original[row];
  const asset = library[id];
  const url = native ? originalUrl : `${import.meta.env.BASE_URL}${asset.url}`;
  const { scene } = useGLTF(url);
  // the body this piece is worn on, already loaded for the body row: stalk eyes stand on its head
  const bodyUrl =
    body === "round" ? originalUrl : `${import.meta.env.BASE_URL}${library[body].url}`;
  const { scene: bodyScene } = useGLTF(bodyUrl);
  const owned = useMemo(() => {
    const r = MONSTRINHO_ROWS[row];
    const names = native ? r.groups : [asset.group];
    const own = clonePart(scene, names);
    own.root.name = `monster-${row}-${id}`;
    // the original pieces, made to match their drawings on every body
    if (native && row === "eyes") drawnEyes(own.root, own.materials);
    if (native && row === "mouth") secondTooth(own.root, own.geometries);
    // Keep the approved original pose exactly as supplied, without re-fitting each row.
    if (body === "round" && native) {
      const s = stand();
      own.root.scale.setScalar(s.scale);
      own.root.position.y = s.floor;
      if (row === "eyes")
        for (const node of own.root.children) {
          const mid = [
            (r.min[0] + r.max[0]) / 2,
            (r.min[1] + r.max[1]) / 2,
            (r.min[2] + r.max[2]) / 2,
          ];
          node.position.set(
            ...(node.position
              .toArray()
              .map((v, i) => mid[i] + (v - mid[i]) * 0.82) as V3),
          );
          node.scale.multiplyScalar(0.82);
        }
      return own;
    }
    const slot = { ...slotFor(body, row) };
    // One eye keeps the diameter of one eye, rather than inheriting a pair's full width.
    if (row === "eyes" && id === "one") slot.w *= 0.68;
    if (row === "eyes" && id === "stalks") slot.w *= 0.9;
    const min = native ? r.min : asset.min,
      max = native ? r.max : asset.max;
    const f = fit(min, max, slot);
    if (row === "eyes") f.scale *= EYE_SIZE[id]?.[body] ?? 1;
    const px = (slot.cx - 300) * WORLD;
    let py = (360 - slot.cy) * WORLD;
    if (row === "eyes") py += (EYE_LIFT[id]?.[body] ?? 0) * (max[1] - min[1]) * f.scale;
    /** Stalk eyes: the head they stand on, and how wide one eye is in the scene. */
    let stalks: { head: Head; d: number } | null = null;
    if (row === "eyes" && id === "stalks") {
      const balls = ["Olho_1", "Olho_2"]
        .map((n) => boxOf(meshesIn(own.root.getObjectByName(n))))
        .filter((b) => !b.isEmpty());
      if (balls.length) {
        const eyeY = balls.reduce((a, b) => a + (b.min.y + b.max.y) / 2, 0) / balls.length;
        const d = (balls.reduce((a, b) => a + b.max.x - b.min.x, 0) / balls.length) * f.scale;
        const head = headOf(body, bodyScene);
        const now = (eyeY - f.center[1]) * f.scale + py;
        py += head.top + STALKS_ABOVE[body] * d - now;
        stalks = { head, d };
      }
    }
    const inner = new Group();
    inner.add(...[...own.root.children]);
    inner.position.set(-f.center[0], -f.center[1], -f.center[2]);
    own.root.add(inner);
    own.root.scale.setScalar(f.scale);
    own.root.position.set(px, py, 0);
    if (row === "eyes" || row === "mouth") {
      const at = (x: number, y: number) =>
        skin(
          body,
          px + (x - f.center[0]) * f.scale,
          py + (y - f.center[1]) * f.scale,
        ) / f.scale;
      if (native && row === "eyes") {
        // The supplied eyes contain a shear tailored to the original face. Undo it before
        // fitting each eye to the new surface; copying the shear makes square faces squint.
        /** How far forward each eye is carried, at any point of it. */
        const seat = new Map<string, { cx: number; lift: (x: number, y: number) => number }>();
        for (const name of ["Olho_E", "Olho_D"]) {
          const part = inner.getObjectByName(name);
          if (!part) continue;
          const c = boxOf(meshesIn(part)).getCenter(new Vector3());
          const step = 0.006;
          const dx = Math.max(
            -0.35,
            Math.min(
              0.35,
              (at(c.x + step, c.y) - at(c.x - step, c.y)) / (2 * step),
            ),
          );
          const dy = Math.max(
            -0.35,
            Math.min(
              0.35,
              (at(c.x, c.y + step) - at(c.x, c.y - step)) / (2 * step),
            ),
          );
          const lift = (x: number, y: number) =>
            -c.z +
            0.68 * (y - c.y) +
            0.22 * Math.sign(c.x) * (x - c.x) +
            at(c.x, c.y) +
            dx * (x - c.x) +
            dy * (y - c.y) +
            f.center[2] +
            0.02;
          seat.set(name, { cx: c.x, lift });
          raise(part, lift);
        }
        /*
         * The eyebrows go with the eyes, each half with the eye under it — the way they sit on
         * the orange monster, standing out over the top of each eye. Pressed onto the skin of
         * the forehead instead, they ended up behind the eyeballs on every other body, and only
         * a thin line showed, high above.
         */
        const left = seat.get("Olho_E"),
          right = seat.get("Olho_D");
        const brows = inner.getObjectByName("Sobrancelhas");
        if (brows && left && right) {
          const mid = (left.cx + right.cx) / 2;
          raise(brows, (x, y) => (x < mid ? left : right).lift(x, y));
        }
      } else if (native) {
        // Remove the curvature of the original host before seating the part on its new host.
        const s = stand();
        const transfer = (x: number, y: number) =>
          at(x, y) -
          skin("round", x * s.scale, y * s.scale + s.floor) / s.scale +
          f.center[2];
        bendObject(inner, transfer, own.geometries);
      } else if (row === "eyes" && stalks) {
        /*
         * Held up above the head: the stalks stand straight and go into the top of it, the way
         * Clara drew them. Each stalk reaches at least a quarter of an eye into the head where
         * it meets it — a domed head is lower to the sides of its top — and the pair stands
         * where the stalks meet the front of the head, a little sunk into it, or as far
         * forward of that as she asked for on each body.
         */
        const into = 0.25 * stalks.d;
        const forward = (STALKS_FORWARD[body] ?? 0) * stalks.d;
        const toScene = (v: number, i: 0 | 1) =>
          (v - f.center[i]) * f.scale + (i === 0 ? px : py);
        let depth = 0,
          count = 0,
          lineZ = 0;
        for (const line of meshesIn(inner, "_line")) {
          const b = boxOf([line]);
          const x = toScene((b.min.x + b.max.x) / 2, 0);
          const want = stalks.head.topAt(x) - into;
          if (toScene(b.min.y, 1) > want) {
            const wantLocal = (want - py) / f.scale + f.center[1];
            const k = (b.max.y - wantLocal) / (b.max.y - b.min.y);
            stretch(line.geometry, new Vector3(0, b.max.y, 0), new Vector3(1, k, 1));
          }
          depth += skin(body, x, want);
          lineZ += (b.min.z + b.max.z) / 2;
          count++;
        }
        if (count)
          own.root.position.z =
            depth / count - into + forward - (lineZ / count - f.center[2]) * f.scale;
      } else if (row === "eyes") {
        const holder = inner.children[0];
        // Seat each eye independently. The small forehead eye must not inherit the large eye's depth.
        for (const eye of holder.children) {
          if (eye.userData.attachment) {
            /*
             * Seated on the fullest bit of skin under it, not on the skin at its very middle.
             * An eye right at an edge — the top eye of three, at the top of the square head —
             * has its middle where the face turns back into the top of the head, and seated
             * there it sank behind the edge with half of it hidden.
             */
            const a = eye.userData.attachment as number[];
            const r = boxOf(meshesIn(eye)).getSize(new Vector3()).x / 2;
            const under = [
              [0, 0],
              [0, -0.6],
              [-0.5, -0.3],
              [0.5, -0.3],
            ].map(([u, v]) => at(a[0] + u * r, a[1] + v * r));
            eye.position.z += Math.max(...under);
          } else {
            // stalks/eyebrows follow the local skin, without changing their own thickness
            bendObject(eye, at, own.geometries);
          }
        }
      } else if (row === "mouth" && id !== "beak") {
        // A smile is a surface detail; conform it to the new host rather than floating a flat panel.
        bendObject(inner, at, own.geometries);
        inner.position.z = 0;
      } else {
        own.root.position.z =
          skin(body, px, py) +
          (row === "mouth" ? (max[2] - min[2]) * 0.22 * f.scale : 0);
      }
    }
    return own;
  }, [scene, bodyScene, row, id, body, native, asset]);
  useEffect(
    () => () => {
      owned.materials.forEach((m) => m.dispose());
      owned.geometries.forEach((g) => g.dispose());
    },
    [owned],
  );
  return <primitive object={owned.root} dispose={null} />;
}

/** Moves every point of a piece forward by an amount that depends on where it is. */
function raise(node: Object3D, by: (x: number, y: number) => number) {
  for (const m of meshesIn(node)) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + by(p.getX(i), p.getY(i)));
    p.needsUpdate = true;
    m.geometry.computeVertexNormals();
  }
}

function bendObject(
  node: Object3D,
  at: (x: number, y: number) => number,
  owned: BufferGeometry[],
  base = 0,
) {
  node.updateWorldMatrix(true, true);
  node.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const geo = o.geometry.clone();
    owned.push(geo);
    const p = geo.attributes.position;
    // Source groups have translation-only transforms; vertices stay in the asset's metre coordinates.
    for (let i = 0; i < p.count; i++)
      p.setZ(i, p.getZ(i) + at(p.getX(i), p.getY(i)) - base + 0.002);
    p.needsUpdate = true;
    geo.computeVertexNormals();
    o.geometry = geo;
  });
}

class IfModelLoads extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Monster3D({ parts }: { parts: PartMap }) {
  const body =
    parts.body && MONSTER_BODY_LAYOUT[parts.body] ? parts.body : "round";
  return (
    <group name="monster-model-library">
      {rows.map((row) => {
        const id = row === "body" ? body : parts[row];
        if (!id || (id !== original[row] && !library[id])) return null;
        const fallback = (
          <Suspense fallback={null}>
            <group name={`monster-fallback-${row}`}>
              <Fallback parts={{ ...parts, body }} onlyRow={row} />
            </group>
          </Suspense>
        );
        return (
          <Part3D key={row} id={row}>
            <IfModelLoads key={`${body}-${id}`} fallback={fallback}>
              <Suspense fallback={null}>
                <ModelPart row={row} id={id} body={body} />
              </Suspense>
            </IfModelLoads>
          </Part3D>
        );
      })}
    </group>
  );
}

import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
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
/**
 * The pieces taken from the orange monster's own model. His paws and his fuzzy arms used to
 * be among them; at Clara's asking both are now modelled from their drawings, like the other
 * legs and arms — the paws in green, the fuzzy arms furry and dark blue.
 */
const original: Partial<Record<Row, string>> = {
  body: "round",
  eyes: "angry",
  mouth: "tongue",
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

/**
 * Legs made bigger or smaller than the room the sheet gives them, keeping the feet on the
 * ground: the paws came out far too big on the egg and the round one and tiny on the
 * hourglass. The long legs fitted to each body's room came out of a different thickness on
 * each — much thicker on the egg, tiny on the hourglass — so they are brought to one
 * thickness on every body, a pair about 1.3 wide in the scene.
 */
const LEG_SIZE: Record<string, Record<string, number>> = {
  paws: { round: 0.8, egg: 0.8, hourglass: 1.55 },
  long: { round: 0.69, egg: 0.77, square: 1.53, hourglass: 2.6 },
  snake: { hourglass: 1.6 },
};

/**
 * How far the whole monster but his legs is lifted, as a share of the body's height, for a
 * body and the legs under it. The hourglass stands low over his legs: the long ones showed
 * only their feet, and Clara asked for him to be raised until the legs show.
 */
const LIFT_FOR_LEGS: Record<string, Record<string, number>> = {
  hourglass: { long: 0.13 },
};

/** How far legs come down below their place, as a share of the body's height. */
const LEG_DROP: Record<string, Record<string, number>> = {
  paws: { hourglass: 0.05 },
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

/**
 * The claw arms: each one set against the side of the body, and made bigger about the end
 * that meets it where Clara found them small. Fitted by the gap between the two arms, most of
 * each arm sat inside the orange and the purple body with only the hand showing, and on the
 * hourglass the hands were tiny and did not reach the body. At 1.25 the orange one's came out
 * out of proportion; set against his mane, his own size is enough.
 */
const CLAW_FIT: Record<string, number> = {
  round: 1,
  egg: 1,
  square: 1.3,
  hourglass: 1.7,
};

/**
 * The arms that are set against the side of the body, and how much bigger each is made about
 * the end that meets it. The octopus tentacles get the same treatment as the claw, so they
 * touch the body whatever its shape; drawn thin, they are made a little bigger in 3D.
 */
const ARM_FIT: Record<string, Record<string, number>> = {
  claw: CLAW_FIT,
  tentacle: { round: 1.1, egg: 1.15, square: 1.2, hourglass: 1.4 },
  // on the hourglass the pincher sat inside the body and did not show at all
  pincher: { round: 1, egg: 1.4, square: 1, hourglass: 1.4 },
  fuzzy: { round: 1, egg: 1.15, square: 1, hourglass: 1.4 },
};

/**
 * How far one kind of arm comes down the body, as a share of the body's height. On the square
 * the claw and the pincher met it high on the head; Clara asked for them a little lower.
 */
const ARM_LOWER: Record<string, Record<string, number>> = {
  claw: { square: 0.07 },
  pincher: { square: 0.07, egg: 0.06 },
  // Clara: the fuzzy arms a little higher on the egg, a little lower on the square
  fuzzy: { egg: -0.04, square: 0.04 },
};

/**
 * How far an arm is turned up and away from the body at the shoulder. On the hourglass the
 * hanging claw arm hung down past a waist narrower than the hips below, and the hand went
 * behind the hips; the pincher, pointing a little down, lay flat along the hips, stuck to
 * them — Clara wanted it off the body. Only the claw's hanging arm turns; both pinchers and both fuzzy arms do.
 */
const ARM_OPEN: Record<string, Record<string, number>> = {
  claw: { hourglass: (28 * Math.PI) / 180 },
  pincher: { hourglass: (15 * Math.PI) / 180 },
  // the fuzzy arm with its hand down lay along the hourglass's hips too
  fuzzy: { hourglass: (15 * Math.PI) / 180 },
};

/**
 * How far every arm comes down the body, as a share of the body's height. On the hourglass all
 * of them met it too high; Clara asked for them lower.
 */
const ARM_DROP: Record<string, number> = {
  hourglass: 0.1,
};

/**
 * The pieces that go in front of what hangs round a body rather than behind it, on each body.
 *
 * The egg's ears hang down the sides of his head to where the arms are; set in the middle of
 * the body, the arms went behind them and only the tip of a tentacle or the fingers of a claw
 * showed below an ear. In the drawing the arms are over the ears.
 *
 * The orange one's tentacles and snake legs were brought over his mane, coming out of the
 * cream of his face, and Clara did not like it at all: they go in the middle of his orange.
 */
const IN_FRONT: Record<string, string[]> = {
  egg: ["claw", "tentacle", "pincher", "fuzzy"],
};

/**
 * How far forward a piece must come to be clear of what hangs round the body, where they
 * cross: `lo` and `hi` are the corners of the piece in the scene.
 */
function clearOf(cover: Vector3[], lo: Vector3, hi: Vector3) {
  let front = -Infinity;
  for (const v of cover)
    if (v.x > lo.x && v.x < hi.x && v.y > lo.y && v.y < hi.y) front = Math.max(front, v.z);
  return Math.max(0, front + 0.01 - lo.z);
}

/**
 * The ears of a body, in the scene: the pieces that hang beside the head, narrow and well to
 * one side of the middle.
 */
function earsOf(body: string, scene: Group) {
  scene.updateMatrixWorld(true);
  const asset = library[body];
  const half = (asset.max[0] - asset.min[0]) / 2,
    mid = (asset.max[0] + asset.min[0]) / 2;
  const toScene = bodyToScene(body);
  const points: Vector3[] = [];
  scene.traverse((o) => {
    if (!(o instanceof Mesh) || !/_solid$/.test(o.name)) return;
    const w = new Box3().setFromObject(o);
    if (w.max.x - w.min.x >= 0.6 * half) return;
    if (Math.abs((w.min.x + w.max.x) / 2 - mid) < 0.5 * half) return;
    const q = o.geometry.attributes.position;
    for (let i = 0; i < q.count; i++)
      points.push(toScene(new Vector3().fromBufferAttribute(q, i).applyMatrix4(o.matrixWorld)));
  });
  return points;
}

/**
 * How much of the way to level each arm is turned at its shoulder, in 3D. The fuzzy arms are
 * drawn one waving up and one hanging down; in 3D both are brought most of the way to level,
 * and their shoulders to one height (`EVEN_SHOULDERS`). The drawing keeps its pose.
 */
const ARM_LEVEL: Record<string, number> = {
  fuzzy: 0.85,
};
const EVEN_SHOULDERS = new Set(["fuzzy"]);

/**
 * How far into the body the end of an arm goes, as a share of how thick that end is. Half is
 * enough for most; the plump fuzzy arms, set in that far, stood off the body when it turned.
 */
const ARM_INTO: Record<string, Record<string, number>> = {
  // on the round one and the hourglass that far in left only a stub of the lower arm showing
  fuzzy: { round: 0.6, egg: 1.1, square: 1.1, hourglass: 0.6 },
};

/**
 * The 2D monster's arms wiggle (rotating from -6° to 8° and back every 2.4 s) and his eyes
 * blink (squashed to an eighth of their height near the end of every 4.5 s). Clara asked for
 * the 3D one to do the same: the arms swing at their shoulders, the eyes squash about their
 * middle, on the same beat as the drawing.
 */
const WIGGLE = { period: 2.4, from: -6, to: 8 };
const BLINK = { period: 4.5, start: 0.92, shut: 0.95, squash: 0.12 };

/** Remembers where a row of eyes is, so it can blink about its own middle. */
function blinkAbout(root: Object3D) {
  root.updateMatrixWorld(true);
  const b = new Box3().setFromObject(root);
  root.userData.blink = {
    y: root.position.y,
    scale: root.scale.y,
    middle: (b.min.y + b.max.y) / 2,
  };
}

/** How open the eyes are, 1 to BLINK.squash, at a time in seconds. */
function eyesOpen(t: number) {
  const phase = (t % BLINK.period) / BLINK.period;
  if (phase < BLINK.start) return 1;
  const closing = phase < BLINK.shut;
  const k = closing
    ? (phase - BLINK.start) / (BLINK.shut - BLINK.start)
    : (1 - phase) / (1 - BLINK.shut);
  return 1 - k * (1 - BLINK.squash);
}

/**
 * How much wider the orange one's orange is made, so that it is round. His model's mane is
 * 0.85 wide and 0.96 tall; in the drawing he is a circle, and Clara asked for the 3D one
 * round too. His cream face is round already and stays as it is; the horns and the tuft of
 * hair on top move out with the mane.
 */
const ROUND_WIDEN = 0.96 / 0.85;

/** From a body model's own metres to the scene, the way the body row is placed. */
function bodyToScene(body: string): (v: Vector3) => Vector3 {
  if (body === "round") {
    const s = stand();
    // only his orange is measured through here, and it is made wider
    return (v) =>
      new Vector3(v.x * s.scale * ROUND_WIDEN, v.y * s.scale + s.floor, v.z * s.scale);
  }
  const slot = MONSTER_BODY_LAYOUT[body].body,
    f = fit(library[body].min, library[body].max, slot);
  const px = (slot.cx - 300) * WORLD,
    py = (360 - slot.cy) * WORLD;
  return (v) =>
    new Vector3(
      (v.x - f.center[0]) * f.scale + px,
      (v.y - f.center[1]) * f.scale + py,
      (v.z - f.center[2]) * f.scale,
    );
}

/**
 * How far the body reaches to each side at a given height, in the scene.
 *
 * Only the body itself counts — the torso and the head, or on the orange one his body and
 * mane — not the horns, antennae or ears.
 */
function sidesOf(body: string, scene: Group) {
  scene.updateMatrixWorld(true);
  const all: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh) all.push(o);
  });
  const pieces =
    body === "round"
      ? all.filter((m) => /^(Corpo|Juba)__/.test(m.name))
      : all.filter((m) => {
          if (!m.name.endsWith("_solid")) return false;
          const w = new Box3().setFromObject(m);
          const asset = library[body];
          return w.max.x - w.min.x >= 0.3 * (asset.max[0] - asset.min[0]);
        });
  const toScene = bodyToScene(body);
  const points: Vector3[] = [];
  for (const m of pieces) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      points.push(toScene(new Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)));
  }
  const ys = points.map((v) => v.y);
  const tall = Math.max(...ys) - Math.min(...ys);
  /*
   * Halfway between the front and the back of the whole body, as it looks from the side. On
   * the orange one that is the middle of his orange, without the cream face in front of it:
   * with the face, Clara found his tentacles and snake legs too far forward.
   */
  const zs = points.map((v) => v.z);
  const middle = (zs.reduce((a, b) => Math.min(a, b)) + zs.reduce((a, b) => Math.max(a, b))) / 2;
  /*
   * A thin slice at that very height. A thick one took in the widest part of the body nearby
   * — on the hourglass, its head — and an arm set against that floated beside the narrower
   * waist it was really at.
   */
  return (y: number) => {
    let left = Infinity,
      right = -Infinity;
    for (let band = tall * 0.006; left === Infinity && band < tall * 0.1; band *= 2)
      for (const v of points)
        if (Math.abs(v.y - y) < band) {
          left = Math.min(left, v.x);
          right = Math.max(right, v.x);
        }
    return { left, right, middle };
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
    if (row === "arms" && id === "claw")
      // the black outline round each hand; the little lines between the fingers stay
      for (const line of meshesIn(own.root, "_line"))
        if (boxOf([line]).getSize(new Vector3()).x > 0.1) line.removeFromParent();
    // Keep the approved original pose exactly as supplied, without re-fitting each row.
    if (body === "round" && native) {
      const s = stand();
      own.root.scale.setScalar(s.scale);
      own.root.position.y = s.floor;
      if (row === "body")
        for (const m of meshesIn(own.root)) {
          if (/^(Corpo|Juba)__/.test(m.name))
            stretch(m.geometry, new Vector3(), new Vector3(ROUND_WIDEN, 1, 1));
          else if (/^(Chifre|Topete)/.test(m.name)) {
            const x = boxOf([m]).getCenter(new Vector3()).x;
            m.geometry.translate(x * (ROUND_WIDEN - 1), 0, 0);
          }
        }
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
      if (row === "eyes") blinkAbout(own.root);
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
    const legSize = row === "legs" ? (LEG_SIZE[id]?.[body] ?? 1) : 1;
    if (legSize !== 1) {
      // resized about the soles, so the feet stay where the floor is
      py += (min[1] - f.center[1]) * f.scale * (1 - legSize);
      f.scale *= legSize;
    }
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
    const bodyH = MONSTER_BODY_LAYOUT[body].body.h * WORLD;
    if (row === "arms") py -= ((ARM_DROP[body] ?? 0) + (ARM_LOWER[id]?.[body] ?? 0)) * bodyH;
    if (row === "legs") py -= (LEG_DROP[id]?.[body] ?? 0) * bodyH;
    own.root.position.set(px, py, 0);
    if (row === "arms" && ARM_FIT[id]?.[body]) {
      /*
       * Each arm is made bigger about the end that meets the body, and that end is set just
       * inside the side of the body at its own height — so the whole arm shows, and both
       * arms touch the body whatever its shape.
       */
      const sides = sidesOf(body, bodyScene);
      const meshes = meshesIn(inner);
      const mid = boxOf(meshes).getCenter(new Vector3()).x;
      const k = ARM_FIT[id][body];
      const joints: Group[] = [];
      const cover = IN_FRONT[body]?.includes(id) ? earsOf(body, bodyScene) : null;
      // each arm, and the end of it that meets the body
      const found = ([-1, 1] as const).map((side) => {
        const arm = meshes.filter(
          (m) => (boxOf([m]).getCenter(new Vector3()).x - mid) * side > 0,
        );
        if (!arm.length) return null;
        const box = boxOf(arm);
        const endX = side < 0 ? box.max.x : box.min.x;
        const reach = (box.max.x - box.min.x) * 0.12;
        let lo = Infinity,
          hi = -Infinity;
        for (const m of arm) {
          const q = m.geometry.attributes.position;
          for (let i = 0; i < q.count; i++)
            if (Math.abs(q.getX(i) - endX) < reach) {
              lo = Math.min(lo, q.getY(i));
              hi = Math.max(hi, q.getY(i));
            }
        }
        return lo === Infinity ? null : { side, arm, box, endX, lo, hi };
      });
      /*
       * Arms whose shoulders go at one height: the fuzzy arms are drawn with one shoulder high
       * on the body and the other down by the legs, and in 3D Clara found one arm far too high
       * and the other far too low. Both go halfway between.
       */
      const even =
        EVEN_SHOULDERS.has(id) && found.every(Boolean)
          ? found.reduce((sum, one) => sum + (one!.lo + one!.hi) / 2, 0) / found.length
          : null;
      for (const one of found) {
        if (!one) continue;
        const { side, arm, box, endX } = one;
        let { lo, hi } = one;
        if (even !== null) {
          const dy = even - (lo + hi) / 2;
          for (const m of arm) m.geometry.translate(0, dy, 0);
          box.translate(new Vector3(0, dy, 0));
          lo += dy;
          hi += dy;
        }
        const end = new Vector3(endX, (lo + hi) / 2, 0);
        for (const m of arm) stretch(m.geometry, end, new Vector3(k, k, k));
        const level = ARM_LEVEL[id] ?? 0;
        if (level) {
          // turned at the shoulder towards level, by that share of the way
          const c = boxOf(arm).getCenter(new Vector3());
          const rise = Math.atan2(c.y - end.y, Math.abs(c.x - end.x));
          for (const m of arm)
            m.geometry
              .translate(-end.x, -end.y, 0)
              .rotateZ(-side * rise * level)
              .translate(end.x, end.y, 0);
        }
        // then opened out, turning about the shoulder (after the levelling, which would undo it)
        const open = ARM_OPEN[id]?.[body] ?? 0;
        if (open && (id !== "claw" || box.getCenter(new Vector3()).y < end.y))
          for (const m of arm)
            m.geometry
              .translate(-end.x, -end.y, 0)
              .rotateZ(side * open)
              .translate(end.x, end.y, 0);
        const y = (end.y - f.center[1]) * f.scale + py;
        const x = (end.x - f.center[0]) * f.scale + px;
        // the side of the body where it is narrowest across the end of the arm, so the whole
        // of that end goes into it and no gap shows above or below
        const half = ((hi - lo) / 2) * k * f.scale;
        const across = [-1, -0.5, 0, 0.5, 1].map((t) => sides(y + t * half));
        if (across.some((e) => !Number.isFinite(e.left))) continue;
        const edge = {
          left: Math.max(...across.map((e) => e.left)),
          right: Math.min(...across.map((e) => e.right)),
        };
        const into = (ARM_INTO[id]?.[body] ?? 0.5) * (hi - lo) * k * f.scale;
        const target = side < 0 ? edge.left + into : edge.right - into;
        // and halfway through the body from front to back, so the body cuts neither the front
        // nor the back of it — on the orange one the mane came across the tentacles' roots
        const depth = across[2].middle;
        const z = (boxOf(arm).getCenter(new Vector3()).z - f.center[2]) * f.scale;
        for (const m of arm) m.geometry.translate((target - x) / f.scale, 0, (depth - z) / f.scale);
        if (cover) {
          // in front of any ear the arm crosses, just clear of it
          const b = boxOf(arm);
          const toScene = (v: Vector3) =>
            new Vector3(
              (v.x - f.center[0]) * f.scale + px,
              (v.y - f.center[1]) * f.scale + py,
              (v.z - f.center[2]) * f.scale,
            );
          const forward = clearOf(cover, toScene(b.min), toScene(b.max));
          for (const m of arm) m.geometry.translate(0, 0, forward / f.scale);
        }
        // hung from a joint at the shoulder, so the arm can swing there
        const joint = new Group();
        joint.name = `arm-joint-${side < 0 ? "right" : "left"}`;
        joint.position.set(end.x + (target - x) / f.scale, end.y, 0);
        arm[0].parent!.add(joint);
        own.root.updateMatrixWorld(true);
        for (const m of arm) joint.attach(m);
        joints.push(joint);
      }
      own.root.userData.joints = joints;
    }
    if (row === "legs" && body === "round") {
      /*
       * The orange one is much deeper behind his face than in front of it, with the mane
       * round his back: legs under the middle of the model stood under his face. They go
       * halfway between the front and the back of his orange instead, and halfway between
       * the sides of it just above them: their place on the sheet is a little to his left.
       */
      const top = py + (max[1] - f.center[1]) * f.scale;
      const above = sidesOf(body, bodyScene)(top);
      own.root.position.x = (above.left + above.right) / 2;
      own.root.position.z = above.middle;
    }
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
        // the pink of the smile is a flat shape with no depth of its own: bent onto the skin it
        // lay exactly in it, and the face hid it on every body
        for (const mark of meshesIn(inner, "_mark")) mark.geometry.translate(0, 0, 0.004);
      } else {
        own.root.position.z =
          skin(body, px, py) +
          (row === "mouth" ? (max[2] - min[2]) * 0.22 * f.scale : 0);
      }
    }
    if (row === "eyes") blinkAbout(own.root);
    return own;
  }, [scene, bodyScene, row, id, body, native, asset]);
  // Written straight onto the objects every frame, never into React state.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const joints = owned.root.userData.joints as Group[] | undefined;
    if (joints) {
      const swing =
        (WIGGLE.from + WIGGLE.to) / 2 -
        ((WIGGLE.to - WIGGLE.from) / 2) * Math.cos((t / WIGGLE.period) * Math.PI * 2);
      // CSS turns clockwise for a positive angle, three.js the other way
      for (const joint of joints) joint.rotation.z = (-swing * Math.PI) / 180;
    }
    const blink = owned.root.userData.blink as
      | { y: number; scale: number; middle: number }
      | undefined;
    if (blink) {
      const open = eyesOpen(t);
      owned.root.scale.y = blink.scale * open;
      owned.root.position.y = blink.y + (blink.middle - blink.y) * (1 - open);
    }
  });
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
  const lift =
    (LIFT_FOR_LEGS[body]?.[parts.legs ?? ""] ?? 0) * MONSTER_BODY_LAYOUT[body].body.h * WORLD;
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
          <group key={row} position={[0, row === "legs" ? 0 : lift, 0]}>
            <Part3D id={row}>
              <IfModelLoads key={`${body}-${id}`} fallback={fallback}>
                <Suspense fallback={null}>
                  <ModelPart row={row} id={id} body={body} />
                </Suspense>
              </IfModelLoads>
            </Part3D>
          </group>
        );
      })}
    </group>
  );
}

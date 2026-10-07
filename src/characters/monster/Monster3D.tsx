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
  const owned = useMemo(() => {
    const r = MONSTRINHO_ROWS[row];
    const names = native ? r.groups : [asset.group];
    const own = clonePart(scene, names);
    own.root.name = `monster-${row}-${id}`;
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
    const f = fit(min, max, slot),
      px = (slot.cx - 300) * WORLD,
      py = (360 - slot.cy) * WORLD;
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
        for (const name of ["Olho_E", "Olho_D", "Sobrancelhas"]) {
          const part = inner.getObjectByName(name);
          if (!part) continue;
          const bounds = new Box3();
          part.traverse((o) => {
            if (o instanceof Mesh) {
              o.geometry.computeBoundingBox();
              bounds.union(o.geometry.boundingBox!);
            }
          });
          const c = bounds.getCenter(new Vector3());
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
          part.traverse((o) => {
            if (!(o instanceof Mesh)) return;
            const p = o.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
              const x = p.getX(i),
                y = p.getY(i),
                z = p.getZ(i);
              p.setZ(
                i,
                name === "Sobrancelhas"
                  ? at(x, y) + (z - c.z) * 0.35 + f.center[2] + 0.012
                  : z -
                      c.z +
                      0.68 * (y - c.y) +
                      0.22 * Math.sign(c.x) * (x - c.x) +
                      at(c.x, c.y) +
                      dx * (x - c.x) +
                      dy * (y - c.y) +
                      f.center[2] +
                      0.02,
              );
            }
            p.needsUpdate = true;
            o.geometry.computeVertexNormals();
          });
        }
      } else if (native) {
        // Remove the curvature of the original host before seating the part on its new host.
        const s = stand();
        const transfer = (x: number, y: number) =>
          at(x, y) -
          skin("round", x * s.scale, y * s.scale + s.floor) / s.scale +
          f.center[2];
        bendObject(inner, transfer, own.geometries);
      } else if (row === "eyes") {
        const holder = inner.children[0];
        // Seat each eye independently. The small forehead eye must not inherit the large eye's depth.
        for (const eye of holder.children) {
          if (eye.userData.attachment) {
            const a = eye.userData.attachment as number[];
            eye.position.z += at(a[0], a[1]);
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
  }, [scene, row, id, body, native, asset]);
  useEffect(
    () => () => {
      owned.materials.forEach((m) => m.dispose());
      owned.geometries.forEach((g) => g.dispose());
    },
    [owned],
  );
  return <primitive object={owned.root} dispose={null} />;
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

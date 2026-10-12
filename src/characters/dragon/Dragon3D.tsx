import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { ColorMap, PartMap } from '../types';
import { dragonColors } from './config';
import { dragonPlacement, type DragonMove } from './Dragon2D';
import { DRAGON_PIECES } from './parts';
import rawLibrary from './model-library.json';

/**
 * The dragon in 3D, assembled from the models of the four dragons Clara approved.
 *
 * Every piece was modelled from the same drawing the flat dragon is cut from
 * (art-source/dragon/model3d.mjs) and keeps its place in that drawing, so a piece is put on a
 * body exactly where the flat dragon puts it — through dragonPlacement, the flat dragon's own
 * sums. What 3D adds is depth:
 *
 *   the eyes sit on the front of the body, each eyeball pushed in a little, and the mouth is
 *   laid onto it point by point, so it follows the curve of whichever face wears it;
 *   the wings stand behind the body, swept back, and beat at the shoulder;
 *   the tail comes out from behind the body and wags;
 *   the eyes blink, as the flat dragon's do.
 *
 * Nothing here is dragged: like the monster, the 3D dragon is the finished creature the class
 * built on the sheet (see movable3d). The lids of the sleepy eyes are skin, and are painted
 * the colour of the body; a tail keeps its own colour on any body.
 */
interface PieceMeta {
  url: string;
  group: string;
  surface?: { step: number; nx: number; ny: number; heights: number[] };
  depth?: number;
  eyes?: { group: string; centre: [number, number] }[];
}
const LIB = rawLibrary as unknown as { unit: number; pieces: Record<string, PieceMeta> };
const U = LIB.unit;

function urlOf(row: string, id: string) {
  return `${import.meta.env.BASE_URL}${LIB.pieces[`${row}:${id}`].url}`;
}

/** From a point of a drawing to the model, and back. */
const toModel = (x: number, y: number): [number, number] => [(x - 260) * U, (620 - y) * U];
const fromModel = (X: number, Y: number): [number, number] => [X / U + 260, 620 - Y / U];

/** Puts a piece on the body: scaled by k about the drawing's origin, moved by (tx, ty). */
function place(obj: Group, m: DragonMove) {
  obj.scale.setScalar(m.k);
  obj.position.set((260 * m.k + m.tx - 260) * U, (620 - 620 * m.k - m.ty) * U, 0);
}

/** The front of a body, in drawing units, anywhere on its drawing (-1 off the body). */
function surfaceOf(body: string) {
  const s = LIB.pieces[`body:${body}`].surface!;
  return (x: number, y: number) => {
    const u = Math.max(0, Math.min(s.nx - 1.001, x / s.step));
    const v = Math.max(0, Math.min(s.ny - 1.001, y / s.step));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const a = u - i;
    const b = v - j;
    const at = (di: number, dj: number) => s.heights[(j + dj) * s.nx + i + di];
    return (at(0, 0) * (1 - a) + at(1, 0) * a) * (1 - b) + (at(0, 1) * (1 - a) + at(1, 1) * a) * b;
  };
}

/** A copy of a loaded model this dragon can change: its own materials and geometry. */
function own(scene: Group) {
  const root = scene.clone(true);
  const materials = new Map<Material, Material>();
  const geometries: BufferGeometry[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.geometry = o.geometry.clone();
    geometries.push(o.geometry);
    const copy = (m: Material) => {
      if (!materials.has(m)) materials.set(m, m.clone());
      return materials.get(m)!;
    };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  return { root, materials: [...materials.values()], geometries };
}

/** Paints the skin of a piece (an eyelid) the colour of the body. */
function tint(root: Group, colour: string) {
  root.traverse((o) => {
    if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && o.material.name === 'Skin') o.material.color.set(colour);
  });
}

/** Lays every point of a mesh onto the body: its z goes up by the body's front there. */
function layOn(mesh: Mesh, m: DragonMove, surface: (x: number, y: number) => number, lift = 0) {
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y] = fromModel(p.getX(i), p.getY(i));
    const s = Math.max(0, surface(x * m.k + m.tx, y * m.k + m.ty));
    p.setZ(i, p.getZ(i) + ((s + lift) * U) / m.k);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

/** Frees what a copy made for itself when the piece goes. */
function useDispose(made: { materials: Material[]; geometries: BufferGeometry[] }) {
  useEffect(
    () => () => {
      made.materials.forEach((m) => m.dispose());
      made.geometries.forEach((g) => g.dispose());
    },
    [made],
  );
}

/* ------------------------------------------------------------------- the pieces */

function Body({ body }: { body: string }) {
  const { scene } = useGLTF(urlOf('body', body));
  const made = useMemo(() => own(scene), [scene]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

/** How far (drawing units) lashes stand off the face, and how much more a brow tilts in 3D. */
const LASH_LIFT = 9;
const BROW_TILT = 0.22;

/** Turns a brow about its middle, its inner end down: the left brow one way, the right the other. */
function tilt(mesh: Mesh, angle: number) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new Vector3());
  g.translate(-c.x, -c.y, 0);
  g.rotateZ(c.x < 0 ? -angle : angle);
  g.translate(c.x, c.y, 0);
}

/** The eyes, each eyeball sunk a little into the front of the body; they blink. */
function Eyes({ id, body, move, skin }: { id: string; body: string; move: DragonMove; skin: string }) {
  const { scene } = useGLTF(urlOf('eyes', id));
  const made = useMemo(() => {
    const made = own(scene);
    tint(made.root, skin);
    const surface = surfaceOf(body);
    const balls = LIB.pieces[`eyes:${id}`].eyes ?? [];
    const groups = new Set<string>(balls.map((b) => b.group));
    // brows, lashes and lids outside the balls are laid on the face; the thin black lines (lashes,
    // a flick of liner) stand a little off it, as Clara asked, instead of looking painted on
    made.root.traverse((o) => {
      if (!(o instanceof Mesh) || (o.parent && groups.has(o.parent.name))) return;
      // in 3D a brow is tilted further down in the middle, so a brave face looks fiercer
      if (o.name.endsWith('_brow')) tilt(o, BROW_TILT);
      layOn(o, move, surface, o.name.endsWith('_line') ? LASH_LIFT : 1.5);
    });
    let middle = 0;
    for (const b of balls) {
      const g = made.root.getObjectByName(b.group);
      if (!g) continue;
      const [cx, cy] = b.centre;
      const s = Math.max(0, surface(cx * move.k + move.tx, cy * move.k + move.ty));
      const half = new Box3().setFromObject(g).getSize(new Vector3()).z / 2;
      // a third of the eyeball inside the head, the rest out in front of it
      g.position.z = (s * U) / move.k - half * 0.35;
      middle += toModel(cx, cy)[1] / balls.length;
    }
    const outer = new Group();
    outer.add(made.root);
    place(outer, move);
    outer.userData.blink = { y: outer.position.y, middle, k: move.k };
    return { ...made, outer };
  }, [scene, body, id, move, skin]);
  useDispose(made);
  useFrame(({ clock }) => {
    const b = made.outer.userData.blink as { y: number; middle: number; k: number };
    const phase = (clock.getElapsedTime() % 4.5) / 4.5;
    const open = phase < 0.92 ? 1 : phase < 0.95 ? 1 - ((phase - 0.92) / 0.03) * 0.88 : 1 - ((1 - phase) / 0.05) * 0.88;
    made.outer.scale.y = b.k * open;
    made.outer.position.y = b.y + b.middle * b.k * (1 - open);
  });
  return <primitive object={made.outer} dispose={null} />;
}

/** The mouth, laid onto the face; fire, bubbles and a tongue stand out from it. */
function Mouth({ id, body, move }: { id: string; body: string; move: DragonMove }) {
  const { scene } = useGLTF(urlOf('mouth', id));
  const made = useMemo(() => {
    const made = own(scene);
    const surface = surfaceOf(body);
    const core = DRAGON_PIECES[`mouth:${id}`].core!;
    const cx = (core[0] + core[2] / 2) * move.k + move.tx;
    const cy = (core[1] + core[3] / 2) * move.k + move.ty;
    const at = Math.max(0, surface(cx, cy));
    const out = ((at + 4) * U) / move.k;
    // the fire and each bubble move on their own, standing out from the mouth as one piece
    const movers: Object3D[] = [];
    made.root.traverse((o) => {
      if (o.name === 'Fire' || o.name === 'Tongue' || /^Bubble\d+$/.test(o.name)) movers.push(o);
    });
    for (const g of movers) g.position.z += out;
    // the fire's root comes to a thin point in 3D, which left a gap at the corner of the mouth:
    // it starts a little inside the mouth instead
    const fire = movers.find((g) => g.name === 'Fire');
    if (fire) fire.position.x -= 10 * U;
    made.root.traverse((o) => {
      if (!(o instanceof Mesh) || movers.includes(o.parent!)) return;
      if (o.name.endsWith('_solid')) o.position.z += out;
      // in front of the snout and cheeks painted on the face, which sit a little proud of it
      else layOn(o, move, surface, 4);
    });
    for (const g of movers) g.userData.rest = g.position.clone();
    // fire gives off its own light: lit only from outside, it looked like crumpled paper
    made.root.getObjectByName('Fire')?.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {
        o.material.emissive.copy(o.material.color);
        o.material.emissiveIntensity = 0.75;
      }
    });
    const outer = new Group();
    outer.add(made.root);
    place(outer, move);
    return { ...made, outer, movers };
  }, [scene, body, id, move]);
  useDispose(made);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    made.movers.forEach((g, i) => {
      const rest = g.userData.rest as Vector3;
      if (g.name === 'Fire') {
        // turned out towards us from the corner of the mouth, so it is a blast, not a sticker
        g.rotation.y = -0.4 + Math.sin(t * 2.6) * 0.06;
        g.children.forEach((m, n) => {
          if (m.name.endsWith('_ember')) {
            m.position.y = Math.sin(t * 4 + n) * 0.012;
            return;
          }
          // each layer flickers at its own pace, the hot middle fastest
          m.scale.set(1 + Math.sin(t * (9 + n * 3) + n) * 0.07, 1 + Math.sin(t * (11 + n * 3) + n * 2) * 0.09, 1);
        });
        return;
      }
      if (g.name === 'Tongue') {
        // a snake's tongue: every couple of seconds it flicks out and in a few times, wiggling
        const p = t % 2.4;
        const on = p < 0.9 ? Math.sin((p / 0.9) * Math.PI) : 0;
        g.scale.y = 0.75 + 0.25 * Math.abs(Math.sin(t * 18)) * on + 0.25 * (1 - on);
        g.rotation.z = Math.sin(t * 24) * 0.14 * on;
        return;
      }
      // bubbles bob up and down out of step, and wobble like soap
      const w = Math.sin(t * 3 + i * 1.7) * 0.05;
      g.position.set(rest.x, rest.y + Math.sin(t * 1.4 + i * 1.3) * 0.02, rest.z);
      g.scale.set(1 + w, 1 - w, 1 + w);
    });
  });
  return <primitive object={made.outer} dispose={null} />;
}

/** A wing or a tail on a hinge at its root, behind the body. */
function hinge(piece: Group, move: DragonMove, root: [number, number], z: number) {
  const outer = new Group();
  outer.add(piece);
  place(outer, move);
  const [rx, ry] = toModel(root[0] * move.k + move.tx, root[1] * move.k + move.ty);
  const pivot = new Group();
  pivot.position.set(rx, ry, z);
  outer.position.x -= rx;
  outer.position.y -= ry;
  pivot.add(outer);
  return pivot;
}

/**
 * How far (drawing units) the wings sit lower on a body in 3D than on the sheet: Clara wanted
 * them lower on the green one.
 */
const WING_DROP_3D: Record<string, number> = { classic: 24 };

/** The wings, swept back behind the body, beating at the shoulder. */
function Wings({ id, body, left, right }: { id: string; body: string; left: DragonMove; right: DragonMove }) {
  const { scene } = useGLTF(urlOf('wings', id));
  const made = useMemo(() => {
    const made = own(scene);
    const depth = LIB.pieces[`body:${body}`].depth ?? 100;
    const z = -0.2 * depth * U;
    const [rx, ry] = DRAGON_PIECES[`wings:${id}`].root!;
    const pair = new Group();
    const sides: Group[] = [];
    for (const [name, move, root, sweep] of [
      ['WingL', left, [rx, ry], -0.3],
      ['WingR', right, [520 - rx, ry], 0.3],
    ] as const) {
      const wing = made.root.getObjectByName(name);
      if (!wing) continue;
      const piece = new Group();
      piece.add(wing);
      const pivot = hinge(piece, move, root as [number, number], z);
      pivot.position.y -= (WING_DROP_3D[body] ?? 0) * U;
      pivot.rotation.y = sweep;
      pivot.userData.sweep = sweep;
      pair.add(pivot);
      sides.push(pivot);
    }
    pair.userData.sides = sides;
    return { ...made, pair };
  }, [scene, body, id, left, right]);
  useDispose(made);
  useFrame(({ clock }) => {
    const beat = Math.sin((clock.getElapsedTime() / 1.6) * Math.PI * 2) * 0.22;
    for (const side of made.pair.userData.sides as Group[]) side.rotation.y = side.userData.sweep * (1 + beat);
  });
  return <primitive object={made.pair} dispose={null} />;
}

/** The tail, from behind the body, wagging. */
function Tail({ id, body, move }: { id: string; body: string; move: DragonMove }) {
  const { scene } = useGLTF(urlOf('tail', id));
  const made = useMemo(() => {
    const made = own(scene);
    const depth = LIB.pieces[`body:${body}`].depth ?? 100;
    const pivot = hinge(made.root, move, DRAGON_PIECES[`tail:${id}`].root!, -0.25 * depth * U);
    const hearts: Mesh[] = [];
    made.root.traverse((o) => {
      if (o instanceof Mesh && o.name.endsWith('_heart')) hearts.push(o);
    });
    return { ...made, pivot, hearts };
  }, [scene, body, id, move]);
  useDispose(made);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    made.pivot.rotation.y = -0.35 + Math.sin((t / 1.8) * Math.PI * 2) * 0.15;
    // little hearts flying round the big one, each out of step
    made.hearts.forEach((h, i) => {
      h.position.y = Math.sin(t * 3.4 + i * 1.6) * 0.03;
      h.position.z = 0.03 + Math.cos(t * 2.2 + i) * 0.02;
    });
  });
  return <primitive object={made.pivot} dispose={null} />;
}

/** If a piece's file cannot load, that piece is left out and the rest still shows. */
class IfLoads extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Piece({ children, id }: { children: ReactNode; id: string }) {
  return (
    <IfLoads key={id}>
      <Suspense fallback={null}>{children}</Suspense>
    </IfLoads>
  );
}

export default function Dragon3D({ parts }: { parts: PartMap; colors?: ColorMap }) {
  // worked out again only when a piece changes: every piece rebuilds when its place does
  const { body, moves, twin } = useMemo(
    () => dragonPlacement(parts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts.body, parts.wings, parts.eyes, parts.mouth, parts.tail],
  );
  const skin = dragonColors(parts).skin;
  return (
    <group name="dragon-model">
      {parts.body && (
        <Piece id={`body-${body}`}>
          <Body body={body} />
        </Piece>
      )}
      {parts.wings && moves.wingL && moves.wingR && (
        <Piece id={`wings-${parts.wings}-${body}`}>
          <Wings id={parts.wings} body={body} left={moves.wingL} right={moves.wingR} />
        </Piece>
      )}
      {parts.tail && moves.tail && (
        <Piece id={`tail-${parts.tail}-${body}`}>
          <Tail id={parts.tail} body={body} move={moves.tail} />
        </Piece>
      )}
      {parts.eyes && moves.eyes && (
        <Piece id={`eyes-${parts.eyes}-${body}`}>
          <Eyes id={parts.eyes} body={body} move={moves.eyes} skin={skin} />
        </Piece>
      )}
      {parts.mouth && moves.mouth && (
        <Piece id={`mouth-${parts.mouth}-${body}`}>
          <Mouth id={parts.mouth} body={body} move={moves.mouth} />
        </Piece>
      )}
      {/* the red one's second head wears the same face, in a mirror down its middle: x = 0 is
          the middle of the drawing, so the mirror is a flip of x (see Dragon2D, TWIN_HEADS) */}
      {twin && (
        <group scale={[-1, 1, 1]}>
          {parts.eyes && moves.eyes && (
            <Piece id={`eyes2-${parts.eyes}-${body}`}>
              <Eyes id={parts.eyes} body={body} move={moves.eyes} skin={skin} />
            </Piece>
          )}
          {parts.mouth && moves.mouth && (
            <Piece id={`mouth2-${parts.mouth}-${body}`}>
              <Mouth id={parts.mouth} body={body} move={moves.mouth} />
            </Piece>
          )}
        </group>
      )}
    </group>
  );
}

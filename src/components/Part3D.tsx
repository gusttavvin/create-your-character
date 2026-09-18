import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { NEUTRAL, UNITS_PER_WORLD } from '../characters/types';
import { Layout3DContext } from './layout3d';

type Triple = [number, number, number];

function near(a: Triple, b: Triple) {
  return Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4 && Math.abs(a[2] - b[2]) < 1e-4;
}

/** The part's own box, in the group's local space (so our own offset does not count). */
function measure(group: THREE.Group, box: THREE.Box3) {
  box.makeEmpty();
  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const b = new THREE.Box3();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const gb = mesh.geometry.boundingBox;
    if (!gb) return;
    b.copy(gb).applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld));
    box.union(b);
  });
}

/**
 * One movable piece of a 3D character.
 *
 * It carries the category's offset and size from the layout the child built, and lets
 * them drag the piece straight on the model: the pointer moves it across the plane
 * facing the camera, so it follows the finger from whatever angle the model is turned to.
 * Distances are the sheet's own units, so nudging a piece in 2D moves it by the same
 * fraction of the character here.
 */
export default function Part3D({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(Layout3DContext);
  const t = ctx?.layout[id] ?? NEUTRAL;
  const inner = useRef<THREE.Group>(null);
  const box = useRef(new THREE.Box3());
  const [centre, setCentre] = useState<Triple>([0, 0, 0]);
  const [size, setSize] = useState<Triple>([0, 0, 0]);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { enabled?: boolean; autoRotate?: boolean } | null;

  // the piece grows and shrinks around itself, not around the character's feet
  useLayoutEffect(() => {
    const g = inner.current;
    if (!g) return;
    measure(g, box.current);
    const b = box.current;
    const c: Triple = b.isEmpty() ? [0, 0, 0] : [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2];
    const s: Triple = b.isEmpty() ? [0, 0, 0] : [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    if (!near(c, centre)) setCentre(c);
    if (!near(s, size)) setSize(s);
  });

  const editable = !!ctx?.editable;
  const picked = editable && ctx?.selected === id;
  const empty = size[0] <= 0 && size[1] <= 0 && size[2] <= 0;

  const start = (e: ThreeEvent<PointerEvent>) => {
    if (!editable || empty) return;
    e.stopPropagation();
    ctx?.onSelect?.(id);

    const g = inner.current;
    if (!g) return;
    const anchor = new THREE.Vector3(...centre);
    g.localToWorld(anchor);
    const dist = Math.max(0.5, camera.position.distanceTo(anchor));
    const fov = ((camera as THREE.PerspectiveCamera).fov ?? 40) * (Math.PI / 180);
    const perPx = (2 * Math.tan(fov / 2) * dist) / viewport.height;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    const startX = e.nativeEvent.clientX;
    const startY = e.nativeEvent.clientY;
    const base = { dx: t.dx, dy: t.dy, dz: t.dz ?? 0 };
    const wasRotating = controls?.autoRotate;
    if (controls) {
      controls.enabled = false; // the model holds still while the piece is dragged
      controls.autoRotate = false;
    }

    const world = new THREE.Vector3();
    const move = (ev: PointerEvent) => {
      const px = (ev.clientX - startX) * perPx;
      const py = (ev.clientY - startY) * perPx;
      world.set(0, 0, 0).addScaledVector(right, px).addScaledVector(up, -py);
      ctx?.onMove?.(
        id,
        base.dx + world.x * UNITS_PER_WORLD,
        base.dy - world.y * UNITS_PER_WORLD, // the sheet counts y downwards
        base.dz + world.z * UNITS_PER_WORLD,
      );
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (controls) {
        controls.enabled = true;
        controls.autoRotate = wasRotating;
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  // the pink box that shows which piece is picked: just the twelve edges, no diagonals
  const frame = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0] + 0.12, size[1] + 0.12, size[2] + 0.12)),
    [size],
  );
  useEffect(() => () => frame.dispose(), [frame]);

  const off: Triple = [(t.dx / UNITS_PER_WORLD), (-t.dy / UNITS_PER_WORLD), ((t.dz ?? 0) / UNITS_PER_WORLD)];
  const k = 1 - t.s;

  return (
    <group
      name={`part:${id}`}
      position={[centre[0] * k + off[0], centre[1] * k + off[1], centre[2] * k + off[2]]}
      scale={t.s}
      onPointerDown={editable ? start : undefined}
    >
      <group ref={inner}>{children}</group>
      {picked && !empty && (
        <lineSegments position={centre} geometry={frame} raycast={() => {}} renderOrder={999}>
          <lineBasicMaterial color="#ff8fc8" transparent opacity={0.95} depthTest={false} />
        </lineSegments>
      )}
    </group>
  );
}

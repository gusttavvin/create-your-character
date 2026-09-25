import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { NEUTRAL, UNITS_PER_WORLD } from '../characters/types';
import { Layout3DContext } from './layout3d';

/** The blue the 2D sheet glows with when a piece is picked (--sky). */
const PICKED = new THREE.Color('#2bb3ff');

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
 * Picking a piece up and dragging it over the character: up, down and sideways on her,
 * never towards or away from her. The camera turns round the model, and a drag across
 * the screen from an angle used to push the piece into or out of her as well, which
 * cannot be seen from the front: seen from the side, the dress hung in front of her.
 * So the finger is followed on the upright plane through the piece that faces the
 * character's front, and the piece stays the same depth on her. Shared by the pieces built from
 * shapes (Part3D) and by the modelled characters, whose pieces are groups in a GLB.
 *
 * Returns a pointer-down handler: give it the row the piece belongs to and the point, in
 * world space, the piece moves about.
 */
export function useDragPart() {
  const ctx = useContext(Layout3DContext);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const canvas = useThree((s) => s.gl.domElement);
  const controls = useThree((s) => s.controls) as { enabled?: boolean; autoRotate?: boolean } | null;

  return (e: ThreeEvent<PointerEvent>, id: string, anchor: THREE.Vector3) => {
    if (!ctx?.editable) return;
    e.stopPropagation();
    ctx.onSelect?.(id);

    const t = ctx.layout[id] ?? NEUTRAL;
    const dist = Math.max(0.5, camera.position.distanceTo(anchor));
    const fov = ((camera as THREE.PerspectiveCamera).fov ?? 40) * (Math.PI / 180);
    const perPx = (2 * Math.tan(fov / 2) * dist) / viewport.height;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    const startX = e.nativeEvent.clientX;
    const startY = e.nativeEvent.clientY;
    const base = { dx: t.dx, dy: t.dy };

    // where the finger meets the plane the piece moves on
    const rect = canvas.getBoundingClientRect();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -anchor.z);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitAt = (x: number, y: number, out: THREE.Vector3) => {
      ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, out);
    };
    // looked at nearly edge-on (from her side) that plane is a thin line and the
    // finger's point on it runs off to infinity: there the move across the screen is
    // taken as it is, less the part of it that goes into her
    const facing = Math.abs(camera.getWorldDirection(new THREE.Vector3()).z) > 0.3;
    const from = new THREE.Vector3();
    const onPlane = facing && !!hitAt(startX, startY, from);
    const to = new THREE.Vector3();
    const wasRotating = controls?.autoRotate;
    if (controls) {
      controls.enabled = false; // the model holds still while the piece is dragged
      controls.autoRotate = false;
    }

    const world = new THREE.Vector3();
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // a tap only picks the piece up; it takes a real movement to shift it
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;
      if (onPlane && hitAt(ev.clientX, ev.clientY, to)) world.subVectors(to, from);
      else world.set(0, 0, 0).addScaledVector(right, dx * perPx).addScaledVector(up, -dy * perPx);
      ctx.onMove?.(id, base.dx + world.x * UNITS_PER_WORLD, base.dy - world.y * UNITS_PER_WORLD, 0);
    };
    const stop = (ev: PointerEvent) => {
      // a quick flick can end before the browser sends a single move, so the
      // piece lands where the finger was lifted rather than not moving at all
      if (ev.type === 'pointerup') move(ev);
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
}

/**
 * One movable piece of a 3D character.
 *
 * It carries the category's offset and size from the layout the child built, and lets
 * them drag the piece straight on the model: the pointer moves it across the plane
 * facing the camera, so it follows the finger from whatever angle the model is turned to.
 * Distances are the sheet's own units, so nudging a piece in 2D moves it by the same
 * fraction of the character here.
 *
 * The piece is measured so that it grows around itself rather than around the
 * character's feet. That measurement is written straight onto the group instead of
 * into React state: parts that animate (the dragon's flame, the fairy's sparkles) change
 * size every frame, and a measurement kept in state would ask React to render again on
 * every one of them, which ends in a render loop and a blank page.
 */
export default function Part3D({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(Layout3DContext);
  const t = ctx?.layout[id] ?? NEUTRAL;
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const box = useRef(new THREE.Box3());
  const centre = useRef(new THREE.Vector3());
  const spun = useRef(new THREE.Vector3());
  /** False while the category is erased: nothing to pick up or drag. */
  const solid = useRef(false);
  const editable = !!ctx?.editable;
  const picked = editable && ctx?.selected === id;

  useLayoutEffect(() => {
    const g = inner.current;
    const o = outer.current;
    if (!g || !o) return;
    measure(g, box.current);
    solid.current = !box.current.isEmpty();
    if (solid.current) box.current.getCenter(centre.current);
    else centre.current.set(0, 0, 0);

    // final = centre + turn * size * (p - centre) + offset, so the piece grows and
    // turns about itself and then moves to where the child dropped it
    o.rotation.set(0, 0, ((t.r ?? 0) * Math.PI) / -180);
    o.scale.setScalar(t.s);
    spun.current.copy(centre.current).multiplyScalar(t.s).applyEuler(o.rotation);
    o.position.set(
      centre.current.x - spun.current.x + t.dx / UNITS_PER_WORLD,
      centre.current.y - spun.current.y - t.dy / UNITS_PER_WORLD, // the sheet counts y downwards
      centre.current.z - spun.current.z, // pieces stay on her; an old saved depth is ignored
    );
  });

  // a picked piece is ringed in blue, the same hint the drawing gives on the sheet:
  // the ink outline it already wears simply changes colour and thickens
  useLayoutEffect(() => {
    const g = inner.current;
    if (!g || !picked) return;
    const undo: (() => void)[] = [];
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.ShaderMaterial | undefined;
      if (!mesh.isMesh || !mat?.uniforms?.color || !mat.uniforms.thickness) return;
      const wasColor = (mat.uniforms.color.value as THREE.Color).clone();
      const wasThick = mat.uniforms.thickness.value as number;
      (mat.uniforms.color.value as THREE.Color).copy(PICKED);
      mat.uniforms.thickness.value = wasThick * 2.4;
      undo.push(() => {
        (mat.uniforms.color.value as THREE.Color).copy(wasColor);
        mat.uniforms.thickness.value = wasThick;
      });
    });
    return () => undo.forEach((f) => f());
  });

  const drag = useDragPart();
  const start = (e: ThreeEvent<PointerEvent>) => {
    if (!editable || !solid.current || !inner.current) return;
    drag(e, id, inner.current.localToWorld(centre.current.clone()));
  };

  return (
    <group ref={outer} name={`part:${id}`} onPointerDown={editable ? start : undefined}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

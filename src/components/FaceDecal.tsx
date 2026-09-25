import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Decal } from '@react-three/drei';
import type * as THREE from 'three';
import { Layout3DContext } from './layout3d';
import { NEUTRAL, UNITS_PER_WORLD } from '../characters/types';

interface Props {
  tex: THREE.Texture | null;
  x?: number;
  y: number;
  z: number;
  size: number;
  /**
   * Faces printed on the same spot (cheeks, eyes, mouth) are exactly coplanar, so the
   * order they paint in has to be stated or the renderer is free to pick, and an eye can
   * end up behind a cheek. Low numbers paint first.
   */
  order?: number;
  /**
   * The category this face belongs to. A painted face cannot be dragged like a piece of
   * geometry, but the child can still nudge and resize it from the buttons beside the
   * picture, and it slides across the head it is printed on.
   */
  part?: string;
}

/**
 * Projects a 2D face texture (PNG or rasterized SVG) onto the parent mesh.
 * Must be rendered as a child of a <mesh>. The material is flagged for a shader
 * rebuild after mount because the program is otherwise compiled before the map
 * is attached and the decal renders invisible.
 *
 * The face is depth-tested like everything else, so a pair of goggles or a visor covers
 * the eyes instead of the eyes showing straight through them; the polygon offset keeps
 * it clear of the surface it is printed on.
 */
export default function FaceDecal({ tex, x = 0, y, z, size, part, order = 1 }: Props) {
  const layout = useContext(Layout3DContext)?.layout;
  const t = (part && layout?.[part]) || NEUTRAL;
  const ox = x + t.dx / UNITS_PER_WORLD;
  const oy = y - t.dy / UNITS_PER_WORLD;
  const scaled = size * t.s;
  const ref = useRef<THREE.Mesh>(null);
  const probe = useRef<THREE.Object3D>(null);
  /**
   * A decal is cut out of the surface it lands on, so it can only be built once that
   * surface exists. Mounting it in the same breath as the mesh it belongs to threw and
   * took the whole page down with it — which is what turned the screen white in the
   * middle of a lesson — so it waits one frame and checks the surface is really there.
   */
  const [host, setHost] = useState<THREE.BufferGeometry | null>(null);
  useLayoutEffect(() => {
    const parent = probe.current?.parent as THREE.Mesh | undefined;
    const geo = parent?.geometry;
    const usable = geo && geo.attributes && geo.attributes.position ? geo : null;
    if (usable !== host) setHost(usable ?? null);
  });

  const refresh = () => {
    const m = ref.current?.material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mat) => {
      mat.needsUpdate = true;
    });
  };
  useLayoutEffect(refresh, [tex]);
  useEffect(refresh, [tex]);
  return (
    <>
      <object3D ref={probe} />
      {tex && host && (
        <Decal key={host.uuid} ref={ref} renderOrder={order} map={tex} position={[ox, oy, z]} rotation={[0, 0, ((t.r ?? 0) * Math.PI) / -180]} scale={[scaled, scaled, 1.2]}>
          <meshBasicMaterial
            map={tex}
            transparent
            polygonOffset
            polygonOffsetFactor={-4}
            depthWrite={false}
            toneMapped={false}
          />
        </Decal>
      )}
    </>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Decal } from '@react-three/drei';
import type * as THREE from 'three';

interface Props {
  tex: THREE.Texture | null;
  x?: number;
  y: number;
  z: number;
  size: number;
}

/**
 * Projects a 2D face texture (PNG or rasterized SVG) onto the parent mesh.
 * Must be rendered as a child of a <mesh>. The material is flagged for a shader
 * rebuild after mount because the program is otherwise compiled before the map
 * is attached and the decal renders invisible.
 */
export default function FaceDecal({ tex, x = 0, y, z, size }: Props) {
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
        <Decal key={host.uuid} ref={ref} map={tex} position={[x, y, z]} rotation={[0, 0, 0]} scale={[size, size, 1.2]}>
          <meshBasicMaterial
            map={tex}
            transparent
            polygonOffset
            polygonOffsetFactor={-4}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </Decal>
      )}
    </>
  );
}

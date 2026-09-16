import { useEffect, useLayoutEffect, useRef } from 'react';
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
  const refresh = () => {
    const m = ref.current?.material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mat) => {
      mat.needsUpdate = true;
    });
  };
  useLayoutEffect(refresh, [tex]);
  useEffect(refresh, [tex]);
  if (!tex) return null;
  return (
    <Decal ref={ref} map={tex} position={[x, y, z]} rotation={[0, 0, 0]} scale={[size, size, 1.2]}>
      <meshBasicMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-4} depthWrite={false} depthTest={false} toneMapped={false} />
    </Decal>
  );
}

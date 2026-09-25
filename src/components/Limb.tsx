import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import Ink from './Ink';

interface Props {
  /** Shoulder, elbow, wrist… in the character's own space. */
  pts: [number, number, number][];
  /** How thick the limb is. */
  r: number;
  /** Radius of the ball that closes the far end (a hand, a foot). */
  tip?: number;
  /** The material to paint it with, e.g. <Toon … />. */
  children: ReactNode;
}

/**
 * An arm or a leg drawn as one smooth limb.
 *
 * Limbs used to be a chain of capsules with a ball stuck on at every joint, which read
 * as a string of sausages rather than an arm. One bent tube, closed with a ball at each
 * end, bends at the elbow without coming apart.
 */
export default function Limb({ pts, r, tip, children }: Props) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), [pts]);
  const a = pts[0];
  const b = pts[pts.length - 1];
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 40, r, 14, false]} />
        {children}
        <Ink thin />
      </mesh>
      <mesh position={a}>
        <sphereGeometry args={[r, 18, 18]} />
        {children}
        <Ink thin />
      </mesh>
      <mesh position={b}>
        <sphereGeometry args={[tip ?? r, 20, 20]} />
        {children}
        <Ink thin />
      </mesh>
    </group>
  );
}

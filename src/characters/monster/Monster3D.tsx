import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { PartMap } from '../types';
import { MONSTER_COLORS } from './config';
import { INK3D, useGradientMap, useImageTexture } from '../../lib/three';


function Toon({ color, map }: { color: string; map: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={map} />;
}

/* ------------------------------------------------------------------ body */

interface FaceSpec {
  eyeY: number;
  mouthY: number;
  z: number; // front surface z at face height
  halfW: number; // where arms attach
  armY: number;
  bottom: number; // where legs attach
}

function useMouthDecal(mouth: string) {
  return useImageTexture(`/assets/monster/parts/mouth/${mouth}.png`);
}

function Body({ kind, mouth, grad }: { kind: string; mouth: string; grad: THREE.DataTexture }) {
  const color = MONSTER_COLORS.body[kind] ?? '#8BD43B';
  const tex = useMouthDecal(mouth);
  if (kind === 'egg') {
    return (
      <mesh position={[0, 0.35, 0]} scale={[0.9, 1.2, 0.9]}>
        <sphereGeometry args={[1, 48, 48]} />
        <Toon color={color} map={grad} />
        <Ink />
        <FaceDecal tex={tex} y={-0.25} z={1} size={0.75} />
      </mesh>
    );
  }
  if (kind === 'square') {
    return (
      <RoundedBox args={[2.1, 2.1, 1.7]} radius={0.4} smoothness={6} position={[0, 0.35, 0]}>
        <Toon color={color} map={grad} />
        <Ink />
        <FaceDecal tex={tex} y={-0.3} z={0.85} size={0.9} />
      </RoundedBox>
    );
  }
  if (kind === 'hourglass') {
    return (
      <group>
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.78, 48, 48]} />
          <Toon color={color} map={grad} />
          <Ink />
          <FaceDecal tex={tex} y={-0.2} z={0.78} size={0.7} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.42, 0.5, 0.7, 32]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <sphereGeometry args={[0.92, 48, 48]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
      </group>
    );
  }
  // round (default)
  return (
    <mesh position={[0, 0.3, 0]} scale={[1.05, 1.05, 0.95]}>
      <sphereGeometry args={[1.05, 48, 48]} />
      <Toon color={color} map={grad} />
      <Ink />
      <FaceDecal tex={tex} y={-0.3} z={1.05} size={0.9} />
    </mesh>
  );
}

const FACES: Record<string, FaceSpec> = {
  round: { eyeY: 0.75, mouthY: 0, z: 1.0, halfW: 1.05, armY: 0.35, bottom: -0.65 },
  egg: { eyeY: 0.85, mouthY: 0, z: 0.88, halfW: 0.85, armY: 0.3, bottom: -0.75 },
  square: { eyeY: 0.75, mouthY: 0, z: 0.85, halfW: 1.02, armY: 0.35, bottom: -0.7 },
  hourglass: { eyeY: 1.2, mouthY: 0, z: 0.75, halfW: 0.88, armY: -0.3, bottom: -1.15 },
};

/* ------------------------------------------------------------------ eyes */

function Eyeball({ r, iris, pos, grad }: { r: number; iris: string; pos: [number, number, number]; grad: THREE.DataTexture }) {
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[r, 32, 32]} />
        <Toon color="#ffffff" map={grad} />
        <Ink thin />
      </mesh>
      <mesh position={[0, 0, r * 0.78]}>
        <sphereGeometry args={[r * 0.45, 24, 24]} />
        <meshToonMaterial color={iris} gradientMap={grad} />
      </mesh>
      <mesh position={[0, 0, r * 0.95]}>
        <sphereGeometry args={[r * 0.22, 16, 16]} />
        <meshBasicMaterial color={INK3D} />
      </mesh>
    </group>
  );
}

function Eyes({ kind, y, z, grad }: { kind: string; y: number; z: number; grad: THREE.DataTexture }) {
  if (kind === 'stalks') {
    return (
      <group>
        {[-0.38, 0.38].map((x) => (
          <group key={x} position={[x, y, z - 0.25]}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.09, 0.11, 0.8, 16]} />
              <Toon color={MONSTER_COLORS.eyes.stalks} map={grad} />
              <Ink thin />
            </mesh>
            <Eyeball r={0.27} iris="#111827" pos={[0, 0.85, 0]} grad={grad} />
          </group>
        ))}
      </group>
    );
  }
  if (kind === 'multiple') {
    return (
      <group>
        <Eyeball r={0.24} iris="#111827" pos={[-0.42, y + 0.1, z - 0.02]} grad={grad} />
        <Eyeball r={0.2} iris="#111827" pos={[0.05, y + 0.32, z - 0.04]} grad={grad} />
        <Eyeball r={0.24} iris="#111827" pos={[0.45, y - 0.05, z - 0.02]} grad={grad} />
      </group>
    );
  }
  if (kind === 'sleepy') {
    return (
      <group>
        {[-0.34, 0.34].map((x) => (
          <group key={x} position={[x, y, z - 0.05]}>
            <Eyeball r={0.3} iris="#111827" pos={[0, 0, 0]} grad={grad} />
            <mesh rotation={[0, 0, 0]} position={[0, 0.02, 0]}>
              <sphereGeometry args={[0.315, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <Toon color={MONSTER_COLORS.eyes.sleepy} map={grad} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  // one big eye
  return <Eyeball r={0.48} iris="#3AA0FF" pos={[0, y - 0.05, z - 0.1]} grad={grad} />;
}

/* ------------------------------------------------------------------ arms */

function Arm({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const color = MONSTER_COLORS.arms[kind] ?? '#8BD43B';
  if (kind === 'tentacle') {
    const curve = useMemo(
      () =>
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.15, 0.4, 0.05),
          new THREE.Vector3(0.05, 0.8, 0.1),
          new THREE.Vector3(0.35, 1.15, 0.05),
          new THREE.Vector3(0.7, 1.35, 0),
        ]),
      [],
    );
    return (
      <mesh>
        <tubeGeometry args={[curve, 40, 0.16, 16, false]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
    );
  }
  if (kind === 'pincher') {
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.9, 16]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.16, 1.05, 0]} rotation={[0, 0, s * 0.35]}>
            <torusGeometry args={[0.22, 0.09, 12, 24, Math.PI * 0.9]} />
            <Toon color={color} map={grad} />
            <Ink />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'fuzzy') {
    const tufts = useMemo(() => {
      const arr: [number, number, number, number][] = [];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 * 3;
        const y = 0.1 + (i / 26) * 0.9;
        arr.push([Math.cos(a) * 0.16, y, Math.sin(a) * 0.16, a]);
      }
      return arr;
    }, []);
    return (
      <group>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.17, 0.2, 1.0, 16]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
        {tufts.map(([x, y, z, a], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, -a]}>
            <coneGeometry args={[0.05, 0.16, 6]} />
            <meshToonMaterial color={color} gradientMap={grad} />
          </mesh>
        ))}
        {[-0.18, 0, 0.18].map((x) => (
          <mesh key={x} position={[x, 1.1, 0]} rotation={[0, 0, x * 1.4]}>
            <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
        ))}
      </group>
    );
  }
  // claw
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1.0, 16]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {[-0.5, 0, 0.5].map((r) => (
        <mesh key={r} position={[Math.sin(r) * 0.22, 1.12 + Math.cos(r) * 0.05, 0]} rotation={[0, 0, -r]}>
          <capsuleGeometry args={[0.055, 0.28, 4, 8]} />
          <Toon color={color} map={grad} />
          <Ink thin />
        </mesh>
      ))}
    </group>
  );
}

function Arms({ kind, halfW, y, grad }: { kind: string; halfW: number; y: number; grad: THREE.DataTexture }) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const w = Math.sin(t * 2.2) * 0.12;
    if (l.current) l.current.rotation.z = 0.9 + w;
    if (r.current) r.current.rotation.z = -0.9 - w;
  });
  return (
    <group>
      <group ref={r} position={[halfW - 0.1, y, 0]} rotation={[0, 0, -0.9]}>
        <Arm kind={kind} grad={grad} />
      </group>
      <group ref={l} position={[-halfW + 0.1, y, 0]} rotation={[0, 0, 0.9]} scale={[-1, 1, 1]}>
        <Arm kind={kind} grad={grad} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ legs */

function Leg({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const color = MONSTER_COLORS.legs[kind] ?? '#A97CF1';
  if (kind === 'bird') {
    return (
      <group>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.9, 12]} />
          <Toon color={color} map={grad} />
          <Ink thin />
        </mesh>
        {[-0.5, 0, 0.5].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.2, -0.9, Math.cos(a) * 0.2]} rotation={[Math.PI / 2 - 0.1, 0, -a]}>
            <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'thick') {
    return (
      <group>
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.8, 16]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
        <mesh position={[0, -0.85, 0.12]} scale={[1, 0.6, 1.5]}>
          <sphereGeometry args={[0.28, 24, 24]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
      </group>
    );
  }
  if (kind === 'snake') {
    const curve = useMemo(
      () =>
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.18, -0.3, 0),
          new THREE.Vector3(-0.15, -0.6, 0),
          new THREE.Vector3(0.15, -0.9, 0),
          new THREE.Vector3(-0.05, -1.1, 0),
        ]),
      [],
    );
    return (
      <mesh>
        <tubeGeometry args={[curve, 40, 0.12, 12, false]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
    );
  }
  // stubby
  return (
    <group>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.7, 16]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, -0.72, 0.14]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <Toon color={color} map={grad} />
          <Ink thin />
        </mesh>
      ))}
    </group>
  );
}

function Legs({ kind, bottom, grad }: { kind: string; bottom: number; grad: THREE.DataTexture }) {
  return (
    <group>
      <group position={[-0.45, bottom + 0.1, 0]}>
        <Leg kind={kind} grad={grad} />
      </group>
      <group position={[0.45, bottom + 0.1, 0]}>
        <Leg kind={kind} grad={grad} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Monster3D({ parts }: { parts: PartMap }) {
  const grad = useGradientMap();
  const face = FACES[parts.body] ?? FACES.round;
  return (
    <group position={[0, -0.2, 0]}>
      <Body kind={parts.body} mouth={parts.mouth} grad={grad} />
      <Eyes kind={parts.eyes} y={face.eyeY} z={face.z} grad={grad} />
      <Arms kind={parts.arms} halfW={face.halfW} y={face.armY} grad={grad} />
      <Legs kind={parts.legs} bottom={face.bottom} grad={grad} />
    </group>
  );
}

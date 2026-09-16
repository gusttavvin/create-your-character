import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { DRAGON, resolveDragonColors } from './config';
import { findOption } from '../types';
import { heartShape, polyShape, useGradientMap, useSvgTexture } from '../../lib/three';
import { shade } from '../../lib/color';


function Toon({ color, map }: { color: string; map: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={map} />;
}

interface Spec {
  headY: number; // centre of the face sphere
  headR: number;
  eyeY: number;
  mouthY: number;
  wingY: number;
  halfW: number;
  tailY: number;
  hornY: number;
}

const SPECS: Record<string, Spec> = {
  chubby: { headY: 0.95, headR: 0.72, eyeY: 0.12, mouthY: -0.28, wingY: 0.1, halfW: 0.95, tailY: -0.6, hornY: 1.55 },
  tall: { headY: 0.9, headR: 0.7, eyeY: 0.12, mouthY: -0.26, wingY: 0.2, halfW: 0.7, tailY: -0.7, hornY: 1.5 },
  spiky: { headY: 0.3, headR: 1.05, eyeY: 0.35, mouthY: -0.15, wingY: 0.2, halfW: 1.0, tailY: -0.6, hornY: 1.3 },
  round: { headY: 0.3, headR: 1.1, eyeY: 0.35, mouthY: -0.18, wingY: 0.2, halfW: 1.05, tailY: -0.6, hornY: 1.35 },
};

function Body({ kind, color, grad, eyesTex, mouthTex, spec }: { kind: string; color: string; grad: THREE.DataTexture; eyesTex: THREE.Texture | null; mouthTex: THREE.Texture | null; spec: Spec }) {
  const belly = shade(color, 0.45);
  const face = (
    <>
      <FaceDecal tex={eyesTex} y={spec.eyeY} z={spec.headR} size={spec.headR * 1.15} />
      <FaceDecal tex={mouthTex} y={spec.mouthY} z={spec.headR} size={spec.headR * 0.9} />
    </>
  );
  if (kind === 'chubby' || kind === 'tall') {
    const tall = kind === 'tall';
    return (
      <group>
        {/* torso */}
        <mesh position={[0, -0.35, 0]} scale={tall ? [0.85, 1.15, 0.85] : [1.15, 0.95, 1.0]}>
          <sphereGeometry args={[0.95, 48, 48]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
        <mesh position={[0, -0.4, tall ? 0.62 : 0.78]} scale={[0.7, 0.8, 0.35]}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshToonMaterial color={belly} gradientMap={grad} />
        </mesh>
        {/* head */}
        <mesh position={[0, spec.headY, 0]}>
          <sphereGeometry args={[spec.headR, 48, 48]} />
          <Toon color={color} map={grad} />
          <Ink />
          {face}
        </mesh>
        <Feet color={color} grad={grad} y={-1.2} />
      </group>
    );
  }
  // spiky / round: one big sphere with the face on it
  return (
    <group>
      <mesh position={[0, spec.headY, 0]}>
        <sphereGeometry args={[spec.headR, 48, 48]} />
        <Toon color={color} map={grad} />
        <Ink />
        {face}
      </mesh>
      <mesh position={[0, spec.headY - 0.45, spec.headR - 0.25]} scale={[0.75, 0.6, 0.35]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshToonMaterial color={belly} gradientMap={grad} />
      </mesh>
      {kind === 'spiky' &&
        [-1.1, -0.7, -0.3, 0.3, 0.7, 1.1].map((a) => (
          <mesh key={a} position={[Math.sin(a) * (spec.headR - 0.05), spec.headY + Math.cos(a) * (spec.headR - 0.05), -0.1]} rotation={[0, 0, -a]}>
            <coneGeometry args={[0.16, 0.5, 8]} />
            <Toon color={shade(color, -0.2)} map={grad} />
            <Ink />
          </mesh>
        ))}
      <Feet color={color} grad={grad} y={spec.headY - spec.headR + 0.05} />
    </group>
  );
}

function Feet({ color, grad, y }: { color: string; grad: THREE.DataTexture; y: number }) {
  return (
    <group>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, y, 0.2]} scale={[1, 0.55, 1.3]}>
          <sphereGeometry args={[0.3, 24, 24]} />
          <Toon color={shade(color, -0.12)} map={grad} />
          <Ink />
        </mesh>
      ))}
    </group>
  );
}

/* ----------------------------------------------------------------- wings */

const WING_SHAPES: Record<string, THREE.Shape> = {
  bat: polyShape([
    [0, 0.1],
    [0.5, 0.75],
    [1.3, 1.15],
    [1.05, 0.55],
    [1.35, 0.2],
    [0.95, 0.0],
    [1.05, -0.45],
    [0.4, -0.35],
    [0, -0.3],
  ]),
  feather: polyShape([
    [0, 0.1],
    [0.5, 0.75],
    [1.3, 1.1],
    [1.25, 0.7],
    [1.15, 0.4],
    [1.05, 0.1],
    [0.85, -0.2],
    [0.5, -0.4],
    [0, -0.3],
  ]),
  tiny: polyShape([
    [0, 0.05],
    [0.3, 0.4],
    [0.65, 0.5],
    [0.6, 0.2],
    [0.45, -0.15],
    [0, -0.2],
  ]),
  butterfly: polyShape([
    [0, 0.1],
    [0.4, 0.8],
    [1.1, 1.0],
    [1.3, 0.55],
    [1.0, 0.1],
    [1.2, -0.35],
    [0.9, -0.7],
    [0.4, -0.55],
    [0, -0.3],
  ]),
};

function Wings({ kind, color, grad, y, halfW }: { kind: string; color: string; grad: THREE.DataTexture; y: number; halfW: number }) {
  const shape = WING_SHAPES[kind] ?? WING_SHAPES.bat;
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const f = Math.sin(clock.getElapsedTime() * 4) * 0.35;
    if (l.current) l.current.rotation.y = -0.6 - f;
    if (r.current) r.current.rotation.y = 0.6 + f;
  });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), [shape]);
  return (
    <group position={[0, y, -0.35]}>
      <group ref={r} position={[halfW * 0.6, 0, 0]}>
        <mesh geometry={geo}>
          <meshToonMaterial color={color} gradientMap={grad} side={THREE.DoubleSide} />
          <Ink />
        </mesh>
      </group>
      <group ref={l} position={[-halfW * 0.6, 0, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={geo}>
          <meshToonMaterial color={color} gradientMap={grad} side={THREE.DoubleSide} />
          <Ink />
        </mesh>
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- horns */

function Horns({ kind, grad, y, r }: { kind: string; grad: THREE.DataTexture; y: number; r: number }) {
  if (kind === 'unicorn') {
    return (
      <mesh position={[0, y + 0.35, 0.1]} rotation={[0.25, 0, 0]}>
        <coneGeometry args={[0.16, 0.9, 12]} />
        <Toon color="#FFD93D" map={grad} />
        <Ink />
      </mesh>
    );
  }
  if (kind === 'curly') {
    return (
      <group>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * r * 0.55, y, 0]} rotation={[Math.PI / 2, 0, s * 0.3]}>
            <torusGeometry args={[0.28, 0.11, 12, 24, Math.PI * 1.5]} />
            <Toon color="#F2B266" map={grad} />
            <Ink />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'antlers') {
    return (
      <group>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * r * 0.5, y, 0]} rotation={[0, 0, -s * 0.35]}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 0.8, 8]} />
              <Toon color="#D9A066" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[s * 0.18, 0.55, 0]} rotation={[0, 0, -s * 1.0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.45, 8]} />
              <Toon color="#D9A066" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[-s * 0.14, 0.7, 0]} rotation={[0, 0, s * 0.9]}>
              <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
              <Toon color="#D9A066" map={grad} />
              <Ink thin />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  // pointy
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.5, y + 0.15, 0]} rotation={[0, 0, -s * 0.35]}>
          <coneGeometry args={[0.17, 0.7, 12]} />
          <Toon color="#FFE066" map={grad} />
          <Ink />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ tail */

function Tail({ kind, color, grad, y }: { kind: string; color: string; grad: THREE.DataTexture; y: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.getElapsedTime() * 3) * 0.25;
  });
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.2, -0.2, -0.6),
        new THREE.Vector3(0.6, -0.1, -1.1),
        new THREE.Vector3(1.0, 0.3, -1.4),
      ]),
    [],
  );
  const tip = curve.getPoint(1);
  const heart = useMemo(() => new THREE.ExtrudeGeometry(heartShape(0.35), { depth: 0.1, bevelEnabled: false }), []);
  const spikes = useMemo(() => [0.35, 0.55, 0.75].map((t) => ({ p: curve.getPoint(t), n: curve.getTangent(t) })), [curve]);
  return (
    <group ref={ref} position={[0, y, -0.4]}>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.17, 12, false]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {kind === 'heart' && (
        <mesh geometry={heart} position={[tip.x, tip.y + 0.1, tip.z]} rotation={[0, 0.6, 0]}>
          <Toon color="#FF6B78" map={grad} />
          <Ink />
        </mesh>
      )}
      {kind === 'fluffy' && (
        <group position={[tip.x, tip.y, tip.z]}>
          {[
            [0, 0, 0, 0.32],
            [0.2, 0.15, 0.1, 0.2],
            [-0.18, 0.18, -0.05, 0.2],
            [0.05, -0.2, 0.15, 0.2],
            [0.1, 0.05, -0.22, 0.18],
          ].map(([x, yy, z, rr], i) => (
            <mesh key={i} position={[x, yy, z]}>
              <sphereGeometry args={[rr, 20, 20]} />
              <Toon color="#FFF3C4" map={grad} />
              <Ink thin />
            </mesh>
          ))}
        </group>
      )}
      {(kind === 'arrow' || kind === 'spiky') && (
        <mesh position={[tip.x, tip.y + 0.05, tip.z]} rotation={[0, 0, 0.4]}>
          <coneGeometry args={[0.25, 0.5, 4]} />
          <Toon color={shade(color, -0.2)} map={grad} />
          <Ink />
        </mesh>
      )}
      {kind === 'spiky' &&
        spikes.map(({ p, n }, i) => (
          <mesh key={i} position={[p.x, p.y + 0.15, p.z]} rotation={[0, Math.atan2(n.x, n.z), 0]}>
            <coneGeometry args={[0.1, 0.32, 6]} />
            <Toon color={shade(color, -0.22)} map={grad} />
            <Ink thin />
          </mesh>
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Dragon3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveDragonColors(parts, colors);
  const spec = SPECS[parts.body] ?? SPECS.chubby;
  const EyesSvg = findOption(DRAGON, 'eyes', parts.eyes)?.Svg;
  const MouthSvg = findOption(DRAGON, 'mouth', parts.mouth)?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => (MouthSvg ? <MouthSvg colors={eff} /> : null), [MouthSvg]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);

  return (
    <group position={[0, -0.1, 0]}>
      <Tail kind={parts.tail} color={eff.body} grad={grad} y={spec.tailY} />
      <Wings kind={parts.wings} color={eff.wings} grad={grad} y={spec.wingY} halfW={spec.halfW} />
      <Body kind={parts.body} color={eff.body} grad={grad} eyesTex={eyesTex} mouthTex={mouthTex} spec={spec} />
      <Horns kind={parts.horns} grad={grad} y={spec.hornY} r={spec.headR} />
    </group>
  );
}

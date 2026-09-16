import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { DRAGON, resolveDragonColors } from './config';
import { findOption } from '../types';
import { leafShape, pickPart, polyShape, starShape, useGradientMap, usePatternTexture, useSvgTexture } from '../../lib/three';
import type { PatternKind } from '../../lib/three';
import { shade } from '../../lib/color';

/** Toon surface; a pattern texture carries the colour itself, so the tint goes white. */
function Toon({ color, map, tex }: { color: string; map: THREE.Texture; tex?: THREE.Texture | null }) {
  return <meshToonMaterial color={tex ? '#ffffff' : color} gradientMap={map} map={tex ?? null} />;
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

/** The drawn dragon is spotted with a paler, banded belly. */
const BODY_SKIN: PatternKind = 'spots';
const BELLY_SKIN: PatternKind = 'stripes';

const WING_SKIN: Record<string, PatternKind> = {
  bat: 'smooth',
  feather: 'fur',
  tiny: 'dots',
  butterfly: 'spots',
};

/* ------------------------------------------------------------------ fire */

/**
 * Real 3D fire: three nested cones pointing down +Z (orange shell, yellow
 * middle, white-hot core) plus a few small licks breaking away. Only the outer
 * shell is inked, so the flame keeps one clean cartoon edge from every angle.
 * The whole jet wobbles in scale and position so it flickers.
 */
function Flame({ grad, len = 1 }: { grad: THREE.DataTexture; len?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.scale.set(1 + Math.sin(t * 13.1) * 0.07, 1 + Math.sin(t * 9.3 + 1.1) * 0.06, 1 + Math.sin(t * 11.2 + 0.6) * 0.14);
    g.position.x = Math.sin(t * 7.5) * 0.03 * len;
    g.position.y = Math.sin(t * 6.1 + 2.0) * 0.025 * len;
    g.rotation.z = Math.sin(t * 5.2) * 0.09;
  });
  const shell = 1.55 * len;
  const mid = 1.15 * len;
  const core = 0.72 * len;
  return (
    <group ref={ref}>
      <mesh position={[0, 0, shell * 0.5 - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.36 * len, shell, 16]} />
        <meshToonMaterial color="#FF7A1A" gradientMap={grad} />
        <Ink />
      </mesh>
      <mesh position={[0, 0, mid * 0.5 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.24 * len, mid, 14]} />
        <meshToonMaterial color="#FFC400" gradientMap={grad} />
      </mesh>
      <mesh position={[0, 0, core * 0.5 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13 * len, core, 12]} />
        <meshBasicMaterial color="#FFF6D6" toneMapped={false} />
      </mesh>
      {([
        [0.2, 0.13, 0.95, 0.4],
        [-0.18, 0.17, 1.15, 0.34],
        [0.06, -0.19, 0.82, 0.3],
      ] as const).map(([x, y, z, h], i) => (
        <mesh key={i} position={[x * len, y * len, z * len]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08 * len, h * len, 10]} />
          <meshToonMaterial color="#FFB020" gradientMap={grad} />
        </mesh>
      ))}
    </group>
  );
}

/** The dark opening the fire shoots out of (the other three mouths stay decals). */
function OpenMouth({ grad, z }: { grad: THREE.DataTexture; z: number }) {
  return (
    <mesh position={[0, 0, z]} scale={[1, 0.7, 0.55]}>
      <sphereGeometry args={[0.27, 28, 28]} />
      <meshToonMaterial color="#5B1220" gradientMap={grad} />
      <Ink thin />
    </mesh>
  );
}

/* ------------------------------------------------------------------ body */

function Body({
  kind,
  color,
  grad,
  eyesTex,
  mouthTex,
  spec,
}: {
  kind: string | null;
  color: string;
  grad: THREE.DataTexture;
  eyesTex: THREE.Texture | null;
  mouthTex: THREE.Texture | null;
  spec: Spec;
}) {
  const belly = shade(color, 0.45);
  const skin = usePatternTexture({ base: color, pattern: BODY_SKIN, scale: 2 });
  const bellySkin = usePatternTexture({ base: belly, pattern: BELLY_SKIN, scale: 1.6 });
  if (!kind) return null;
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
          <Toon color={color} map={grad} tex={skin} />
          <Ink />
        </mesh>
        <mesh position={[0, -0.4, tall ? 0.62 : 0.78]} scale={[0.7, 0.8, 0.35]}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <Toon color={belly} map={grad} tex={bellySkin} />
        </mesh>
        {/* head */}
        <mesh position={[0, spec.headY, 0]}>
          <sphereGeometry args={[spec.headR, 48, 48]} />
          <Toon color={color} map={grad} tex={skin} />
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
        <Toon color={color} map={grad} tex={skin} />
        <Ink />
        {face}
      </mesh>
      <mesh position={[0, spec.headY - 0.45, spec.headR - 0.25]} scale={[0.75, 0.6, 0.35]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <Toon color={belly} map={grad} tex={bellySkin} />
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

function Wings({ kind, color, grad, y, halfW }: { kind: string | null; color: string; grad: THREE.DataTexture; y: number; halfW: number }) {
  const shape = WING_SHAPES[kind ?? ''] ?? WING_SHAPES.bat;
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const f = Math.sin(clock.getElapsedTime() * 4) * 0.35;
    if (l.current) l.current.rotation.y = -0.6 - f;
    if (r.current) r.current.rotation.y = 0.6 + f;
  });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), [shape]);
  const tex = usePatternTexture({ base: color, pattern: WING_SKIN[kind ?? ''] ?? 'smooth', scale: 1 });
  if (!kind) return null;
  const wing = (
    <mesh geometry={geo}>
      <meshToonMaterial color={tex ? '#ffffff' : color} gradientMap={grad} map={tex ?? null} side={THREE.DoubleSide} />
      <Ink />
    </mesh>
  );
  return (
    <group position={[0, y, -0.35]}>
      <group ref={r} position={[halfW * 0.6, 0, 0]}>
        {wing}
      </group>
      <group ref={l} position={[-halfW * 0.6, 0, 0]} scale={[-1, 1, 1]}>
        {wing}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- horns */

function Horns({ kind, grad, y, r }: { kind: string | null; grad: THREE.DataTexture; y: number; r: number }) {
  if (!kind) return null;
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

/** Small gem for the crystal tail. */
function Gem({ r, pos, color, grad, ink }: { r: number; pos: [number, number, number]; color: string; grad: THREE.DataTexture; ink?: boolean }) {
  return (
    <mesh position={pos} rotation={[r * 3, r * 7, r * 5]}>
      <octahedronGeometry args={[r, 0]} />
      <Toon color={color} map={grad} />
      {ink ? <Ink thin /> : null}
    </mesh>
  );
}

const TAIL_TIPS = ['fire', 'star', 'crystal', 'leaf'];

function Tail({ kind: raw, color, grad, y }: { kind: string | null; color: string; grad: THREE.DataTexture; y: number }) {
  // an id from before the tails were redesigned still gets a tip, not a stump
  const kind = raw === null ? null : TAIL_TIPS.includes(raw) ? raw : 'fire';
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
  const tip = useMemo(() => curve.getPoint(1), [curve]);
  /** Aims the tip decoration along the tail's direction of travel. */
  const tipQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(1).normalize()),
    [curve],
  );
  const trail = useMemo(() => [0.45, 0.72].map((t) => curve.getPoint(t)), [curve]);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.36, 0.15), { depth: 0.1, bevelEnabled: false }), []);
  const leaf = useMemo(() => new THREE.ExtrudeGeometry(leafShape(0.5), { depth: 0.07, bevelEnabled: false }), []);
  const skin = usePatternTexture({ base: color, pattern: BODY_SKIN, scale: 1.4 });
  if (!kind) return null;
  return (
    <group ref={ref} position={[0, y, -0.4]}>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.17, 12, false]} />
        <Toon color={color} map={grad} tex={skin} />
        <Ink />
      </mesh>

      {/* fire — the tip is a flame, aimed along the tail */}
      {kind === 'fire' && (
        <group position={[tip.x, tip.y, tip.z]} quaternion={tipQuat}>
          <Flame grad={grad} len={0.6} />
        </group>
      )}

      {/* star — a comet: a big five-pointed star with two smaller ones trailing */}
      {kind === 'star' && (
        <group>
          <mesh geometry={star} position={[tip.x, tip.y + 0.12, tip.z]} rotation={[0, 0.6, 0]}>
            <Toon color="#FFD93D" map={grad} />
            <Ink />
          </mesh>
          {trail.map((p, i) => (
            <mesh
              key={i}
              geometry={star}
              position={[p.x - 0.1, p.y + 0.3 - i * 0.06, p.z + 0.1]}
              rotation={[0, 0.6, i * 0.7]}
              scale={0.45 - i * 0.14}
            >
              <Toon color={i === 0 ? '#FFE98A' : '#FFF3C4'} map={grad} />
              <Ink thin />
            </mesh>
          ))}
        </group>
      )}

      {/* crystal — a cluster of angular gems */}
      {kind === 'crystal' && (
        <group position={[tip.x, tip.y, tip.z]}>
          <Gem r={0.34} pos={[0, 0.06, 0]} color="#7FE3FF" grad={grad} ink />
          <Gem r={0.19} pos={[0.24, -0.1, 0.12]} color="#B9F0FF" grad={grad} ink />
          <Gem r={0.16} pos={[-0.2, 0.22, -0.1]} color="#A77BFF" grad={grad} ink />
          <Gem r={0.13} pos={[0.04, -0.26, -0.18]} color="#E4E9F7" grad={grad} />
        </group>
      )}

      {/* leaf — a big leaf at the tip and small ones sprouting along the tail */}
      {kind === 'leaf' && (
        <group>
          <mesh geometry={leaf} position={[tip.x, tip.y + 0.2, tip.z]} rotation={[0.2, 0.6, 0.25]}>
            <Toon color="#7ED957" map={grad} />
            <Ink />
          </mesh>
          {trail.map((p, i) => (
            <mesh
              key={i}
              geometry={leaf}
              position={[p.x + (i ? 0.16 : -0.16), p.y + 0.22, p.z + (i ? -0.1 : 0.12)]}
              rotation={[0.3, i ? -0.9 : 0.9, i ? -0.8 : 0.8]}
              scale={0.5 - i * 0.1}
            >
              <Toon color={i === 0 ? '#9CE86F' : '#6FC94A'} map={grad} />
              <Ink thin />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Dragon3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveDragonColors(parts, colors);
  const body = pickPart(parts.body, 'chubby');
  const mouth = pickPart(parts.mouth, 'smile');
  const spec = SPECS[body ?? ''] ?? SPECS.chubby;
  const fire = mouth === 'fire';
  const EyesSvg = findOption(DRAGON, 'eyes', pickPart(parts.eyes, 'cute') ?? '')?.Svg;
  const MouthSvg = fire ? undefined : findOption(DRAGON, 'mouth', mouth ?? '')?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => (MouthSvg ? <MouthSvg colors={eff} /> : null), [MouthSvg]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);
  /** Front of the head sphere at mouth height — where the jaw opens. */
  const frontZ = Math.sqrt(Math.max(spec.headR * spec.headR - spec.mouthY * spec.mouthY, 0.04));

  return (
    <group position={[0, -0.1, 0]}>
      <Tail kind={pickPart(parts.tail, 'fire')} color={eff.body} grad={grad} y={spec.tailY} />
      <Wings kind={pickPart(parts.wings, 'bat')} color={eff.wings} grad={grad} y={spec.wingY} halfW={spec.halfW} />
      <Body kind={body} color={eff.body} grad={grad} eyesTex={eyesTex} mouthTex={mouthTex} spec={spec} />
      {fire && body && (
        <group position={[0, spec.headY + spec.mouthY, 0]}>
          <OpenMouth grad={grad} z={frontZ * 0.88} />
          <group position={[0, 0, frontZ * 0.95]}>
            <Flame grad={grad} len={0.9} />
          </group>
        </group>
      )}
      <Horns kind={pickPart(parts.horns, 'pointy')} grad={grad} y={spec.hornY} r={spec.headR} />
    </group>
  );
}

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { resolveSuperheroColors } from './config';
import { FaceEyes, FaceMouth, MaskEye } from './parts';
import {
  heartShape,
  pickPart,
  polyShape,
  starShape,
  useGradientMap,
  usePatternTexture,
  useSvgTexture,
} from '../../lib/three';
import type { PatternKind } from '../../lib/three';
import { shade } from '../../lib/color';

/**
 * The hero in 3D, built to the same skeleton as the drawing in `parts.tsx`.
 *
 * Everything hangs off a handful of landmarks so the pieces meet instead of
 * floating: head at y=1.15, shoulders at y=0.40, hands at y=-0.52, hips at
 * y=-0.45, ankles at y=-1.42 and the soles flat on the floor at y=-1.80.
 * Anything that comes in a pair is drawn once and reflected with <Pair>.
 */

const HEAD_Y = 1.15;
const HEAD_R = 0.62;
/** Right shoulder joint; the left one is this reflected. */
const SHOULDER: [number, number, number] = [0.46, 0.4, 0];
/** Right fist, where the powers burn. */
const HAND: [number, number, number] = [0.8, -0.52, 0.08];
/** Right hip and the ankle under it. */
const HIP: [number, number, number] = [0.21, -0.45, 0];
const ANKLE_Y = -1.42;

/** Toon surface; a pattern texture carries the colour itself, so the tint goes white. */
function Toon({ color, map, tex }: { color: string; map: THREE.Texture; tex?: THREE.Texture | null }) {
  return <meshToonMaterial color={tex ? '#ffffff' : color} gradientMap={map} map={tex ?? null} />;
}

/** Draws the children once and again reflected, so the two halves always match. */
function Pair({ children }: { children: ReactNode }) {
  return (
    <>
      <group>{children}</group>
      <group scale={[-1, 1, 1]}>{children}</group>
    </>
  );
}

function lathe(points: [number, number][], phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    48,
    phiStart,
    phiLength,
  );
}

/* --------------------------------------------------------------- surfaces */

interface Skin {
  pattern: PatternKind;
  scale: number;
}

/** Each suit wears a different cloth, so they never read as one repainted suit. */
const SUIT_SKIN: Record<string, Skin> = {
  classic: { pattern: 'smooth', scale: 1 }, // clean spandex with a highlight
  armour: { pattern: 'scales', scale: 3 }, // plated
  stripes: { pattern: 'stripes', scale: 2 },
  hoodie: { pattern: 'fur', scale: 2.4 }, // brushed fleece
};

const CAPE_SKIN: Record<string, Skin> = {
  long: { pattern: 'smooth', scale: 1 },
  short: { pattern: 'stripes', scale: 2.4 },
  torn: { pattern: 'fur', scale: 2.4 },
  star: { pattern: 'dots', scale: 3 },
};

function skinOf(map: Record<string, Skin>, kind: string | null, color: string) {
  if (!kind) return null;
  const s = map[kind] ?? { pattern: 'smooth' as PatternKind, scale: 1 };
  return { base: color, pattern: s.pattern, scale: s.scale };
}

/* ------------------------------------------------------------------ torso */

/** Broad chest, pinched waist: the hero silhouette, readable from any angle. */
const TORSO: [number, number][] = [
  [0.0, -0.52],
  [0.3, -0.54],
  [0.36, -0.4],
  [0.33, -0.18],
  [0.38, 0.02],
  [0.46, 0.26],
  [0.47, 0.42],
  [0.38, 0.54],
  [0.2, 0.6],
  [0.0, 0.62],
];

/** Armour breastplate, a slab sitting just proud of the chest. */
const PLATE: [number, number][] = [
  [0.0, -0.22],
  [0.34, -0.24],
  [0.41, 0.02],
  [0.48, 0.26],
  [0.49, 0.42],
  [0.38, 0.55],
  [0.18, 0.59],
  [0.0, 0.6],
];

/** One arm, from the shoulder joint down to the fist. */
function Arm({ suit, glove, grad, tex }: { suit: string; glove: string; grad: THREE.DataTexture; tex: THREE.Texture | null }) {
  return (
    <group position={SHOULDER}>
      <mesh position={[0.12, -0.26, 0.01]} rotation={[0, 0, -0.32]}>
        <capsuleGeometry args={[0.125, 0.4, 6, 16]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      <mesh position={[0.24, -0.5, 0.02]}>
        <sphereGeometry args={[0.125, 18, 18]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      <mesh position={[0.3, -0.72, 0.05]} rotation={[0, 0, -0.14]}>
        <capsuleGeometry args={[0.115, 0.36, 6, 16]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      {/* glove */}
      <mesh position={[0.34, -0.92, 0.03]} scale={[1, 1, 1.1]}>
        <sphereGeometry args={[0.145, 20, 20]} />
        <Toon color={glove} map={grad} />
        <Ink thin />
      </mesh>
    </group>
  );
}

/** One leg, hip to ankle. The boot takes over below. */
function Leg({ suit, grad, tex }: { suit: string; grad: THREE.DataTexture; tex: THREE.Texture | null }) {
  return (
    <group position={HIP}>
      <mesh position={[0, -0.26, 0]}>
        <capsuleGeometry args={[0.16, 0.4, 6, 16]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[0.155, 18, 18]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      <mesh position={[0, -0.75, 0]}>
        <capsuleGeometry args={[0.145, 0.36, 6, 16]} />
        <Toon color={suit} map={grad} tex={tex} />
        <Ink thin />
      </mesh>
    </group>
  );
}

function Suit({ kind, color, skin, grad }: { kind: string | null; color: string; skin: string; grad: THREE.DataTexture }) {
  const torso = useMemo(() => lathe(TORSO), []);
  const plate = useMemo(() => lathe(PLATE), []);
  const cloth = usePatternTexture(skinOf(SUIT_SKIN, kind, color));
  // erased suit: the hero underneath is still drawn, exactly like the 2D <Body>
  const body = kind ? color : skin;
  const glove = kind ? shade(color, -0.24) : skin;
  const dark = shade(color, -0.2);
  const light = shade(color, 0.42);
  return (
    <group>
      {/* torso: a lathe squashed in z, so he is wide and flat like the drawing */}
      <mesh geometry={torso} scale={[1, 1, 0.72]}>
        <Toon color={body} map={grad} tex={kind ? cloth : null} />
        <Ink />
      </mesh>

      {kind === 'armour' && (
        <>
          <mesh geometry={plate} scale={[1.02, 1, 0.76]}>
            <Toon color={shade(color, 0.3)} map={grad} />
            <Ink thin />
          </mesh>
          {[0.08, -0.08].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.76, 1]}>
              <torusGeometry args={[0.43, 0.035, 8, 40]} />
              <Toon color={dark} map={grad} />
            </mesh>
          ))}
        </>
      )}

      {kind === 'stripes' &&
        [-0.21, 0, 0.21].map((x) => (
          <mesh key={x} position={[x, 0.14, 0.33 - x * x * 0.55]} rotation={[0, -x * 0.5, 0]}>
            <boxGeometry args={[0.11, 0.86, 0.06]} />
            <Toon color={light} map={grad} />
          </mesh>
        ))}

      {kind === 'hoodie' && (
        <>
          {/* the hood is down, resting on his back */}
          <mesh position={[0, 0.42, -0.28]} rotation={[-0.55, 0, 0]}>
            <sphereGeometry args={[0.44, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
            <meshToonMaterial color={dark} gradientMap={grad} side={THREE.DoubleSide} />
            <Ink thin />
          </mesh>
          {/* collar roll */}
          <mesh position={[0, 0.56, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
            <torusGeometry args={[0.28, 0.1, 10, 32]} />
            <Toon color={dark} map={grad} />
            <Ink thin />
          </mesh>
          {/* front pocket */}
          <mesh position={[0, -0.2, 0.26]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.5]}>
            <capsuleGeometry args={[0.13, 0.32, 6, 16]} />
            <Toon color={dark} map={grad} />
            <Ink thin />
          </mesh>
          {/* drawstrings */}
          <Pair>
            <group position={[0.11, 0.42, 0.26]}>
              <mesh position={[0, -0.09, 0]}>
                <capsuleGeometry args={[0.018, 0.16, 4, 8]} />
                <Toon color="#F4F6FF" map={grad} />
              </mesh>
              <mesh position={[0, -0.21, 0]}>
                <sphereGeometry args={[0.04, 12, 12]} />
                <Toon color="#F4F6FF" map={grad} />
                <Ink thin />
              </mesh>
            </group>
          </Pair>
        </>
      )}

      {/* neckline chevron, the classic suit's own mark */}
      {kind === 'classic' && (
        <Pair>
          <mesh position={[0.13, 0.5, 0.31]} rotation={[0, -0.25, 0.8]}>
            <boxGeometry args={[0.06, 0.28, 0.05]} />
            <Toon color={light} map={grad} />
          </mesh>
        </Pair>
      )}

      {/* belt */}
      {kind && (
        <group position={[0, -0.3, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]}>
            <torusGeometry args={[0.36, 0.07, 10, 32]} />
            <Toon color={shade(color, -0.34)} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, 0, 0.3]} scale={[1, 1, 0.6]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}

      {/* neck */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.14, 0.17, 0.28, 16]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>

      {/* shoulders, arms and legs — one side drawn, the other reflected */}
      <Pair>
        <>
          <mesh position={SHOULDER} scale={kind === 'armour' ? 1.18 : 1}>
            <sphereGeometry args={[0.2, 22, 22]} />
            <Toon color={kind === 'armour' ? dark : body} map={grad} tex={kind && kind !== 'armour' ? cloth : null} />
            <Ink thin />
          </mesh>
          {kind === 'armour' && (
            <mesh position={[SHOULDER[0] - 0.06, SHOULDER[1] + 0.12, 0.04]}>
              <sphereGeometry args={[0.04, 10, 10]} />
              <Toon color="#E4E9F7" map={grad} />
            </mesh>
          )}
          <Arm suit={body} glove={glove} grad={grad} tex={kind ? cloth : null} />
          <Leg suit={body} grad={grad} tex={kind ? cloth : null} />
        </>
      </Pair>
    </group>
  );
}

/* ------------------------------------------------------------------ boots */

/** One boot, drawn on the right foot from the ankle down; the sole lands at y=-1.80. */
function Boot({ kind, base, grad }: { kind: string; base: string; grad: THREE.DataTexture }) {
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.getElapsedTime();
    flame.current.scale.set(1, 1 + Math.sin(t * 11) * 0.22 + Math.sin(t * 27) * 0.08, 1);
  });

  const white = '#F4F6FF';
  const upper = kind === 'sneakers' ? white : base;
  const sole = kind === 'sneakers' ? base : shade(base, -0.34);
  const plate = shade(base, 0.34);
  const shaft = kind === 'tall' ? 0.52 : kind === 'armour' ? 0.44 : kind === 'rocket' ? 0.32 : 0.14;

  return (
    <group position={[HIP[0], ANKLE_Y, 0]}>
      {/* shaft */}
      <mesh position={[0, shaft / 2 - 0.1, 0]}>
        <cylinderGeometry args={[0.185, 0.2, shaft, 22]} />
        <Toon color={upper} map={grad} />
        <Ink thin />
      </mesh>
      {/* foot */}
      <mesh position={[0.02, -0.24, 0.1]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[0.3, 0.22, 0.46]} />
        <Toon color={upper} map={grad} />
        <Ink thin />
      </mesh>
      {/* sole, flat on the ground */}
      <mesh position={[0.02, -0.365, 0.1]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[0.33, 0.075, 0.5]} />
        <Toon color={sole} map={grad} />
        <Ink thin />
      </mesh>

      {kind === 'tall' && (
        <>
          {/* wide folded-down cuff at the knee */}
          <mesh position={[0, shaft - 0.14, 0]}>
            <cylinderGeometry args={[0.24, 0.22, 0.14, 22]} />
            <Toon color={plate} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, -0.32, 0.1]} rotation={[0, 0.16, 0]}>
            <boxGeometry args={[0.32, 0.04, 0.48]} />
            <Toon color={plate} map={grad} />
          </mesh>
        </>
      )}

      {kind === 'armour' && (
        <>
          {[0.0, 0.14, 0.28].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.215, 0.215, 0.09, 22]} />
              <Toon color={plate} map={grad} />
              <Ink thin />
            </mesh>
          ))}
          {/* knee cap */}
          <mesh position={[0, shaft - 0.08, 0.06]} scale={[1, 1, 0.7]}>
            <sphereGeometry args={[0.18, 20, 20]} />
            <Toon color={plate} map={grad} />
            <Ink thin />
          </mesh>
          {/* angular steel toe */}
          <mesh position={[0.03, -0.26, 0.28]} rotation={[0, 0.16, 0]}>
            <boxGeometry args={[0.31, 0.2, 0.14]} />
            <Toon color={plate} map={grad} />
            <Ink thin />
          </mesh>
        </>
      )}

      {kind === 'sneakers' && (
        <>
          {/* laces across the instep */}
          {[0.0, 0.08, 0.16].map((z) => (
            <mesh key={z} position={[0.02, -0.14, 0.06 + z]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.018, 0.2, 4, 8]} />
              <Toon color={base} map={grad} />
            </mesh>
          ))}
          {/* side stripe */}
          <mesh position={[0.16, -0.24, 0.08]} rotation={[0.3, 0.16, 0]}>
            <boxGeometry args={[0.03, 0.1, 0.34]} />
            <Toon color={base} map={grad} />
          </mesh>
          {/* padded collar */}
          <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.045, 8, 24]} />
            <Toon color={base} map={grad} />
          </mesh>
        </>
      )}

      {kind === 'rocket' && (
        <>
          <mesh position={[0.2, 0.06, 0.0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
          <group position={[0.02, -0.3, -0.16]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.14, 0.16, 16]} />
              <Toon color="#B9C6E4" map={grad} />
              <Ink thin />
            </mesh>
            <group ref={flame} position={[0, -0.1, 0]}>
              <mesh position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.12, 0.3, 16]} />
                <meshToonMaterial color="#FF8A2A" gradientMap={grad} />
              </mesh>
              <mesh position={[0, -0.11, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.07, 0.2, 12]} />
                <meshBasicMaterial color="#FFD93D" />
              </mesh>
            </group>
            <Sparkles count={8} scale={[0.35, 0.5, 0.35]} position={[0, -0.24, 0]} size={2.5} speed={1.2} color="#FF8A2A" />
          </group>
        </>
      )}
    </group>
  );
}

function Boots({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  if (!kind) return null;
  return (
    <Pair>
      <Boot kind={kind} base={shade(color, -0.3)} grad={grad} />
    </Pair>
  );
}

/** Bare feet, for when the child erases the boots. */
function BareFeet({ color, grad }: { color: string; grad: THREE.DataTexture }) {
  return (
    <Pair>
      <mesh position={[HIP[0] + 0.02, -1.72, 0.08]} rotation={[0, 0.16, 0]} scale={[1, 0.55, 1.8]}>
        <sphereGeometry args={[0.16, 22, 22]} />
        <Toon color={color} map={grad} />
        <Ink thin />
      </mesh>
    </Pair>
  );
}

/* ------------------------------------------------------------------- cape */

/** Cape profiles, measured down from the shoulder pivot at y=0.5. */
const CAPE_PROFILE: Record<string, [number, number][]> = {
  long: [
    [0.44, 0.0],
    [0.5, -0.3],
    [0.62, -0.8],
    [0.8, -1.5],
    [0.95, -2.1],
    [1.0, -2.26],
  ],
  short: [
    [0.44, 0.0],
    [0.5, -0.25],
    [0.6, -0.55],
    [0.68, -0.85],
  ],
  torn: [
    [0.44, 0.0],
    [0.5, -0.3],
    [0.62, -0.8],
    [0.78, -1.4],
    [0.88, -1.9],
  ],
  star: [
    [0.44, 0.0],
    [0.5, -0.3],
    [0.62, -0.8],
    [0.8, -1.5],
    [0.95, -2.1],
    [1.0, -2.26],
  ],
};

function Cape({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const drift = useRef<THREE.Group>(null);
  const geo = useMemo(() => lathe(CAPE_PROFILE[kind ?? 'long'] ?? CAPE_PROFILE.long, Math.PI * 0.45, Math.PI * 1.1), [kind]);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.15, 0.07), { depth: 0.03, bevelEnabled: false }), []);
  const cloth = usePatternTexture(skinOf(CAPE_SKIN, kind, color));
  useFrame(({ clock }) => {
    if (!drift.current) return;
    const t = clock.getElapsedTime();
    drift.current.rotation.x = 0.06 + Math.sin(t * 1.4) * 0.07;
    drift.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    drift.current.rotation.y = Math.sin(t * 0.6) * 0.06;
  });
  if (!kind) return null;
  const hem = (CAPE_PROFILE[kind] ?? CAPE_PROFILE.long).slice(-1)[0];
  return (
    <group position={[0, 0.5, -0.04]}>
      {/* collar, fixed to the shoulders */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh rotation={[0, 0, -Math.PI * 1.1]}>
          <torusGeometry args={[0.42, 0.07, 10, 40, Math.PI * 1.2]} />
          <Toon color={shade(color, -0.24)} map={grad} />
          <Ink thin />
        </mesh>
      </group>

      <group ref={drift}>
        <mesh geometry={geo}>
          <meshToonMaterial
            color={cloth ? '#ffffff' : color}
            map={cloth ?? null}
            gradientMap={grad}
            side={THREE.DoubleSide}
          />
          <Ink />
        </mesh>

        {/* the short cape ends in a scalloped trim */}
        {kind === 'short' &&
          Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * 0.5 + (i / 8) * Math.PI;
            return (
              <mesh key={i} position={[Math.sin(a) * hem[0], hem[1], Math.cos(a) * hem[0]]}>
                <sphereGeometry args={[0.1, 14, 14]} />
                <Toon color={shade(color, 0.42)} map={grad} />
                <Ink thin />
              </mesh>
            );
          })}

        {/* the torn cape ends in ragged points */}
        {kind === 'torn' &&
          Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI * 0.55 + (i / 6) * Math.PI * 0.9;
            const drop = i % 2 === 0 ? 0.34 : 0.2;
            return (
              <mesh
                key={i}
                position={[Math.sin(a) * hem[0], hem[1] - drop / 2, Math.cos(a) * hem[0]]}
                rotation={[Math.PI, -a, 0]}
              >
                <coneGeometry args={[0.16, drop, 4]} />
                <Toon color={color} map={grad} />
                <Ink thin />
              </mesh>
            );
          })}

        {/* the star cape is sprinkled with gold stars */}
        {kind === 'star' &&
          [
            [0.0, -0.55],
            [-0.5, -1.05],
            [0.5, -1.05],
            [-0.25, -1.6],
            [0.28, -1.65],
            [0.0, -2.0],
          ].map(([u, y], i) => {
            const a = Math.PI + u;
            const r = 0.49 - y * 0.245; // follows the flare of the lathe
            return (
              <mesh
                key={i}
                geometry={star}
                position={[Math.sin(a) * r, y, Math.cos(a) * r]}
                rotation={[0, a, 0]}
                scale={1 - i * 0.05}
              >
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            );
          })}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- emblem */

function Emblem({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const geo = useMemo(() => {
    const shape =
      kind === 'bolt'
        ? polyShape([
            [0.07, 0.21],
            [-0.11, -0.01],
            [-0.01, -0.01],
            [-0.07, -0.22],
            [0.12, 0.02],
            [0.01, 0.02],
          ])
        : kind === 'heart'
          ? heartShape(0.2)
          : kind === 'shield'
            ? polyShape([
                [0, 0.21],
                [0.17, 0.12],
                [0.16, -0.04],
                [0, -0.21],
                [-0.16, -0.04],
                [-0.17, 0.12],
              ])
            : starShape(0.19, 0.09);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  }, [kind]);
  if (!kind) return null;
  const tint = kind === 'heart' ? '#FF6B78' : kind === 'shield' ? '#7ED957' : '#FFD93D';
  return (
    <group position={[0, 0.22, 0.38]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.05, 32]} />
        <Toon color={shade(color, 0.55)} map={grad} />
        <Ink thin />
      </mesh>
      <mesh geometry={geo} position={[0, kind === 'heart' ? 0.05 : 0, 0.02]}>
        <Toon color={tint} map={grad} />
        <Ink thin />
      </mesh>
      {kind === 'shield' && (
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[0.025, 0.3, 0.02]} />
          <Toon color={shade('#7ED957', -0.34)} map={grad} />
        </mesh>
      )}
    </group>
  );
}

/* ----------------------------------------------------------------- powers */

/** One handful of power. Each kind moves in its own way, so they read apart. */
function Power({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const ref = useRef<THREE.Group>(null);
  const bolt = useMemo(
    () =>
      new THREE.ExtrudeGeometry(
        polyShape([
          [0.08, 0.26],
          [-0.13, -0.02],
          [-0.01, -0.02],
          [-0.09, -0.28],
          [0.14, 0.02],
          [0.02, 0.02],
        ]),
        { depth: 0.045, bevelEnabled: false },
      ),
    [],
  );
  const smallStar = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.12, 0.055), { depth: 0.04, bevelEnabled: false }), []);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    if (kind === 'fire') {
      g.scale.set(1, 1 + Math.sin(t * 9) * 0.16 + Math.sin(t * 23) * 0.06, 1);
      g.rotation.y = Math.sin(t * 3) * 0.35;
    } else if (kind === 'ice') {
      g.rotation.y = t * 0.6;
      g.position.y = Math.sin(t * 1.6) * 0.04;
    } else if (kind === 'bolt') {
      const jolt = Math.sin(t * 17) > 0.2 ? 1 : 0.72;
      g.scale.setScalar(jolt);
      g.rotation.z = Math.sin(t * 21) * 0.14;
    } else {
      g.rotation.z = t * 1.1;
    }
  });

  return (
    <group position={HAND}>
      <group ref={ref} position={[0.06, -0.2, 0.04]}>
        {kind === 'fire' && (
          <>
            <mesh position={[0, -0.04, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.19, 0.46, 18]} />
              <Toon color="#FF8A2A" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0, -0.06, 0.02]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.1, 0.28, 14]} />
              <meshBasicMaterial color="#FFD93D" />
            </mesh>
            <mesh position={[0.2, -0.1, 0.02]}>
              <sphereGeometry args={[0.055, 12, 12]} />
              <Toon color="#FF8A2A" map={grad} />
              <Ink thin />
            </mesh>
          </>
        )}
        {kind === 'ice' && (
          <>
            <mesh>
              <octahedronGeometry args={[0.21, 0]} />
              <Toon color="#9BE7FF" map={grad} />
              <Ink thin />
            </mesh>
            {[
              [0.17, -0.15, 0.05],
              [-0.14, -0.17, 0.02],
              [0.02, 0.2, -0.04],
            ].map(([x, y, z], i) => (
              <mesh key={i} position={[x, y, z]} rotation={[0.4 * i, 0.7 * i, 0]}>
                <octahedronGeometry args={[0.1 - i * 0.015, 0]} />
                <Toon color="#E6FAFF" map={grad} />
                <Ink thin />
              </mesh>
            ))}
          </>
        )}
        {kind === 'bolt' && (
          <>
            <mesh geometry={bolt} position={[0.04, -0.02, 0.06]} rotation={[0, 0, -0.2]}>
              <Toon color="#FFD93D" map={grad} />
              <Ink thin />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.22, 0.12 * s, 0.02]} rotation={[0, 0, s * 0.8]}>
                <capsuleGeometry args={[0.02, 0.16, 4, 8]} />
                <meshBasicMaterial color="#FFF3C4" />
              </mesh>
            ))}
          </>
        )}
        {kind === 'stars' &&
          [
            [0, 0, 0],
            [0.18, -0.16, 0.04],
            [-0.15, -0.14, 0.02],
            [0.02, 0.19, -0.03],
          ].map(([x, y, z], i) => (
            <mesh key={i} geometry={smallStar} position={[x, y, z]} scale={1 - i * 0.18}>
              <Toon color={i % 2 === 0 ? '#FFD93D' : '#FFF3C4'} map={grad} />
              <Ink thin />
            </mesh>
          ))}
      </group>
      <Sparkles
        count={kind === 'ice' ? 10 : 14}
        scale={[0.6, 0.7, 0.6]}
        position={[0.06, -0.2, 0.04]}
        size={3}
        speed={kind === 'ice' ? 0.35 : 0.9}
        color={kind === 'ice' ? '#9BE7FF' : kind === 'fire' ? '#FF8A2A' : '#FFD93D'}
      />
    </group>
  );
}

function Powers({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  if (!kind) return null;
  return (
    <Pair>
      <Power kind={kind} grad={grad} />
    </Pair>
  );
}

/* ------------------------------------------------------------------- hair */

function Hair({ grad }: { grad: THREE.DataTexture }) {
  const tex = usePatternTexture({ base: '#2B1B12', pattern: 'fur', scale: 2.4 });
  return (
    <group>
      <mesh position={[0, HEAD_Y + 0.05, -0.05]}>
        <sphereGeometry args={[HEAD_R + 0.035, 36, 36, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
        <Toon color="#2B1B12" map={grad} tex={tex} />
        <Ink thin />
      </mesh>
      {/* the swept quiff from the drawing, standing proud of the cap */}
      <mesh position={[0, HEAD_Y + 0.56, 0.1]} rotation={[0.35, 0, 0.18]} scale={[1.4, 0.9, 1]}>
        <sphereGeometry args={[0.24, 22, 22]} />
        <Toon color="#2B1B12" map={grad} tex={tex} />
        <Ink thin />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------- mask */

function Mask({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const crest = useMemo(
    () =>
      new THREE.ExtrudeGeometry(
        polyShape([
          [0.2, 0.0],
          [0.09, 0.28],
          [-0.02, 0.36],
          [-0.2, 0.03],
        ]),
        { depth: 0.07, bevelEnabled: false },
      ),
    [],
  );
  if (!kind || kind === 'eye') return null; // the eye mask is projected as a decal
  const c = shade(color, -0.28);

  if (kind === 'visor') {
    return (
      <group position={[0, HEAD_Y + 0.06, 0]}>
        <mesh>
          <cylinderGeometry args={[HEAD_R + 0.035, HEAD_R + 0.035, 0.32, 32, 1, true, -Math.PI * 0.4, Math.PI * 0.8]} />
          <meshToonMaterial color={shade(color, -0.5)} gradientMap={grad} side={THREE.DoubleSide} />
          <Ink />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[HEAD_R + 0.05, HEAD_R + 0.05, 0.09, 32, 1, true, -Math.PI * 0.34, Math.PI * 0.68]} />
          <meshToonMaterial color="#8FB8FF" gradientMap={grad} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  if (kind === 'helmet') {
    return (
      <group>
        <mesh position={[0, HEAD_Y + 0.02, -0.02]}>
          <sphereGeometry args={[HEAD_R + 0.08, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          <Toon color={c} map={grad} />
          <Ink />
        </mesh>
        {/* brow band */}
        <mesh position={[0, HEAD_Y + 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[HEAD_R + 0.055, 0.04, 8, 40]} />
          <Toon color={shade(c, 0.4)} map={grad} />
        </mesh>
        {/* crest fin */}
        <mesh geometry={crest} rotation={[0, -Math.PI / 2, 0]} position={[0.035, HEAD_Y + HEAD_R - 0.02, 0]}>
          <Toon color="#FFD93D" map={grad} />
          <Ink thin />
        </mesh>
        {/* ear pods */}
        <Pair>
          <mesh position={[HEAD_R - 0.01, HEAD_Y - 0.06, 0]} scale={[0.5, 1, 1]}>
            <sphereGeometry args={[0.21, 20, 20]} />
            <Toon color={shade(c, -0.2)} map={grad} />
            <Ink thin />
          </mesh>
        </Pair>
      </group>
    );
  }

  // goggles
  return (
    <group>
      <mesh position={[0, HEAD_Y + 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HEAD_R + 0.015, 0.055, 10, 36]} />
        <Toon color={c} map={grad} />
        <Ink thin />
      </mesh>
      <Pair>
        <group position={[0.22, HEAD_Y + 0.08, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.16, 24]} />
            <Toon color={c} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.03, 24]} />
            <Toon color="#9BE7FF" map={grad} />
          </mesh>
          <mesh position={[-0.05, 0.11, 0.05]} rotation={[0, 0, 0.4]} scale={[1.6, 1, 0.7]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </Pair>
    </group>
  );
}

/* ------------------------------------------------------------------- root */

export default function Superhero3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveSuperheroColors(parts, colors);

  const suit = pickPart(parts.suit, 'classic');
  const mask = pickPart(parts.mask, 'eye');
  const cape = pickPart(parts.cape, 'long');
  const emblem = pickPart(parts.emblem, 'star');
  const power = pickPart(parts.power, 'fire');
  const boots = pickPart(parts.boots, 'tall');

  const eyesEl = useMemo(() => <FaceEyes colors={eff} />, [eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => <FaceMouth colors={eff} />, []); // eslint-disable-line react-hooks/exhaustive-deps
  const maskEl = useMemo(() => (mask === 'eye' ? <MaskEye colors={eff} /> : null), [mask, eff.suit]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);
  const maskTex = useSvgTexture(maskEl);

  return (
    <group position={[0, 0.02, 0]}>
      <Cape kind={cape} color={eff.cape} grad={grad} />
      <Suit kind={suit} color={eff.suit} skin={eff.skin} grad={grad} />
      <Emblem kind={emblem} color={eff.suit} grad={grad} />
      {boots ? <Boots kind={boots} color={eff.suit} grad={grad} /> : <BareFeet color={eff.skin} grad={grad} />}

      {/* head — the face is the 2D drawing, projected */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[HEAD_R, 48, 48]} />
        <Toon color={eff.skin} map={grad} />
        <Ink />
        <FaceDecal tex={eyesTex} y={0.05} z={HEAD_R} size={1.0} />
        <FaceDecal tex={mouthTex} y={-0.2} z={HEAD_R} size={0.62} />
        <FaceDecal tex={maskTex} y={0.05} z={HEAD_R} size={1.0} />
      </mesh>

      {/* ears */}
      <Pair>
        <mesh position={[HEAD_R - 0.03, HEAD_Y - 0.03, 0]} scale={[0.7, 1.15, 1]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <Toon color={eff.skin} map={grad} />
          <Ink thin />
        </mesh>
      </Pair>

      {mask !== 'helmet' && <Hair grad={grad} />}
      <Mask kind={mask} color={eff.suit} grad={grad} />
      <Powers kind={power} grad={grad} />
    </group>
  );
}

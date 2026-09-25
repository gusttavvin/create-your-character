import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { findOption } from '../types';
import { FAIRY, resolveFairyColors } from './config';
import { Smile } from './parts';
import {
  leafShape,
  pickPart,
  starShape,
  useGradientMap,
  usePatternTexture,
  useSvgTexture,
} from '../../lib/three';
import type { PatternKind } from '../../lib/three';
import { shade } from '../../lib/color';
import Limb from '../../components/Limb';
import Part3D from '../../components/Part3D';

/**
 * The fairy in 3D, built on the same skeleton as the drawing in `parts.tsx`.
 *
 * She is small and light: head at y=1.15, shoulders at y=0.46, waist at y=0.08,
 * a short skirt so her legs show, and slippers on the floor at y=-1.80. Wings
 * mount behind the shoulders and flap; the wand sparkles. Everything that comes
 * in a pair is drawn once and reflected with <Pair>.
 */

const HEAD_Y = 1.15;
const HEAD_R = 0.62;
/** Right shoulder joint; the left is this reflected. */
const SHOULDER: [number, number, number] = [0.3, 0.46, 0];
/** Right hand, where the wand sits. */
const HAND: [number, number, number] = [0.62, -0.32, 0.1];
/** Right hip; the leg hangs from here. */
const HIP: [number, number, number] = [0.13, 0.02, 0];

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

function lathe(points: [number, number][]) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  );
}

/* --------------------------------------------------------------- surfaces */

interface Skin {
  pattern: PatternKind;
  scale: number;
}

/** Each dress is cut from a different cloth, so no two read the same. */
const DRESS_SKIN: Record<string, Skin> = {
  petal: { pattern: 'smooth', scale: 1 },
  leaf: { pattern: 'stripes', scale: 2 }, // veins
  star: { pattern: 'dots', scale: 3 },
  bubble: { pattern: 'scales', scale: 3 },
};

const WING_SKIN: Record<string, Skin> = {
  butterfly: { pattern: 'dots', scale: 2 },
  dragonfly: { pattern: 'stripes', scale: 3 },
  leaf: { pattern: 'fur', scale: 2 },
  star: { pattern: 'smooth', scale: 1 },
};

const HAIR_SKIN: Record<string, Skin> = {
  long: { pattern: 'fur', scale: 2 },
  buns: { pattern: 'fur', scale: 2.4 },
  curly: { pattern: 'fur', scale: 1.6 },
  braid: { pattern: 'stripes', scale: 2 },
};

function skinOf(map: Record<string, Skin>, kind: string | null, color: string) {
  if (!kind) return null;
  const s = map[kind] ?? { pattern: 'smooth' as PatternKind, scale: 1 };
  return { base: color, pattern: s.pattern, scale: s.scale };
}

const RING8 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i / 8) * Math.PI * 2);
const RING7 = [0, 1, 2, 3, 4, 5, 6].map((i) => (i / 7) * Math.PI * 2);

/* ------------------------------------------------------------------- body */

/** Slim bodice, waist at y=0.08 up to the collar at y=0.62. */
const BODICE: [number, number][] = [
  [0.0, 0.05],
  [0.24, 0.06],
  [0.27, 0.2],
  [0.3, 0.38],
  [0.28, 0.52],
  [0.18, 0.6],
  [0.0, 0.62],
];

/** One arm, shoulder to hand: a single bent limb, not a chain of beads. */
function Arm({ skin, grad }: { skin: string; grad: THREE.DataTexture }) {
  return (
    <group position={SHOULDER}>
      <Limb
        pts={[
          [0.05, -0.05, 0],
          [0.17, -0.3, 0.03],
          [0.25, -0.52, 0.06],
          [0.3, -0.74, 0.09],
        ]}
        r={0.105}
        tip={0.13}
      >
        <Toon color={skin} map={grad} />
      </Limb>
    </group>
  );
}

/** One leg with its slipper; the sole lands at y=-1.80. */
function Leg({ skin, shoe, grad }: { skin: string; shoe: string; grad: THREE.DataTexture }) {
  return (
    <group position={HIP}>
      <mesh position={[0, -0.38, 0]}>
        <capsuleGeometry args={[0.145, 0.62, 4, 14]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      <mesh position={[0, -0.78, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      <mesh position={[0, -1.15, 0]}>
        <capsuleGeometry args={[0.132, 0.6, 4, 14]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      {/* slipper */}
      <group position={[0.01, -1.72, 0.06]}>
        <mesh scale={[1, 0.55, 1.7]}>
          <sphereGeometry args={[0.15, 22, 22]} />
          <Toon color={shoe} map={grad} />
          <Ink thin />
        </mesh>
        <mesh position={[0, 0.03, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.022, 8, 18]} />
          <Toon color={shade(shoe, -0.25)} map={grad} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ dress */

/** How far down each skirt reaches, so the legs start where the cloth ends. */
function Dress({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const cloth = usePatternTexture(skinOf(DRESS_SKIN, kind, color));
  const bodiceTex = usePatternTexture({ base: shade(color, -0.12), pattern: 'smooth', scale: 1 });
  const bodice = useMemo(() => lathe(BODICE), []);
  const underskirt = useMemo(
    () =>
      lathe([
        [0.0, 0.1],
        [0.28, 0.08],
        [0.34, -0.3],
        [0.3, -0.6],
        [0.0, -0.62],
      ]),
    [],
  );
  const flare = useMemo(
    () =>
      lathe([
        [0.0, -0.88],
        [0.62, -0.88],
        [0.46, -0.45],
        [0.31, 0.0],
        [0.27, 0.1],
        [0.0, 0.12],
      ]),
    [],
  );
  const leaf = useMemo(() => new THREE.ExtrudeGeometry(leafShape(0.62), { depth: 0.05, bevelEnabled: false }), []);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.11, 0.05), { depth: 0.03, bevelEnabled: false }), []);

  if (!kind) return null;
  const light = shade(color, 0.28);
  const dark = shade(color, -0.16);

  return (
    <group>
      {/* bodice + sash */}
      <mesh geometry={bodice} scale={[1, 1, 0.85]}>
        <Toon color={shade(color, -0.12)} map={grad} tex={bodiceTex} />
        <Ink />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}>
        <torusGeometry args={[0.27, 0.045, 8, 36]} />
        <Toon color={dark} map={grad} />
        <Ink thin />
      </mesh>
      {/* puff sleeves */}
      <Pair>
        <mesh position={SHOULDER} scale={[1, 0.9, 1]}>
          <sphereGeometry args={[0.16, 22, 22]} />
          <Toon color={color} map={grad} tex={cloth} />
          <Ink thin />
        </mesh>
      </Pair>

      {/* ------------------------------------------------- the four skirts */}

      {kind === 'petal' && (
        <group>
          <mesh geometry={underskirt}>
            <Toon color={dark} map={grad} />
            <Ink />
          </mesh>
          {/* two staggered rings of petals, like the drawn flower skirt */}
          {RING8.map((a, i) => (
            <mesh
              key={`u${i}`}
              position={[Math.sin(a) * 0.32, -0.3, Math.cos(a) * 0.32]}
              rotation={[0.42, a, 0]}
              scale={[0.8, 1.35, 0.32]}
            >
              <sphereGeometry args={[0.3, 20, 20]} />
              <Toon color={color} map={grad} tex={cloth} />
              <Ink thin />
            </mesh>
          ))}
          {RING8.map((a, i) => (
            <mesh
              key={`l${i}`}
              position={[Math.sin(a + 0.39) * 0.34, -0.58, Math.cos(a + 0.39) * 0.34]}
              rotation={[0.28, a + 0.39, 0]}
              scale={[0.8, 1.35, 0.32]}
            >
              <sphereGeometry args={[0.3, 20, 20]} />
              <Toon color={light} map={grad} />
              <Ink thin />
            </mesh>
          ))}
        </group>
      )}

      {kind === 'leaf' && (
        <group>
          <mesh geometry={underskirt}>
            <Toon color={dark} map={grad} />
            <Ink />
          </mesh>
          {/* a skirt of pointed leaves, tips down */}
          {RING8.map((a, i) => (
            <group key={i} position={[Math.sin(a) * 0.33, -0.34, Math.cos(a) * 0.33]} rotation={[0.2, a, Math.PI]}>
              <mesh geometry={leaf}>
                <Toon color={color} map={grad} tex={cloth} />
                <Ink thin />
              </mesh>
              <mesh position={[0, 0.06, 0.05]}>
                <boxGeometry args={[0.02, 0.6, 0.02]} />
                <Toon color={shade(color, -0.3)} map={grad} />
              </mesh>
            </group>
          ))}
          {/* leaf collar at the neckline */}
          <Pair>
            <mesh geometry={leaf} position={[0.17, 0.5, 0.16]} rotation={[0.4, 0.7, 0.4]} scale={0.42}>
              <Toon color={light} map={grad} />
              <Ink thin />
            </mesh>
          </Pair>
        </group>
      )}

      {kind === 'star' && (
        <group>
          <mesh geometry={flare}>
            <Toon color={color} map={grad} tex={cloth} />
            <Ink />
          </mesh>
          {/* gold zigzag hem */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.6, -0.96, Math.cos(a) * 0.6]} rotation={[Math.PI, a, 0]}>
                <coneGeometry args={[0.11, 0.2, 4]} />
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            );
          })}
          {/* stars stuck on the skirt */}
          {[0, 1.25, 2.5, 3.75, 5.0].map((a, i) => {
            const y = -0.3 - (i % 2) * 0.3;
            const r = 0.36 + (-y) * 0.3;
            return (
              <mesh key={i} geometry={star} position={[Math.sin(a) * r, y, Math.cos(a) * r]} rotation={[0, a, 0]}>
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            );
          })}
        </group>
      )}

      {kind === 'bubble' && (
        <group>
          {/* one big round puffball, the most distinct silhouette of the four */}
          <mesh position={[0, -0.36, 0]} scale={[1, 0.86, 1]}>
            <sphereGeometry args={[0.54, 36, 36]} />
            <Toon color={color} map={grad} tex={cloth} />
            <Ink />
          </mesh>
          {RING8.map((a, i) => (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.46, -0.28 - (i % 2) * 0.24, Math.cos(a) * 0.46]}
              scale={1 - (i % 3) * 0.15}
            >
              <sphereGeometry args={[0.18, 20, 20]} />
              <Toon color={light} map={grad} />
              <Ink thin />
            </mesh>
          ))}
          {/* gathered hem */}
          <mesh position={[0, -0.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.05, 8, 32]} />
            <Toon color={dark} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}

    </group>
  );
}

/** Torso, arms and legs. Drawn on their own, so erasing the dress leaves a fairy. */
function Body({ skin, shoe, grad }: { skin: string; shoe: string; grad: THREE.DataTexture }) {
  const torso = useMemo(
    () =>
      lathe([
        [0.0, 0.0],
        [0.2, 0.02],
        [0.22, 0.24],
        [0.24, 0.44],
        [0.2, 0.58],
        [0.0, 0.6],
      ]),
    [],
  );
  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, 0.85]}>
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      <Pair>
        <>
          <Arm skin={skin} grad={grad} />
          <Leg skin={skin} shoe={shoe} grad={grad} />
        </>
      </Pair>
    </group>
  );
}

/* ------------------------------------------------------------------ wings */

function butterflyTop() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 1.05, 1.15, 1.25, 1.2, 0.5);
  s.bezierCurveTo(1.25, 0.05, 0.85, -0.18, 0.05, -0.22);
  s.closePath();
  return s;
}

function butterflyBottom() {
  const s = new THREE.Shape();
  s.moveTo(0.02, -0.08);
  s.bezierCurveTo(0.9, -0.2, 1.1, -0.5, 0.78, -0.95);
  s.bezierCurveTo(0.5, -1.3, 0.1, -0.7, 0.02, -0.08);
  s.closePath();
  return s;
}

function dragonflyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.4, 0.42, 1.35, 0.5, 1.5, 0.16);
  s.bezierCurveTo(1.58, -0.08, 0.7, -0.3, 0, 0);
  s.closePath();
  return s;
}

/** A swept wing that tapers to a point, for the star fairy to hang her stars on. */
function starWingShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.1);
  s.bezierCurveTo(0.2, 0.95, 1.1, 1.15, 1.55, 0.62);
  s.bezierCurveTo(1.25, 0.34, 1.2, 0.1, 1.45, -0.2);
  s.bezierCurveTo(1.0, -0.6, 0.35, -0.55, 0, -0.1);
  s.closePath();
  return s;
}

/** One wing, flapping on its own hinge at the back. */
function Wing({ kind, color, grad, tex }: { kind: string; color: string; grad: THREE.DataTexture; tex: THREE.Texture | null }) {
  const hinge = useRef<THREE.Group>(null);
  const geos = useMemo(() => {
    const opt = { depth: 0.045, bevelEnabled: false };
    if (kind === 'dragonfly') {
      const g = new THREE.ExtrudeGeometry(dragonflyShape(), opt);
      g.scale(0.78, 0.78, 1);
      return [g];
    }
    if (kind === 'leaf') {
      const g = new THREE.ExtrudeGeometry(leafShape(1.35), opt);
      g.rotateZ(-Math.PI / 3.4);
      g.translate(0.55, 0.15, 0);
      return [g];
    }
    if (kind === 'star') {
      const g = new THREE.ExtrudeGeometry(starWingShape(), opt);
      g.scale(0.8, 0.8, 1);
      return [g];
    }
    const top = new THREE.ExtrudeGeometry(butterflyTop(), opt);
    const bot = new THREE.ExtrudeGeometry(butterflyBottom(), opt);
    top.scale(0.82, 0.82, 1);
    bot.scale(0.82, 0.82, 1);
    return [top, bot];
  }, [kind]);

  useFrame(({ clock }) => {
    if (!hinge.current) return;
    const t = clock.getElapsedTime();
    const fast = kind === 'dragonfly' ? 9 : 5.5;
    hinge.current.rotation.y = 0.36 + Math.sin(t * fast) * 0.3;
    hinge.current.rotation.z = Math.sin(t * fast * 0.5) * 0.08;
  });

  const studs = useMemo(() => new THREE.ExtrudeGeometry(starShape(1, 0.45), { depth: 0.06, bevelEnabled: false }), []);
  const light = shade(color, 0.3);
  const vein = shade(color, -0.32);

  return (
    <group ref={hinge}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, i === 1 ? -0.02 : 0, -i * 0.02]}>
          <Toon color={i === 1 ? light : color} map={grad} tex={i === 1 ? null : tex} />
          <Ink thin />
        </mesh>
      ))}

      {kind === 'star' &&
        ([
          [0.5, 0.26, 0.2],
          [0.92, 0.52, 0.15],
          [1.15, 0.08, 0.12],
          [0.72, -0.2, 0.1],
        ] as const).map(([x, y, r], i) => (
          <mesh key={i} geometry={studs} position={[x, y, 0.06]} scale={r} rotation={[0, 0, i * 0.7]}>
            <meshToonMaterial color={shade(color, 0.55)} gradientMap={grad} />
          </mesh>
        ))}

      {kind === 'butterfly' && (
        <>
          <mesh position={[0.66, 0.5, 0.06]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <Toon color={light} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0.5, -0.55, 0.06]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[0.09, 14, 14]} />
            <Toon color={vein} map={grad} />
            <Ink thin />
          </mesh>
        </>
      )}

      {kind === 'dragonfly' && (
        <>
          {/* the lower, shorter pair of the same wing */}
          <mesh geometry={geos[0]} position={[0.03, -0.38, -0.03]} rotation={[0, 0, -0.42]} scale={0.8}>
            <Toon color={light} map={grad} />
            <Ink thin />
          </mesh>
          {[0.0, -0.38].map((y, k) => (
            <mesh key={y} position={[0.55, y + 0.12 - k * 0.08, 0.05]} rotation={[0, 0, k ? -0.42 : 0.06]}>
              <boxGeometry args={[0.9, 0.018, 0.02]} />
              <Toon color={vein} map={grad} />
            </mesh>
          ))}
        </>
      )}

      {kind === 'leaf' && (
        <>
          <mesh position={[0.5, 0.42, 0.05]} rotation={[0, 0, 0.72]}>
            <boxGeometry args={[0.02, 1.25, 0.02]} />
            <Toon color={vein} map={grad} />
          </mesh>
          {[0.25, 0.5, 0.75].map((f) => (
            <mesh key={f} position={[0.28 + f * 0.55, 0.22 + f * 0.62, 0.05]} rotation={[0, 0, -0.5]}>
              <boxGeometry args={[0.02, 0.42, 0.02]} />
              <Toon color={vein} map={grad} />
            </mesh>
          ))}
        </>
      )}

      {kind === 'star' && (
        <mesh position={[0.62, 0.2, 0.06]} rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.16, 0.16, 0.04, 5]} />
          <Toon color={shade(color, 0.45)} map={grad} />
          <Ink thin />
        </mesh>
      )}
    </group>
  );
}

function Wings({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const tex = usePatternTexture(skinOf(WING_SKIN, kind, color));
  if (!kind) return null;
  return (
    <group position={[0, 0.44, -0.22]}>
      <Pair>
        <Wing kind={kind} color={color} grad={grad} tex={tex} />
      </Pair>
      <Sparkles count={24} scale={[2.6, 1.9, 1.0]} position={[0, 0.15, -0.2]} size={3} speed={0.5} color={shade(color, 0.5)} />
    </group>
  );
}

/* ------------------------------------------------------------------- hair */

function Hair({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const tex = usePatternTexture(skinOf(HAIR_SKIN, kind, color));
  /**
   * Curls crowd round the back and the sides of her head and stop at her cheeks:
   * a full ring closes over the face and buries it, which is what went wrong.
   * The angle is measured from straight ahead, so the gap is centred on her face.
   */
  const curls = useMemo(() => {
    const arr: [number, number, number, number][] = [];
    const gap = 1.15; // half the opening in front, in radians
    for (let ring = 0; ring < 2; ring++) {
      const n = ring === 0 ? 11 : 9;
      const r = ring === 0 ? 0.58 : 0.52;
      const base = ring === 0 ? HEAD_Y + 0.3 : HEAD_Y - 0.2;
      for (let k = 0; k < n; k++) {
        const a = gap + (k / (n - 1)) * (Math.PI * 2 - 2 * gap);
        const y = base + (k % 2 === 0 ? 0.06 : -0.05);
        arr.push([Math.sin(a) * r, y, Math.cos(a) * r, 0.19 + (k % 3) * 0.025]);
      }
    }
    return arr;
  }, []);
  if (!kind) return null;

  return (
    <group>
      {/* the cap every style shares */}
      <mesh position={[0, HEAD_Y + 0.04, -0.05]}>
        <sphereGeometry args={[HEAD_R + 0.05, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
        <Toon color={color} map={grad} tex={tex} />
        <Ink />
      </mesh>
      {/* fringe: a shallow shell resting on the forehead, well clear of her eyes */}
      <mesh position={[0, HEAD_Y + 0.02, 0]} rotation={[0.16, 0, 0.08]}>
        <sphereGeometry args={[HEAD_R + 0.06, 36, 36, 0, Math.PI * 2, 0, Math.PI * 0.2]} />
        <Toon color={color} map={grad} tex={tex} />
        <Ink thin />
      </mesh>

      {kind === 'long' && (
        <>
          <mesh position={[0, HEAD_Y - 0.62, -0.26]} scale={[1, 1.5, 0.55]}>
            <sphereGeometry args={[0.66, 32, 32]} />
            <Toon color={color} map={grad} tex={tex} />
            <Ink />
          </mesh>
          <Pair>
            <mesh position={[0.56, HEAD_Y - 0.5, 0.06]} rotation={[0, 0, 0.06]}>
              <capsuleGeometry args={[0.16, 0.86, 6, 16]} />
              <Toon color={color} map={grad} tex={tex} />
              <Ink thin />
            </mesh>
          </Pair>
        </>
      )}

      {kind === 'buns' && (
        <>
          <Pair>
            <>
              <mesh position={[0.45, HEAD_Y + 0.56, -0.04]}>
                <sphereGeometry args={[0.28, 26, 26]} />
                <Toon color={color} map={grad} tex={tex} />
                <Ink />
              </mesh>
              <mesh position={[0.45, HEAD_Y + 0.34, -0.04]} rotation={[Math.PI / 2, 0, 0.35]}>
                <torusGeometry args={[0.14, 0.035, 8, 20]} />
                <Toon color={shade(color, -0.3)} map={grad} />
              </mesh>
            </>
          </Pair>
          {/* short bob at the back */}
          <mesh position={[0, HEAD_Y - 0.26, -0.18]} scale={[1, 0.85, 0.65]}>
            <sphereGeometry args={[0.6, 30, 30]} />
            <Toon color={color} map={grad} tex={tex} />
            <Ink />
          </mesh>
        </>
      )}

      {kind === 'curly' &&
        curls.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 18, 18]} />
            <Toon color={color} map={grad} tex={tex} />
            <Ink thin />
          </mesh>
        ))}

      {kind === 'braid' && (
        <group position={[0.56, HEAD_Y - 0.18, 0.12]} rotation={[0, 0, 0.12]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[i % 2 === 0 ? 0.035 : -0.035, -i * 0.26, 0]} scale={[1, 0.85, 1]}>
              <sphereGeometry args={[0.16, 18, 18]} />
              <Toon color={color} map={grad} tex={tex} />
              <Ink thin />
            </mesh>
          ))}
          {/* pink ribbon at the tip */}
          <group position={[0, -1.24, 0]}>
            <Pair>
              <mesh position={[0.1, 0, 0]} rotation={[0, 0, 0.4]} scale={[1.3, 0.8, 0.5]}>
                <sphereGeometry args={[0.1, 14, 14]} />
                <Toon color="#FF6EC7" map={grad} />
                <Ink thin />
              </mesh>
            </Pair>
            <mesh>
              <sphereGeometry args={[0.06, 12, 12]} />
              <Toon color="#E04E5B" map={grad} />
              <Ink thin />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ crown */

function Flower({ color, grad, r = 0.07 }: { color: string; grad: THREE.DataTexture; r?: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((p) => {
        const b = (p / 5) * Math.PI * 2;
        return (
          <mesh key={p} position={[Math.sin(b) * r, 0, Math.cos(b) * r]}>
            <sphereGeometry args={[r * 0.78, 12, 12]} />
            <meshToonMaterial color={color} gradientMap={grad} />
          </mesh>
        );
      })}
      <mesh position={[0, r * 0.35, 0]}>
        <sphereGeometry args={[r * 0.6, 12, 12]} />
        <meshToonMaterial color="#FFD93D" gradientMap={grad} />
      </mesh>
    </>
  );
}

function Crown({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  const leaf = useMemo(() => new THREE.ExtrudeGeometry(leafShape(0.26), { depth: 0.035, bevelEnabled: false }), []);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.13, 0.06), { depth: 0.04, bevelEnabled: false }), []);
  if (!kind) return null;
  const y = HEAD_Y + 0.28;
  const band = kind === 'star' ? '#FFD93D' : kind === 'berry' ? '#5FA84F' : kind === 'leaf' ? '#4FAE4A' : '#7ED957';
  return (
    <group position={[0, y, 0]} rotation={[0.12, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, kind === 'star' ? 0.05 : 0.055, 8, 40]} />
        <Toon color={band} map={grad} />
        <Ink thin />
      </mesh>

      {kind === 'flower' &&
        RING7.map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.6, 0.05, Math.cos(a) * 0.6]}>
            <Flower color={['#FF6EC7', '#FFF3C4', '#FF6B78', '#A77BFF'][i % 4]} grad={grad} r={i % 2 === 0 ? 0.09 : 0.07} />
          </group>
        ))}

      {kind === 'leaf' &&
        RING7.map((a, i) => (
          <mesh
            key={i}
            geometry={leaf}
            position={[Math.sin(a) * 0.6, 0.07, Math.cos(a) * 0.6]}
            rotation={[0.55, a, i % 2 === 0 ? 0.3 : -0.3]}
          >
            <Toon color={i % 2 === 0 ? '#7ED957' : '#9BE36A'} map={grad} />
            <Ink thin />
          </mesh>
        ))}

      {kind === 'star' &&
        RING7.map((a, i) => (
          <mesh key={i} geometry={star} position={[Math.sin(a) * 0.6, 0.13, Math.cos(a) * 0.6]} rotation={[0, a, 0]} scale={i === 0 ? 1.5 : 1}>
            <Toon color={i % 2 === 0 ? '#FFD93D' : '#FFF3C4'} map={grad} />
            <Ink thin />
          </mesh>
        ))}

      {kind === 'berry' &&
        RING7.map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.6, 0.06, Math.cos(a) * 0.6]} rotation={[0, a, 0]}>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * 0.075, k === 0 ? 0.08 : 0, 0]}>
                <sphereGeometry args={[0.068, 14, 14]} />
                <Toon color={k === 0 ? '#FF6B78' : '#E04E5B'} map={grad} />
                <Ink thin />
              </mesh>
            ))}
            <mesh geometry={leaf} position={[0, 0.02, 0.09]} rotation={[1.2, 0, 0.4]} scale={0.6}>
              <Toon color="#7ED957" map={grad} />
              <Ink thin />
            </mesh>
          </group>
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------- wand */

function crescentShape(r = 0.24) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-r * 0.3, 0, r * 0.8, Math.PI / 2, -Math.PI / 2, true);
  return s;
}

function Wand({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  const ref = useRef<THREE.Group>(null);
  const bubbles = useRef<THREE.Group>(null);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.22, 0.1), { depth: 0.06, bevelEnabled: false }), []);
  const moon = useMemo(() => new THREE.ExtrudeGeometry(crescentShape(0.24), { depth: 0.06, bevelEnabled: false }), []);
  const leaf = useMemo(() => new THREE.ExtrudeGeometry(leafShape(0.2), { depth: 0.03, bevelEnabled: false }), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.z = -0.28 + Math.sin(t * 2) * 0.12;
      ref.current.rotation.x = Math.sin(t * 1.3) * 0.06;
    }
    if (bubbles.current) {
      bubbles.current.rotation.y = t * 0.7;
      bubbles.current.position.y = 0.92 + Math.sin(t * 1.8) * 0.05;
    }
  });
  if (!kind) return null;
  const stick = kind === 'flower' ? '#7ED957' : kind === 'moon' ? '#A77BFF' : kind === 'bubble' ? '#4FC3FF' : '#FFE066';
  const spark = kind === 'bubble' ? '#BFE9FF' : kind === 'flower' ? '#FF9AD5' : '#FFD93D';

  return (
    <group ref={ref} position={HAND}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.94, 12]} />
        <Toon color={stick} map={grad} />
        <Ink thin />
      </mesh>

      {kind === 'star' && (
        <>
          <mesh geometry={star} position={[0, 0.9, -0.03]}>
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
          {/* ribbon streamers, the wand's own tell */}
          <Pair>
            <mesh position={[0.07, 0.6, 0]} rotation={[0, 0, -0.5]}>
              <capsuleGeometry args={[0.018, 0.22, 4, 8]} />
              <Toon color="#FF6EC7" map={grad} />
            </mesh>
          </Pair>
        </>
      )}

      {kind === 'flower' && (
        <>
          <group position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <Flower color="#FF6EC7" grad={grad} r={0.19} />
          </group>
          <Pair>
            <mesh geometry={leaf} position={[0.07, 0.42, 0]} rotation={[0, 0.4, -1.1]}>
              <Toon color="#5FA84F" map={grad} />
              <Ink thin />
            </mesh>
          </Pair>
        </>
      )}

      {kind === 'moon' && (
        <mesh geometry={moon} position={[0, 0.92, -0.03]} rotation={[0, 0, 0.3]}>
          <Toon color="#FFD93D" map={grad} />
          <Ink thin />
        </mesh>
      )}

      {kind === 'bubble' && (
        <>
          <mesh position={[0, 0.92, 0]}>
            <torusGeometry args={[0.21, 0.035, 10, 32]} />
            <Toon color="#4FC3FF" map={grad} />
            <Ink thin />
          </mesh>
          <group ref={bubbles} position={[0, 0.92, 0]}>
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.sin(a) * 0.3, (i % 2) * 0.22, Math.cos(a) * 0.3]}>
                  <sphereGeometry args={[0.1 - (i % 3) * 0.02, 16, 16]} />
                  <meshToonMaterial color="#BFE9FF" gradientMap={grad} transparent opacity={0.85} />
                  <Ink thin />
                </mesh>
              );
            })}
          </group>
        </>
      )}

      <Sparkles count={18} scale={[0.75, 0.75, 0.75]} position={[0, 0.92, 0]} size={3} speed={0.6} color={spark} />
    </group>
  );
}

/* ------------------------------------------------------------------- root */

export default function Fairy3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveFairyColors(parts, colors);

  const dress = pickPart(parts.dress, 'petal');
  const wings = pickPart(parts.wings, 'butterfly');
  const hair = pickPart(parts.hair, 'long');
  const crown = pickPart(parts.crown, 'flower');
  const eyes = pickPart(parts.eyes, 'sparkly');
  const wand = pickPart(parts.wand, 'star');

  const EyesSvg = findOption(FAIRY, 'eyes', eyes ?? '')?.Svg;
  const eyesEl = useMemo(() => (eyes && EyesSvg ? <EyesSvg colors={eff} /> : null), [eyes, EyesSvg, eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const smileEl = useMemo(() => <Smile colors={eff} />, []); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const smileTex = useSvgTexture(smileEl);

  return (
    <group position={[0, 0.02, 0]}>
      <Part3D id="wings"><Wings kind={wings} color={eff.wings} grad={grad} /></Part3D>
      <Body skin={eff.skin} shoe={dress ? shade(eff.dress, -0.28) : shade(eff.skin, -0.22)} grad={grad} />
      <Part3D id="dress"><Dress kind={dress} color={eff.dress} grad={grad} /></Part3D>

      {/* neck */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.26, 16]} />
        <Toon color={eff.skin} map={grad} />
        <Ink thin />
      </mesh>

      {/* head — the face is the 2D drawing, projected */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[HEAD_R, 48, 48]} />
        <Toon color={eff.skin} map={grad} />
        <Ink />
        <FaceDecal tex={eyesTex} y={0.02} z={HEAD_R} size={0.95} />
        <FaceDecal tex={smileTex} y={-0.26} z={HEAD_R} size={0.55} />
      </mesh>

      {/* pointed fairy ears */}
      <Pair>
        <mesh position={[HEAD_R - 0.04, HEAD_Y + 0.08, 0]} rotation={[0, 0, -0.95]}>
          <coneGeometry args={[0.1, 0.36, 10]} />
          <Toon color={eff.skin} map={grad} />
          <Ink thin />
        </mesh>
      </Pair>

      <Part3D id="hair"><Hair kind={hair} color={eff.hair} grad={grad} /></Part3D>
      <Part3D id="crown"><Crown kind={crown} grad={grad} /></Part3D>
      <Part3D id="wand"><Wand kind={wand} grad={grad} /></Part3D>
    </group>
  );
}

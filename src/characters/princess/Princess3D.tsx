import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { findOption } from '../types';
import { PRINCESS, resolvePrincessColors } from './config';
import { DRESS_SHOWS_FEET, FaceBlush } from './parts';
import { INK3D, pickPart, starShape, useGradientMap, usePatternTexture, useSvgTexture } from '../../lib/three';
import type { PatternKind } from '../../lib/three';
import { shade } from '../../lib/color';
import Part3D from '../../components/Part3D';

/*
 * The same girl as the 2D drawing, in the round.
 *
 * Height landmarks (world units), so every piece lands where the drawing puts it:
 *   1.83  the top of her head        1.15  the middle of her head
 *   0.47  her chin                   0.22  her shoulders
 *  -0.27  her waist                 -1.70  the hem of the ball gown
 *  -1.84  her shoes
 */
const HEAD_Y = 1.15;
const HEAD_R = 0.68;
const CHIN_Y = HEAD_Y - HEAD_R;
const SHOULDER_Y = 0.22;
const WAIST_Y = -0.27;

/** Toon surface; a pattern texture carries the colour itself, so the tint goes white. */
function Toon({ color, map, tex, side }: { color: string; map: THREE.Texture; tex?: THREE.Texture | null; side?: THREE.Side }) {
  return <meshToonMaterial color={tex ? '#ffffff' : color} gradientMap={map} map={tex ?? null} side={side} />;
}

interface Skin {
  pattern: PatternKind;
  scale: number;
}

/** Fabric, mirroring the drawn dresses. */
const DRESS_SKIN: Record<string, Skin> = {
  gown: { pattern: 'stripes', scale: 2 },
  aline: { pattern: 'dots', scale: 3 },
  mermaid: { pattern: 'scales', scale: 3 },
  star: { pattern: 'smooth', scale: 1 },
};

const HAIR_SKIN: Record<string, Skin> = {
  long: { pattern: 'fur', scale: 2 }, // strand strokes
  braids: { pattern: 'stripes', scale: 1.6 }, // the plait's bands
  bun: { pattern: 'fur', scale: 2 },
  curly: { pattern: 'spots', scale: 1 },
};

function skinOf(map: Record<string, Skin>, kind: string | null, color: string) {
  if (!kind) return null;
  const s = map[kind] ?? { pattern: 'smooth' as PatternKind, scale: 1 };
  return { base: color, pattern: s.pattern, scale: s.scale };
}

/* --------------------------------------------------------------- shapes */

/** A lathe turned from a [radius, y] profile. A partial sweep leaves an open shell. */
function lathe(points: [number, number][], phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.002), y)),
    56,
    phiStart,
    phiLength,
  );
}

/**
 * One silhouette per dress, read bottom to top. These are the shapes a child
 * tells apart at a glance: a wide bell, a short flare, a tail, three steps.
 */
const SKIRT: Record<string, [number, number][]> = {
  // a huge round bell that sweeps the floor
  gown: [[0, -1.48], [1.32, -1.46], [1.26, -1.46], [1.02, -1.12], [0.76, -0.82], [0.58, -0.54], [0.48, -0.32], [0.42, -0.27], [0, -0.24]],
  // stops at her knees, so her legs show
  aline: [[0, -0.98], [0.88, -0.96], [0.78, -0.76], [0.60, -0.52], [0.48, -0.32], [0.42, -0.27], [0, -0.24]],
  // hugs her legs, then opens into a fish tail on the floor
  mermaid: [[0, -1.86], [1.10, -1.84], [0.62, -1.46], [0.44, -1.10], [0.42, -0.76], [0.46, -0.46], [0.44, -0.28], [0, -0.24]],
  // three skirts stacked like steps; each little out-and-down pair is one hem
  star: [[0, -1.64], [0.98, -1.62], [0.72, -1.16], [0.88, -1.20], [0.58, -0.72], [0.72, -0.76], [0.44, -0.27], [0, -0.24]],
};

/** The skirt's radius at a height — the long hair drapes over whatever she wears. */
function skirtRadius(profile: [number, number][], y: number) {
  let r = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1)) continue;
    const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    r = Math.max(r, r0 + (r1 - r0) * t);
  }
  return r;
}

// far enough forward to peep out from under a long hem, the way the drawing shows them
const SHOE_Y = -1.72;
const SHOE_Z = 0.82;

/* ----------------------------------------------------------------- dress */

/** One shoe, drawn for the right foot; the left one is this mirrored. */
function Shoe({ color, grad }: { color: string; grad: THREE.DataTexture }) {
  return (
    <group>
      <mesh scale={[1, 0.72, 1.55]}>
        <sphereGeometry args={[0.16, 22, 22]} />
        <Toon color={color} map={grad} />
        <Ink thin />
      </mesh>
      {/* the strap across the top of her foot */}
      <mesh position={[0, 0.06, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.024, 8, 20]} />
        <Toon color={shade(color, 0.3)} map={grad} />
      </mesh>
    </group>
  );
}

function Dress({ kind, color, skin, grad }: { kind: string | null; color: string; skin: string; grad: THREE.DataTexture }) {
  const profile = SKIRT[kind ?? 'gown'] ?? SKIRT.gown;
  const skirt = useMemo(() => lathe(profile), [profile]);
  const bodice = useMemo(
    () => lathe([[0, WAIST_Y - 0.01], [0.44, WAIST_Y], [0.42, -0.06], [0.38, 0.04], [0.32, 0.14], [0.20, SHOULDER_Y], [0, 0.23]]),
    [],
  );
  const stars = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.12, 0.055), { depth: 0.03, bevelEnabled: false }), []);
  const cloth = usePatternTexture(skinOf(DRESS_SKIN, kind, color));
  if (!kind) return null;

  const shoeColor = shade(color, -0.32);
  const showFeet = DRESS_SHOWS_FEET[kind];
  const legs = kind === 'aline';

  return (
    <group>
      {/* the skirt — the silhouette that tells the four dresses apart */}
      <mesh geometry={skirt}>
        <Toon color={color} map={grad} tex={cloth} />
        <Ink />
      </mesh>

      {kind === 'gown' &&
        [...Array(16).keys()].map((i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 1.3, -1.52, Math.cos(a) * 1.3]} scale={[1, 0.7, 0.7]}>
              <sphereGeometry args={[0.18, 14, 14]} />
              <Toon color={shade(color, 0.28)} map={grad} />
              <Ink thin />
            </mesh>
          );
        })}

      {/* the fluke: two flat lobes spreading up and out, so it reads as a fish tail */}
      {kind === 'mermaid' && (
        <group position={[0, -1.8, -0.02]}>
          {[1, -1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.42, 0.14, 0]}
              rotation={[0, 0, side * -0.55]}
              scale={[0.95, 0.42, 0.34]}
            >
              <sphereGeometry args={[0.62, 26, 26]} />
              <Toon color={shade(color, 0.3)} map={grad} />
              <Ink />
            </mesh>
          ))}
          <mesh scale={[0.3, 0.3, 0.28]}>
            <sphereGeometry args={[0.6, 20, 20]} />
            <Toon color={shade(color, 0.12)} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}

      {kind === 'star' &&
        ([
          [0.0, -1.4, 0.88], [1.26, -1.4, 0.88], [2.51, -1.4, 0.88], [3.77, -1.4, 0.88], [5.03, -1.4, 0.88],
          [0.63, -0.96, 0.76], [1.88, -0.96, 0.76], [3.14, -0.96, 0.76], [4.4, -0.96, 0.76],
          [0.0, -0.5, 0.6], [2.09, -0.5, 0.6], [4.19, -0.5, 0.6],
        ] as [number, number, number][]).map(([a, y, r], i) => (
          <mesh key={i} geometry={stars} position={[Math.sin(a) * r, y, Math.cos(a) * r]} rotation={[0, a, 0]}>
            <meshToonMaterial color="#FFD93D" gradientMap={grad} />
          </mesh>
        ))}

      {/* her legs and shoes — one shape, mirrored into a real pair. Not the mermaid. */}
      {showFeet &&
        [1, -1].map((s) => (
          <group key={s} scale={[s, 1, 1]}>
            {legs && (
              <mesh position={[0.22, -1.4, SHOE_Z * 0.4]}>
                <capsuleGeometry args={[0.1, 0.62, 4, 14]} />
                <Toon color={skin} map={grad} />
                <Ink thin />
              </mesh>
            )}
            <group position={[0.22, SHOE_Y, SHOE_Z]}>
              <Shoe color={shoeColor} grad={grad} />
            </group>
          </group>
        ))}

      {/* shoulders, chest and waist */}
      <mesh geometry={bodice}>
        <Toon color={shade(color, -0.12)} map={grad} tex={cloth} />
        <Ink />
      </mesh>
      <mesh position={[0, WAIST_Y + 0.02, 0]}>
        <torusGeometry args={[0.44, 0.055, 8, 40]} />
        <Toon color={shade(color, -0.3)} map={grad} />
      </mesh>

      {kind === 'aline' && (
        <group position={[0, WAIST_Y + 0.02, 0.42]}>
          {[1, -1].map((s) => (
            <group key={s} scale={[s, 1, 1]}>
              <mesh position={[0.17, 0, 0]} rotation={[0, 0, 0.25]} scale={[1.25, 0.8, 0.6]}>
                <sphereGeometry args={[0.15, 18, 18]} />
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            </group>
          ))}
          <mesh>
            <sphereGeometry args={[0.09, 14, 14]} />
            <Toon color="#FFB800" map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}

      {/* puff sleeve, arm and hand — the left side is the right one mirrored */}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={[0.4, 0.1, 0]}>
            <mesh>
              <sphereGeometry args={[0.185, 20, 20]} />
              <Toon color={color} map={grad} tex={cloth} />
              <Ink thin />
            </mesh>
            <mesh position={[0.19, -0.3, 0.1]} rotation={[0.25, 0, 0.55]}>
              <capsuleGeometry args={[0.082, 0.5, 4, 12]} />
              <Toon color={skin} map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0.38, -0.55, 0.22]}>
              <sphereGeometry args={[0.115, 16, 16]} />
              <Toon color={skin} map={grad} />
              <Ink thin />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ hair */

/** Hair with no dress in the way: over the head, past her jaw, then straight down. */
function hairEnvelope(y: number) {
  const R = HEAD_R + 0.08;
  if (y > HEAD_Y) return Math.sqrt(Math.max(0.0025, R * R - (y - HEAD_Y) ** 2));
  if (y > SHOULDER_Y) return R;
  if (y > -0.3) return 0.46 + ((y + 0.3) / (SHOULDER_Y + 0.3)) * (R - 0.46);
  return 0.46;
}

/**
 * Long hair falls all the way to her shoes. Below the waist it follows whichever
 * skirt she is wearing (a little outside it), so it drapes over the dress instead
 * of disappearing inside it.
 */
function longHairProfile(skirt: [number, number][]): [number, number][] {
  const top = HEAD_Y + HEAD_R + 0.06;
  const bottom = -1.68;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 30; i++) {
    const y = bottom + ((top - bottom) * i) / 30;
    const sk = skirtRadius(skirt, y);
    pts.push([Math.max(hairEnvelope(y), sk > 0 ? sk + 0.07 : 0), y]);
  }
  return pts;
}

function Hair({ kind, dress, color, grad }: { kind: string | null; dress: string | null; color: string; grad: THREE.DataTexture }) {
  const tex = usePatternTexture(skinOf(HAIR_SKIN, kind, color));
  // open at the front by 150°, so her face stays clear
  const fall = useMemo(() => lathe(longHairProfile(SKIRT[dress ?? 'gown'] ?? SKIRT.gown), Math.PI * 0.42, Math.PI * 1.16), [dress]);
  const curls = useMemo(() => {
    const arr: [number, number, number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const ring = i < 18 ? 0 : 1;
      const n = ring === 0 ? 18 : 8;
      const k = ring === 0 ? i : i - 18;
      const a = (k / n) * Math.PI * 2;
      const rad = ring === 0 ? 0.64 : 0.52;
      const y = ring === 0 ? HEAD_Y + 0.18 + (k % 2 === 0 ? 0.14 : -0.06) : HEAD_Y - 0.62 + (k % 2 === 0 ? 0.1 : 0);
      arr.push([Math.cos(a) * rad, y, Math.sin(a) * rad - 0.05, 0.2 + (k % 3) * 0.035]);
    }
    return arr;
  }, []);
  if (!kind) return null;

  return (
    <group>
      {/* the cap over the top of her head: it stops on her forehead, well above her
          eyes — coming down any further it covered them and hid her face */}
      <mesh position={[0, HEAD_Y + 0.05, -0.05]}>
        <sphereGeometry args={[HEAD_R + 0.07, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        <Toon color={color} map={grad} tex={tex} />
        <Ink />
      </mesh>

      {kind === 'long' && (
        <>
          <mesh geometry={fall}>
            <Toon color={color} map={grad} tex={tex} side={THREE.DoubleSide} />
            <Ink />
          </mesh>
          {/* two locks brought forward over her shoulders */}
          {[1, -1].map((s) => (
            <group key={s} scale={[s, 1, 1]}>
              <mesh position={[0.42, 0.06, 0.38]} rotation={[0.15, 0, 0.1]}>
                <capsuleGeometry args={[0.15, 0.78, 6, 16]} />
                <Toon color={color} map={grad} tex={tex} />
                <Ink thin />
              </mesh>
            </group>
          ))}
        </>
      )}

      {kind === 'braids' &&
        [1, -1].map((s) => (
          <group key={s} scale={[s, 1, 1]}>
            <group position={[0.6, 0.8, 0.18]}>
              {[0, 1, 2, 3, 4].map((i) => (
                <mesh key={i} position={[i % 2 === 0 ? 0.035 : -0.035, -i * 0.26, 0]}>
                  <sphereGeometry args={[0.17, 18, 18]} />
                  <Toon color={color} map={grad} tex={tex} />
                  <Ink thin />
                </mesh>
              ))}
              <mesh position={[0, -1.22, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.12, 0.3, 0.12]} />
                <Toon color="#FF6B78" map={grad} />
                <Ink thin />
              </mesh>
            </group>
          </group>
        ))}

      {kind === 'bun' && (
        <mesh position={[0, HEAD_Y + HEAD_R + 0.22, -0.08]}>
          <sphereGeometry args={[0.32, 24, 24]} />
          <Toon color={color} map={grad} tex={tex} />
          <Ink />
        </mesh>
      )}

      {kind === 'curly' &&
        curls.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 18, 18]} />
            <Toon color={color} map={grad} tex={tex} />
            <Ink thin />
          </mesh>
        ))}
    </group>
  );
}

/* ----------------------------------------------------------------- crown */

function Crown({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  const y = HEAD_Y + HEAD_R - 0.06;
  if (!kind) return null;
  if (kind === 'gold') {
    return (
      <group position={[0, y + 0.12, 0]}>
        <mesh>
          <cylinderGeometry args={[0.36, 0.3, 0.28, 24, 1, true]} />
          <meshToonMaterial color="#FFD93D" gradientMap={grad} side={THREE.DoubleSide} />
          <Ink thin />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.33, 0.24, Math.cos(a) * 0.33]}>
              <coneGeometry args={[0.07, 0.24, 8]} />
              <meshToonMaterial color="#FFD93D" gradientMap={grad} />
              <Ink thin />
            </mesh>
          );
        })}
        <mesh position={[0, 0.02, 0.33]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshToonMaterial color="#FF6B78" gradientMap={grad} />
        </mesh>
      </group>
    );
  }
  if (kind === 'flowers') {
    // real blooms: five flat petals round a yellow middle, with leaves between them
    return (
      <group position={[0, y - 0.02, 0]} rotation={[0.15, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.045, 8, 40]} />
          <Toon color="#5FA83F" map={grad} />
          <Ink thin />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const c = ['#FF6EC7', '#ffffff', '#FF6B78', '#A77BFF', '#FFD93D'][i % 5];
          return (
            <group key={i} position={[Math.sin(a) * 0.5, 0.06, Math.cos(a) * 0.5]} rotation={[0.35, -a, 0]}>
              {[0, 1, 2, 3, 4].map((q) => {
                const b = (q / 5) * Math.PI * 2;
                return (
                  <mesh key={q} position={[Math.sin(b) * 0.1, 0, Math.cos(b) * 0.1]} scale={[1, 0.42, 1]}>
                    <sphereGeometry args={[0.085, 14, 14]} />
                    <Toon color={c} map={grad} />
                    <Ink thin />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.035, 0]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={[0.055, 12, 12]} />
                <meshToonMaterial color="#FFC400" gradientMap={grad} />
              </mesh>
            </group>
          );
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 + 0.3 + Math.PI / 5;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.5, 0.02, Math.cos(a) * 0.5]}
              rotation={[0.5, -a, 0]}
              scale={[0.55, 0.22, 1]}
            >
              <sphereGeometry args={[0.12, 12, 12]} />
              <Toon color="#7ED957" map={grad} />
              <Ink thin />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (kind === 'bow') {
    return (
      <group position={[0.36, y + 0.06, 0.12]} rotation={[0, 0, -0.4]}>
        {[1, -1].map((s) => (
          <group key={s} scale={[s, 1, 1]}>
            <mesh position={[0.2, 0.05, 0]} scale={[1.3, 0.8, 0.6]}>
              <sphereGeometry args={[0.16, 20, 20]} />
              <Toon color="#FF6B78" map={grad} />
              <Ink thin />
            </mesh>
          </group>
        ))}
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <Toon color="#E04E5B" map={grad} />
          <Ink thin />
        </mesh>
      </group>
    );
  }
  // tiara: a silver band that rises into three points, with a jewel on each
  return (
    <group position={[0, y - 0.06, 0.03]} rotation={[0.3, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.47, 0.045, 10, 40, Math.PI * 1.15]} />
        <Toon color="#E4E9F7" map={grad} />
        <Ink thin />
      </mesh>
      {([
        [0, 0.3, 1],
        [-0.55, 0.19, 0.72],
        [0.55, 0.19, 0.72],
      ] as const).map(([a, h, k], i) => (
        <group key={i} position={[Math.sin(a) * 0.47, 0.02, Math.cos(a) * 0.47]} rotation={[0, -a, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <coneGeometry args={[0.1 * k, h, 4]} />
            <Toon color="#E4E9F7" map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, h + 0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.075 * k + 0.03, 0]} />
            <Toon color={i === 0 ? '#FF6EC7' : '#4FC3FF'} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- accessory */

function Accessory({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -0.25 + Math.sin(clock.getElapsedTime() * 2) * 0.12;
  });
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.22, 0.1), { depth: 0.06, bevelEnabled: false }), []);
  if (!kind) return null;
  // her right hand sits at about (0.78, -0.45, 0.22)
  return (
    <group ref={ref} position={[0.82, -0.4, 0.3]}>
      {kind === 'book' && (
        <group rotation={[0.2, -0.3, 0]} position={[0.02, 0.14, 0.06]}>
          <mesh>
            <boxGeometry args={[0.36, 0.46, 0.1]} />
            <Toon color="#A77BFF" map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0.02, 0, 0.055]}>
            <boxGeometry args={[0.28, 0.38, 0.01]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
      {kind === 'kitten' && (
        <group position={[0.02, 0.16, 0.1]}>
          <mesh position={[0, -0.1, 0]} scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.2, 20, 20]} />
            <Toon color="#FF9E4A" map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, 0.15, 0.05]}>
            <sphereGeometry args={[0.17, 20, 20]} />
            <Toon color="#FF9E4A" map={grad} />
            <Ink thin />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} scale={[s, 1, 1]}>
              <mesh position={[0.11, 0.3, 0.03]} rotation={[0, 0, -0.3]}>
                <coneGeometry args={[0.06, 0.14, 4]} />
                <Toon color="#FF9E4A" map={grad} />
                <Ink thin />
              </mesh>
            </group>
          ))}
          {/* a face: eyes, a nose, a smile and whiskers, so it is plainly a kitten */}
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.18, 0.2]}>
              <sphereGeometry args={[0.027, 10, 10]} />
              <meshBasicMaterial color={INK3D} />
            </mesh>
          ))}
          <mesh position={[0, 0.12, 0.215]} scale={[1, 0.7, 0.7]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color="#FF6B78" />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * 0.035, 0.085, 0.2]} rotation={[0, 0, s * 0.5]}>
              <torusGeometry args={[0.035, 0.008, 6, 14, Math.PI]} />
              <meshBasicMaterial color={INK3D} />
            </mesh>
          ))}
          {[1, -1].map((s) =>
            [0, 1].map((k) => (
              <mesh
                key={`${s}-${k}`}
                position={[s * 0.13, 0.11 + k * 0.035, 0.16]}
                rotation={[0, 0, s * (0.1 - k * 0.25)]}
              >
                <boxGeometry args={[0.12, 0.006, 0.006]} />
                <meshBasicMaterial color={INK3D} />
              </mesh>
            )),
          )}
        </group>
      )}

      {(kind === 'wand' || kind === 'scepter') && (
        <group rotation={[0, 0, 0.1]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.035, 0.9, 10]} />
            <Toon color={kind === 'wand' ? '#FFE066' : '#FFD93D'} map={grad} />
            <Ink thin />
          </mesh>
          {kind === 'wand' ? (
            <mesh geometry={star} position={[0, 0.85, -0.03]}>
              <Toon color="#FFD93D" map={grad} />
              <Ink thin />
            </mesh>
          ) : (
            <mesh position={[0, 0.88, 0]}>
              <sphereGeometry args={[0.14, 20, 20]} />
              <Toon color="#4FC3FF" map={grad} />
              <Ink thin />
            </mesh>
          )}
          <Sparkles count={14} scale={[0.6, 0.6, 0.6]} position={[0, 0.85, 0]} size={3} speed={0.6} color="#FFD93D" />
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Princess3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolvePrincessColors(parts, colors);
  const dressKind = pickPart(parts.dress, 'gown');
  const EyesSvg = findOption(PRINCESS, 'eyes', pickPart(parts.eyes, 'sparkly') ?? '')?.Svg;
  const MouthSvg = findOption(PRINCESS, 'mouth', pickPart(parts.mouth, 'smile') ?? '')?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => (MouthSvg ? <MouthSvg colors={eff} /> : null), [MouthSvg]); // eslint-disable-line react-hooks/exhaustive-deps
  const blushEl = useMemo(() => <FaceBlush colors={eff} />, [eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);
  const blushTex = useSvgTexture(blushEl);

  return (
    <group position={[0, -0.05, 0]}>
      <Part3D id="dress"><Dress kind={dressKind} color={eff.dress} skin={eff.skin} grad={grad} /></Part3D>

      {/* her neck: the bodice closes round the bottom of it, her chin covers the top */}
      <mesh position={[0, (CHIN_Y + SHOULDER_Y) / 2 - 0.04, 0]}>
        <cylinderGeometry args={[0.15, 0.21, CHIN_Y - SHOULDER_Y + 0.28, 20]} />
        <Toon color={eff.skin} map={grad} />
        <Ink thin />
      </mesh>

      {/* her head, wearing the same eyes, mouth and cheeks as the drawing */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[HEAD_R, 48, 48]} />
        <Toon color={eff.skin} map={grad} />
        <Ink />
        <FaceDecal order={1} tex={blushTex} y={0.02} z={HEAD_R} size={0.95} />
        <FaceDecal order={2} part="eyes" tex={eyesTex} y={0.02} z={HEAD_R} size={0.95} />
        <FaceDecal order={3} part="mouth" tex={mouthTex} y={-0.26} z={HEAD_R} size={0.55} />
      </mesh>

      {/* ears — one shape and its mirror */}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh position={[HEAD_R, HEAD_Y - 0.05, 0]}>
            <sphereGeometry args={[0.1, 14, 14]} />
            <Toon color={eff.skin} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      ))}

      <Part3D id="hair"><Hair kind={pickPart(parts.hair, 'long')} dress={dressKind} color={eff.hair} grad={grad} /></Part3D>
      <Part3D id="crown"><Crown kind={pickPart(parts.crown, 'tiara')} grad={grad} /></Part3D>
      <Part3D id="accessory"><Accessory kind={pickPart(parts.accessory, 'wand')} grad={grad} /></Part3D>
    </group>
  );
}

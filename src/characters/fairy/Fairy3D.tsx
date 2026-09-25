import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { resolveFairyColors } from './config';
import { leafShape, pickPart, starShape, useGradientMap } from '../../lib/three';
import { shade } from '../../lib/color';
import Limb from '../../components/Limb';
import Part3D from '../../components/Part3D';

/**
 * The fairy, built to the picture Clara sent.
 *
 * The earlier one was a doll with a face printed on a ball. This one is modelled: her
 * eyes are real eyes with an iris, a pupil, a highlight and lashes; she has eyebrows, a
 * little nose, pointed fairy ears and a chin. Her body has a waist, a sweetheart bodice
 * over a skirt of pointed petals, small hands with fingers and ballet flats, and her
 * wings are panes of coloured glass with veins running through them.
 *
 * Heights: the crown of her head is at y≈1.9, her chin at 0.62, shoulders at 0.42, the
 * belt at 0.05 and her soles at -1.55, which puts her at about four heads tall — the
 * proportion that makes the drawing read as a child rather than as a doll.
 */

const HEAD_Y = 1.24;
const HEAD_R = 0.62;
/** Right shoulder joint; the left is this reflected. */
const SHOULDER: [number, number, number] = [0.32, 0.44, 0];
/** Right hand, where a wand sits. */
const HAND: [number, number, number] = [0.5, -0.36, 0.14];
/** Right hip; the leg hangs from here. */
const HIP: [number, number, number] = [0.16, -0.04, 0];
const SOLE_Y = -1.55;

const EYE_X = 0.23;
const EYE_Y = 0.02;

function Toon({ color, map, side }: { color: string; map: THREE.Texture; side?: THREE.Side }) {
  return <meshToonMaterial color={color} gradientMap={map} side={side} />;
}

/** Flat colour with no shading at all, for pupils, lashes and the like. */
function Flat({ color }: { color: string }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
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

/** A surface of revolution from a [radius, height] profile. */
function lathe(points: [number, number][], segments = 48) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)),
    segments,
  );
}

/* ------------------------------------------------------------------- face */

const LASH = '#3B2418';
const BROW = '#8A5A2B';

/**
 * One eye, modelled rather than painted: a white ball set into the face, a coloured
 * iris, a wide pupil, two highlights and a lash line over the top. The four eye styles
 * are the same eye opened, closed or half closed.
 */
function Eye({ kind, grad, big }: { kind: string; grad: THREE.DataTexture; big?: boolean }) {
  const r = big ? 0.2 : 0.175;
  const closed = kind === 'closed';
  if (closed) {
    // a happy eye: a smiling arc where the eye would be
    return (
      <group position={[EYE_X, EYE_Y, 0]}>
        <mesh position={[0, 0, HEAD_R * 0.9]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[r * 0.78, 0.028, 8, 24, Math.PI]} />
          <Flat color={LASH} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[EYE_X, EYE_Y, 0]}>
      {/* the white of the eye, sunk into the face */}
      <mesh position={[0, 0, HEAD_R * 0.76]} scale={[1, 1.16, 0.62]}>
        <sphereGeometry args={[r, 28, 28]} />
        <Toon color="#FFFFFF" map={grad} />
        <Ink thin />
      </mesh>
      {/* iris, pupil and the light in it */}
      <mesh position={[0.008, -0.004, HEAD_R * 0.76 + r * 0.5]} scale={[1, 1, 0.42]}>
        <sphereGeometry args={[r * 0.72, 24, 24]} />
        <Flat color="#17A67C" />
      </mesh>
      <mesh position={[0.008, -0.004, HEAD_R * 0.76 + r * 0.62]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[r * 0.42, 20, 20]} />
        <Flat color="#10161F" />
      </mesh>
      <mesh position={[-0.05, 0.06, HEAD_R * 0.76 + r * 0.66]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[r * 0.2, 14, 14]} />
        <Flat color="#FFFFFF" />
      </mesh>
      <mesh position={[0.06, -0.07, HEAD_R * 0.76 + r * 0.64]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[r * 0.09, 12, 12]} />
        <Flat color="#FFFFFF" />
      </mesh>
      {/* the lash line over the top, thicker at the outer corner */}
      <mesh position={[0, 0.01, HEAD_R * 0.76 + 0.02]} rotation={[0, 0, -0.25]}>
        <torusGeometry args={[r * 1.02, 0.026, 8, 26, Math.PI * 0.85]} />
        <Flat color={LASH} />
      </mesh>
      {kind !== 'plain' && (
        <mesh position={[r * 0.95, r * 0.5, HEAD_R * 0.76]} rotation={[0, 0, -0.9]}>
          <coneGeometry args={[0.022, 0.12, 8]} />
          <Flat color={LASH} />
        </mesh>
      )}
    </group>
  );
}

function Eyes({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  if (!kind) return null;
  const big = kind === 'big';
  if (kind === 'happy') {
    return (
      <Pair>
        <Eye kind="closed" grad={grad} />
      </Pair>
    );
  }
  if (kind === 'wink') {
    // one eye open, one closed: the pair is drawn by hand here
    return (
      <>
        <group>
          <Eye kind="open" grad={grad} />
        </group>
        <group scale={[-1, 1, 1]}>
          <Eye kind="closed" grad={grad} />
        </group>
      </>
    );
  }
  return (
    <Pair>
      <Eye kind={kind === 'sparkly' ? 'sparkly' : 'plain'} grad={grad} big={big} />
    </Pair>
  );
}

/** Her face: brows, nose, smile and cheeks. The eyes are their own part. */
function Face({ skin, grad }: { skin: string; grad: THREE.DataTexture }) {
  return (
    <group>
      <Pair>
        <mesh position={[EYE_X, 0.27, HEAD_R * 0.8]} rotation={[0.1, -0.3, -0.18]}>
          <torusGeometry args={[0.12, 0.022, 8, 20, Math.PI * 0.6]} />
          <Flat color={BROW} />
        </mesh>
      </Pair>
      {/* the little nose */}
      <mesh position={[0, -0.1, HEAD_R * 0.93]} scale={[1, 0.85, 0.75]}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <Toon color={shade(skin, -0.06)} map={grad} />
      </mesh>
      {/* a closed smile, curving up */}
      <mesh position={[0, -0.3, HEAD_R * 0.84]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.13, 0.022, 8, 24, Math.PI * 0.8]} />
        <Flat color="#A8484A" />
      </mesh>
      {/* cheeks */}
      <Pair>
        <mesh position={[0.34, -0.14, HEAD_R * 0.72]} scale={[1.25, 0.85, 0.25]}>
          <sphereGeometry args={[0.1, 18, 18]} />
          <meshBasicMaterial color="#FF9AA8" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </Pair>
    </group>
  );
}

/** Her head: a soft ball with cheeks, a chin and a pair of pointed fairy ears. */
function Head({ skin, grad }: { skin: string; grad: THREE.DataTexture }) {
  const head = useMemo(
    () =>
      lathe([
        [0.0, -0.66],
        [0.26, -0.62],
        [0.46, -0.48],
        [0.58, -0.24],
        [0.62, 0.04],
        [0.58, 0.34],
        [0.42, 0.56],
        [0.2, 0.64],
        [0.0, 0.66],
      ]),
    [],
  );
  return (
    <group position={[0, HEAD_Y, 0]}>
      <mesh geometry={head} scale={[1, 1, 0.94]}>
        <Toon color={skin} map={grad} />
        <Ink />
      </mesh>
      {/* pointed ears, tipped back along the head */}
      <Pair>
        <group position={[HEAD_R * 0.9, 0.02, -0.04]} rotation={[0, 0, -0.5]}>
          <mesh scale={[0.55, 1, 0.42]}>
            <sphereGeometry args={[0.17, 18, 18]} />
            <Toon color={skin} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0.02, 0.15, 0]} rotation={[0, 0, -0.15]}>
            <coneGeometry args={[0.075, 0.16, 12]} />
            <Toon color={skin} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      </Pair>
    </group>
  );
}

/* ------------------------------------------------------------------- hair */

/** A five-petal bloom, for the flowers in her hair. */
function Bloom({ color, grad, r = 1 }: { color: string; grad: THREE.DataTexture; r?: number }) {
  return (
    <group scale={r}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.09, 0, Math.cos(a) * 0.09]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.075, 14, 14]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
        );
      })}
      <mesh position={[0, 0.03, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <Toon color="#7ED957" map={grad} />
      </mesh>
    </group>
  );
}

function Hair({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const dark = shade(color, -0.16);
  if (!kind) return null;

  /** The skull cap and the swept fringe every style wears. */
  const cap = (
    <group position={[0, HEAD_Y, 0]}>
      <mesh position={[0, 0.02, -0.03]} scale={[1.04, 1.02, 1.02]}>
        <sphereGeometry args={[HEAD_R + 0.04, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {/* the fringe: a long sweep from the parting across her forehead… */}
      <mesh position={[0.05, 0.1, 0.03]} rotation={[0.3, -0.18, -0.26]} scale={[1.06, 1, 1.03]}>
        <sphereGeometry args={[HEAD_R + 0.05, 36, 36, Math.PI * 0.62, Math.PI * 0.86, 0, Math.PI * 0.34]} />
        <Toon color={color} map={grad} side={THREE.DoubleSide} />
        <Ink thin />
      </mesh>
      {/* …and the short side of the parting, which leaves her forehead showing */}
      <mesh position={[-0.02, 0.14, 0.02]} rotation={[0.22, 0.5, 0.18]} scale={[1.05, 1, 1.02]}>
        <sphereGeometry args={[HEAD_R + 0.045, 32, 32, Math.PI * 0.05, Math.PI * 0.4, 0, Math.PI * 0.26]} />
        <Toon color={color} map={grad} side={THREE.DoubleSide} />
        <Ink thin />
      </mesh>
      {/* the two strands that fall in front of her ears */}
      <Pair>
        <Limb
          pts={[
            [0.5, 0.36, 0.12],
            [0.56, 0.02, 0.16],
            [0.5, -0.3, 0.16],
          ]}
          r={0.085}
          tip={0.045}
        >
          <Toon color={color} map={grad} />
        </Limb>
      </Pair>
    </group>
  );

  return (
    <group>
      {cap}

      {kind === 'buns' && (
        <Pair>
          <group position={[0.6, HEAD_Y + 0.62, -0.12]}>
            <mesh scale={[1, 0.95, 0.9]}>
              <sphereGeometry args={[0.38, 30, 30]} />
              <Toon color={color} map={grad} />
              <Ink />
            </mesh>
            {/* the twist of the bun */}
            <mesh rotation={[0.4, 0, 0.3]} scale={[1, 0.5, 1]}>
              <torusGeometry args={[0.22, 0.075, 10, 28]} />
              <Toon color={dark} map={grad} />
            </mesh>
          </group>
        </Pair>
      )}

      {kind === 'long' && (
        <>
          <mesh position={[0, HEAD_Y - 0.5, -0.24]} scale={[1, 1.5, 0.6]}>
            <sphereGeometry args={[0.6, 32, 32]} />
            <Toon color={color} map={grad} />
            <Ink />
          </mesh>
          <Pair>
            <Limb
              pts={[
                [0.54, HEAD_Y + 0.1, 0.12],
                [0.6, HEAD_Y - 0.4, 0.14],
                [0.52, HEAD_Y - 0.95, 0.12],
              ]}
              r={0.13}
              tip={0.07}
            >
              <Toon color={color} map={grad} />
            </Limb>
          </Pair>
        </>
      )}

      {kind === 'curly' &&
        Array.from({ length: 16 }, (_, i) => {
          const a = 1.1 + (i / 15) * (Math.PI * 2 - 2.2);
          const row = i % 2;
          const rad = HEAD_R + 0.14;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * rad, HEAD_Y + 0.26 - row * 0.34, Math.cos(a) * rad]}
              scale={[1, 0.95, 1]}
            >
              <sphereGeometry args={[0.2, 18, 18]} />
              <Toon color={color} map={grad} />
              <Ink thin />
            </mesh>
          );
        })}

      {kind === 'braid' && (
        <group position={[0.1, 0, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[0.5 + i * 0.02, HEAD_Y - 0.1 - i * 0.26, 0.06]} scale={[1, 0.9, 1]}>
              <sphereGeometry args={[0.15 - i * 0.008, 18, 18]} />
              <Toon color={color} map={grad} />
              <Ink thin />
            </mesh>
          ))}
          <mesh position={[0.62, HEAD_Y - 1.52, 0.06]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.07, 0.025, 8, 18]} />
            <Toon color="#FF6EC7" map={grad} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ crown */

function Crown({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  if (!kind) return null;
  const y = HEAD_Y + 0.5;

  if (kind === 'flower') {
    // the two blooms pinned to her buns, exactly where the picture has them
    return (
      <Pair>
        <group position={[0.44, y + 0.26, 0.24]} rotation={[0.3, 0.4, 0]}>
          <Bloom color="#C9A7FF" grad={grad} r={1.25} />
          <group position={[-0.1, -0.02, 0.08]} scale={0.85}>
            <Bloom color="#E9DAFF" grad={grad} r={1.05} />
          </group>
        </group>
      </Pair>
    );
  }
  if (kind === 'leaf') {
    const leaf = new THREE.ExtrudeGeometry(leafShape(0.34), { depth: 0.04, bevelEnabled: false });
    return (
      <group position={[0, y - 0.12, 0]}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = 1.2 + (i / 6) * (Math.PI * 2 - 2.4);
          return (
            <mesh key={i} geometry={leaf} position={[Math.sin(a) * 0.52, 0, Math.cos(a) * 0.52]} rotation={[0.5, -a, 0]}>
              <Toon color="#7ED957" map={grad} />
              <Ink thin />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (kind === 'star') {
    const star = new THREE.ExtrudeGeometry(starShape(0.12, 0.055), { depth: 0.04, bevelEnabled: false });
    return (
      <group position={[0, y - 0.08, 0]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = 1.3 + (i / 5) * (Math.PI * 2 - 2.6);
          return (
            <mesh key={i} geometry={star} position={[Math.sin(a) * 0.5, 0.04, Math.cos(a) * 0.5]} rotation={[0.4, -a, 0]}>
              <Toon color="#FFD93D" map={grad} />
              <Ink thin />
            </mesh>
          );
        })}
      </group>
    );
  }
  // berry
  return (
    <group position={[0, y - 0.1, 0]}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = 1.2 + (i / 8) * (Math.PI * 2 - 2.4);
        return (
          <mesh key={i} position={[Math.sin(a) * 0.5, i % 2 ? 0.04 : -0.02, Math.cos(a) * 0.5]}>
            <sphereGeometry args={[i % 2 ? 0.075 : 0.06, 16, 16]} />
            <Toon color={i % 2 ? '#FF6B78' : '#A77BFF'} map={grad} />
            <Ink thin />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ dress */

/** One pointed petal of the skirt, hanging from the belt. */
function Petal({ color, grad, len, wide }: { color: string; grad: THREE.DataTexture; len: number; wide: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(wide, -len * 0.35, wide * 0.72, -len * 0.72);
    s.quadraticCurveTo(wide * 0.4, -len, 0, -len);
    s.quadraticCurveTo(-wide * 0.4, -len, -wide * 0.72, -len * 0.72);
    s.quadraticCurveTo(-wide, -len * 0.35, 0, 0);
    return s;
  }, [len, wide]);
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), [shape]);
  return (
    <mesh geometry={geo}>
      <Toon color={color} map={grad} side={THREE.DoubleSide} />
      <Ink thin />
    </mesh>
  );
}

/** The bodice: a strapless top with a sweetheart neckline, nipped in at the waist. */
const BODICE: [number, number][] = [
  [0.0, 0.02],
  [0.3, 0.03],
  [0.285, 0.16],
  [0.32, 0.3],
  [0.36, 0.44],
  [0.34, 0.52],
  [0.0, 0.54],
];

function Dress({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const bodice = useMemo(() => lathe(BODICE), []);
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.12, 0.055), { depth: 0.04, bevelEnabled: false }), []);
  if (!kind) return null;
  const light = shade(color, 0.26);
  const belt = '#E0308E';

  /** Petals round the waist, two shades, the second ring offset between the first. */
  const skirt = (len: number, wide: number, n: number) => (
    <group position={[0, 0.02, 0]}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const back = i % 2 === 1;
        return (
          <group
            key={i}
            position={[Math.sin(a) * 0.29, 0, Math.cos(a) * 0.29]}
            rotation={[0.3, a, 0]}
          >
            <Petal color={back ? light : color} grad={grad} len={back ? len * 0.92 : len} wide={wide} />
          </group>
        );
      })}
    </group>
  );

  return (
    <group>
      {/* the top */}
      <mesh geometry={bodice} scale={[1, 1, 0.88]}>
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {/* the sweetheart neckline: two soft lobes over the chest */}
      <Pair>
        <mesh position={[0.15, 0.5, 0.14]} scale={[1, 0.7, 0.7]}>
          <sphereGeometry args={[0.15, 20, 20]} />
          <Toon color={color} map={grad} />
        </mesh>
      </Pair>

      {/* the belt and its round buckle */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.88, 1]}>
        <torusGeometry args={[0.295, 0.055, 10, 36]} />
        <Toon color={belt} map={grad} />
        <Ink thin />
      </mesh>
      <mesh position={[0, 0.05, 0.3]} scale={[1, 1, 0.5]}>
        <sphereGeometry args={[0.085, 18, 18]} />
        <Toon color={shade(belt, 0.4)} map={grad} />
        <Ink thin />
      </mesh>

      {kind === 'petal' && skirt(0.8, 0.21, 9)}
      {kind === 'leaf' && skirt(0.92, 0.17, 11)}
      {kind === 'star' && (
        <>
          {skirt(0.74, 0.22, 8)}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} geometry={star} position={[Math.sin(a) * 0.3, -0.3, Math.cos(a) * 0.3]} rotation={[0, -a, 0]}>
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            );
          })}
        </>
      )}
      {kind === 'bubble' && (
        <mesh position={[0, -0.24, 0]} scale={[1, 0.86, 1]}>
          <sphereGeometry args={[0.5, 30, 30]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ wings */

/** A long wing pane: wide at the shoulder, drawn out to a rounded point. */
function wingShape(len: number, wide: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.25, wide, len * 0.75, wide * 0.92, len, wide * 0.22);
  s.bezierCurveTo(len * 0.78, -wide * 0.22, len * 0.3, -wide * 0.5, 0, 0);
  return s;
}

/** One pane of wing, see-through, with veins fanning out of the root. */
function Pane({
  len,
  wide,
  color,
  tilt,
  grad,
}: {
  len: number;
  wide: number;
  color: string;
  tilt: number;
  grad: THREE.DataTexture;
}) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(wingShape(len, wide), { depth: 0.035, bevelEnabled: false }), [len, wide]);
  const veins = useMemo(() => Array.from({ length: 5 }, (_, i) => -0.3 + (i / 4) * 0.9), []);
  return (
    <group rotation={[0, 0, tilt]}>
      <mesh geometry={geo}>
        <meshToonMaterial
          color={color}
          gradientMap={grad}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {veins.map((k, i) => (
        <mesh key={i} position={[len * 0.5, wide * 0.2 * k, 0.03]} rotation={[0, 0, k * 0.34]}>
          <boxGeometry args={[len * 0.86, 0.012, 0.004]} />
          <meshBasicMaterial color={shade(color, -0.3)} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
      {/* the rim, so the pane has an edge you can see against the light */}
      <mesh geometry={geo} scale={[1.015, 1.03, 1]} position={[0, 0, -0.008]}>
        <meshBasicMaterial color={shade(color, -0.18)} transparent opacity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Wings({ kind, color, grad }: { kind: string | null; color: string; grad: THREE.DataTexture }) {
  const hinge = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!hinge.current) return;
    const t = clock.getElapsedTime();
    hinge.current.rotation.y = 0.3 + Math.sin(t * 6) * 0.22;
  });
  if (!kind) return null;

  // in the picture a single wing is nearly as long as she is tall
  const upper = kind === 'dragonfly' ? 2.15 : 1.95;
  const lower = kind === 'dragonfly' ? 1.6 : 1.4;

  return (
    <group position={[0, 0.5, -0.16]}>
      <Pair>
        <group ref={hinge}>
          {kind === 'leaf' ? (
            <>
              <Pane len={upper} wide={0.66} color={color} tilt={0.45} grad={grad} />
              <Pane len={lower * 0.82} wide={0.54} color={shade(color, 0.2)} tilt={-0.35} grad={grad} />
            </>
          ) : kind === 'star' ? (
            <>
              <Pane len={upper} wide={0.56} color={color} tilt={0.55} grad={grad} />
              <Pane len={lower} wide={0.46} color={shade(color, 0.25)} tilt={-0.15} grad={grad} />
              <Pane len={lower * 0.7} wide={0.38} color={color} tilt={-0.6} grad={grad} />
            </>
          ) : (
            <>
              {/* the picture's wings: a long upper pane and a shorter one under it */}
              <Pane len={upper} wide={0.62} color={color} tilt={0.3} grad={grad} />
              <Pane len={lower} wide={0.5} color={shade(color, 0.22)} tilt={-0.38} grad={grad} />
            </>
          )}
        </group>
      </Pair>
      <Sparkles count={20} scale={[3.6, 2, 0.8]} position={[0, -0.1, -0.1]} size={2.4} speed={0.4} color="#FFF3B0" />
    </group>
  );
}

/* ------------------------------------------------------------------- wand */

function Wand({ kind, grad }: { kind: string | null; grad: THREE.DataTexture }) {
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.16, 0.07), { depth: 0.05, bevelEnabled: false }), []);
  if (!kind) return null;
  return (
    <group position={HAND} rotation={[0, 0, -0.18]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.72, 12]} />
        <Toon color="#FFE066" map={grad} />
        <Ink thin />
      </mesh>
      <group position={[0, 0.74, 0]}>
        {kind === 'star' && (
          <mesh geometry={star}>
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
        )}
        {kind === 'flower' && <Bloom color="#FF6EC7" grad={grad} r={1.6} />}
        {kind === 'moon' && (
          <mesh rotation={[0, 0, 0.6]}>
            <torusGeometry args={[0.14, 0.045, 10, 24, Math.PI * 1.3]} />
            <Toon color="#FFF3B0" map={grad} />
            <Ink thin />
          </mesh>
        )}
        {kind === 'bubble' && (
          <mesh>
            <sphereGeometry args={[0.15, 22, 22]} />
            <meshToonMaterial color="#9BE7FF" gradientMap={grad} transparent opacity={0.65} />
            <Ink thin />
          </mesh>
        )}
        <Sparkles count={14} scale={[0.7, 0.7, 0.7]} size={3} speed={0.6} color="#FFD93D" />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- body */

/** A little hand: a soft palm, four fingers and a thumb along the side. */
function Hand({ skin, grad }: { skin: string; grad: THREE.DataTexture }) {
  return (
    <group>
      <mesh scale={[1, 1.05, 0.7]}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      {[-1.2, -0.4, 0.4, 1.2].map((k) => {
        const a = k * 0.3;
        return (
          <mesh key={k} position={[Math.sin(a) * 0.07, -0.085 - Math.cos(a) * 0.02, 0]} rotation={[0, 0, -a]} scale={[1, 1, 0.8]}>
            <capsuleGeometry args={[0.028, 0.05, 4, 10]} />
            <Toon color={skin} map={grad} />
            <Ink thin />
          </mesh>
        );
      })}
      <mesh position={[-0.075, -0.02, 0.03]} rotation={[0, 0, 0.9]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.028, 0.04, 4, 10]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
    </group>
  );
}

function Arm({ skin, grad }: { skin: string; grad: THREE.DataTexture }) {
  return (
    <group position={SHOULDER}>
      <Limb
        pts={[
          [0.04, -0.04, 0],
          [0.13, -0.28, 0.04],
          [0.19, -0.52, 0.08],
          [0.22, -0.7, 0.1],
        ]}
        r={0.102}
        tip={0.05}
      >
        <Toon color={skin} map={grad} />
      </Limb>
      <group position={[0.23, -0.77, 0.11]} rotation={[0, 0, -0.1]}>
        <Hand skin={skin} grad={grad} />
      </group>
    </group>
  );
}

function Leg({ skin, shoe, grad }: { skin: string; shoe: string; grad: THREE.DataTexture }) {
  return (
    <group position={HIP}>
      <Limb
        pts={[
          [0, -0.04, 0],
          [0.02, -0.5, 0.01],
          [0.02, -0.95, 0.01],
          [0.02, -1.36, 0.02],
        ]}
        r={0.135}
        tip={0.085}
      >
        <Toon color={skin} map={grad} />
      </Limb>
      {/* ballet flat: round at the toe, with a low opening */}
      <group position={[0.02, SOLE_Y + 0.09, 0.07]}>
        <mesh scale={[1, 0.62, 1.8]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <Toon color={shoe} map={grad} />
          <Ink thin />
        </mesh>
        <mesh position={[0, 0.055, -0.05]} scale={[0.8, 0.5, 1.05]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <Toon color={shade(shoe, -0.32)} map={grad} />
        </mesh>
      </group>
    </group>
  );
}

/** Torso, arms and legs. Drawn on their own, so erasing the dress still leaves a fairy. */
function Body({ skin, shoe, grad }: { skin: string; shoe: string; grad: THREE.DataTexture }) {
  const torso = useMemo(
    () =>
      lathe([
        [0.0, -0.1],
        [0.28, -0.05],
        [0.265, 0.14],
        [0.3, 0.3],
        [0.335, 0.44],
        [0.31, 0.54],
        [0.17, 0.6],
        [0.0, 0.62],
      ]),
    [],
  );
  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, 0.88]}>
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      {/* the neck, short, the way a child's is */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 16]} />
        <Toon color={skin} map={grad} />
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

/* ------------------------------------------------------------------- root */

export default function Fairy3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap(5);
  const eff = resolveFairyColors(parts, colors);

  const dress = pickPart(parts.dress, 'petal');
  const wings = pickPart(parts.wings, 'butterfly');
  const hair = pickPart(parts.hair, 'buns');
  const crown = pickPart(parts.crown, 'flower');
  const eyes = pickPart(parts.eyes, 'sparkly');
  const wand = pickPart(parts.wand, 'star');

  return (
    <group position={[0, 0.05, 0]}>
      <Part3D id="wings">
        <Wings kind={wings} color={eff.wings} grad={grad} />
      </Part3D>

      <Body skin={eff.skin} shoe={dress ? '#E0308E' : shade(eff.skin, -0.2)} grad={grad} />

      <Part3D id="dress">
        <Dress kind={dress} color={eff.dress} grad={grad} />
      </Part3D>

      <Head skin={eff.skin} grad={grad} />
      <group position={[0, HEAD_Y, 0]}>
        <Face skin={eff.skin} grad={grad} />
      </group>

      <Part3D id="eyes">
        <group position={[0, HEAD_Y, 0]}>
          <Eyes kind={eyes} grad={grad} />
        </group>
      </Part3D>

      <Part3D id="hair">
        <Hair kind={hair} color={eff.hair} grad={grad} />
      </Part3D>

      <Part3D id="crown">
        <Crown kind={crown} grad={grad} />
      </Part3D>

      <Part3D id="wand">
        <Wand kind={wand} grad={grad} />
      </Part3D>
    </group>
  );
}

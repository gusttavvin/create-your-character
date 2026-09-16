import { useMemo, type ReactNode } from 'react';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { resolveSuperheroColors } from './config';
import { FaceEyes, FaceMouth, MaskEye } from './parts';
import { heartShape, polyShape, starShape, useGradientMap, useSvgTexture } from '../../lib/three';
import { shade } from '../../lib/color';

const HEAD_Y = 1.18;
const HEAD_R = 0.6;
/** Right hand; the left one is the same group mirrored with scale [-1,1,1]. */
const HAND: [number, number, number] = [0.72, -0.34, 0.12];

function Toon({ color, map }: { color: string; map: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={map} />;
}

/** Draws the children once and again mirrored, so both sides always match. */
function Pair({ children }: { children: ReactNode }) {
  return (
    <>
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          {children}
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ suit */

function Suit({ kind, color, skin, grad }: { kind: string; color: string; skin: string; grad: THREE.DataTexture }) {
  const dressed = kind !== '';
  const body = dressed ? color : skin;
  return (
    <group>
      {/* torso */}
      <mesh position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.36, 0.52, 6, 24]} />
        <Toon color={body} map={grad} />
        <Ink />
      </mesh>
      {kind === 'armour' && (
        <mesh position={[0, 0.2, 0.06]} scale={[1, 1, 0.8]}>
          <capsuleGeometry args={[0.35, 0.4, 6, 24]} />
          <Toon color={shade(color, 0.3)} map={grad} />
          <Ink thin />
        </mesh>
      )}
      {kind === 'stripes' &&
        [-0.2, 0, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.2, 0.3]} scale={[1, 1, 0.35]}>
            <boxGeometry args={[0.1, 0.72, 0.1]} />
            <Toon color={shade(color, 0.45)} map={grad} />
          </mesh>
        ))}
      {kind === 'hoodie' && (
        <mesh position={[0, 0.62, -0.22]} scale={[1.1, 0.9, 1]}>
          <sphereGeometry args={[0.36, 24, 24]} />
          <Toon color={shade(color, -0.14)} map={grad} />
          <Ink thin />
        </mesh>
      )}
      {/* belt */}
      {dressed && (
        <group position={[0, -0.3, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.34, 0.07, 10, 32]} />
            <Toon color={shade(color, -0.32)} map={grad} />
          </mesh>
          <mesh position={[0, 0, 0.36]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}
      {/* neck */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.26, 16]} />
        <Toon color={skin} map={grad} />
        <Ink thin />
      </mesh>
      {/* shoulders, arms, hands and legs */}
      <Pair>
        <group>
          <mesh position={[0.42, 0.45, 0]}>
            <sphereGeometry args={[0.17, 20, 20]} />
            <Toon color={kind === 'armour' ? shade(color, -0.16) : body} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0.57, 0.055, 0.06]} rotation={[0, 0, 0.36]}>
            <capsuleGeometry args={[0.115, 0.62, 6, 16]} />
            <Toon color={body} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={HAND}>
            <sphereGeometry args={[0.135, 18, 18]} />
            <Toon color={dressed ? shade(color, -0.22) : skin} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0.19, -0.92, 0]}>
            <capsuleGeometry args={[0.14, 0.62, 6, 16]} />
            <Toon color={body} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      </Pair>
    </group>
  );
}

/* ---------------------------------------------------------------- emblem */

function Emblem({ kind, color, grad }: { kind: string; color: string; grad: THREE.DataTexture }) {
  const geo = useMemo(() => {
    const shape =
      kind === 'bolt'
        ? polyShape([
            [0.1, 0.3],
            [-0.16, -0.02],
            [-0.01, -0.02],
            [-0.1, -0.32],
            [0.17, 0.03],
            [0.02, 0.03],
          ])
        : kind === 'heart'
          ? heartShape(0.3)
          : kind === 'shield'
            ? polyShape([
                [0, 0.3],
                [0.25, 0.18],
                [0.23, -0.06],
                [0, -0.3],
                [-0.23, -0.06],
                [-0.25, 0.18],
              ])
            : starShape(0.28, 0.13);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  }, [kind]);
  if (!kind) return null;
  const tint = kind === 'heart' ? '#FF6B78' : kind === 'shield' ? '#7ED957' : '#FFD93D';
  return (
    <group position={[0, 0.3, 0.26]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 32]} />
        <Toon color={shade(color, 0.55)} map={grad} />
        <Ink thin />
      </mesh>
      <mesh geometry={geo} position={[0, 0, 0.03]}>
        <Toon color={tint} map={grad} />
        <Ink thin />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ cape */

function Cape({ kind, color, grad }: { kind: string; color: string; grad: THREE.DataTexture }) {
  if (!kind) return null;
  const len = kind === 'short' ? 0.95 : kind === 'torn' ? 1.75 : 1.95;
  const y = 0.5 - len / 2;
  return (
    <group>
      <mesh position={[0, y, -0.12]}>
        <cylinderGeometry args={[0.44, kind === 'short' ? 0.62 : 0.82, len, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
        <meshToonMaterial color={color} gradientMap={grad} side={THREE.DoubleSide} />
        <Ink />
      </mesh>
      {/* collar */}
      <mesh position={[0, 0.52, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.07, 10, 32, Math.PI * 1.1]} />
        <Toon color={shade(color, -0.22)} map={grad} />
        <Ink thin />
      </mesh>
      {kind === 'star' &&
        [0.35, 0.85, 1.35].map((t, i) => (
          <mesh key={t} position={[i % 2 === 0 ? -0.22 : 0.22, 0.2 - t, -0.62]} rotation={[0, Math.PI, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.03, 5]} />
            <Toon color="#FFD93D" map={grad} />
          </mesh>
        ))}
      {kind === 'torn' &&
        [-0.36, -0.12, 0.12, 0.36].map((x) => (
          <mesh key={x} position={[x, y - len / 2 + 0.05, -0.62]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 0.28, 4]} />
            <Toon color={color} map={grad} />
          </mesh>
        ))}
    </group>
  );
}

/* ----------------------------------------------------------------- boots */

function Boots({ kind, color, grad }: { kind: string; color: string; grad: THREE.DataTexture }) {
  if (!kind) return null;
  const c = shade(color, -0.3);
  const shaft = kind === 'sneakers' ? 0.18 : kind === 'rocket' ? 0.34 : 0.46;
  return (
    <Pair>
      <group position={[0.19, 0, 0]}>
        <mesh position={[0, -1.62 + shaft / 2, 0]}>
          <cylinderGeometry args={[0.18, 0.19, shaft, 20]} />
          <Toon color={kind === 'sneakers' ? '#F4F6FF' : c} map={grad} />
          <Ink thin />
        </mesh>
        {/* foot, toe pointing forward and a touch outwards */}
        <mesh position={[0.03, -1.71, 0.11]} rotation={[0, 0.16, 0]}>
          <boxGeometry args={[0.28, 0.19, 0.46]} />
          <Toon color={kind === 'sneakers' ? '#F4F6FF' : c} map={grad} />
          <Ink thin />
        </mesh>
        <mesh position={[0.03, -1.79, 0.11]} rotation={[0, 0.16, 0]}>
          <boxGeometry args={[0.3, 0.06, 0.48]} />
          <Toon color={kind === 'sneakers' ? c : shade(c, -0.3)} map={grad} />
        </mesh>
        {kind === 'tall' && (
          <mesh position={[0, -1.14, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.14, 20]} />
            <Toon color={shade(c, 0.42)} map={grad} />
            <Ink thin />
          </mesh>
        )}
        {kind === 'armour' &&
          [-1.2, -1.36].map((y) => (
            <mesh key={y} position={[0, y, 0.02]}>
              <cylinderGeometry args={[0.22, 0.22, 0.11, 20]} />
              <Toon color={shade(c, 0.34)} map={grad} />
              <Ink thin />
            </mesh>
          ))}
        {kind === 'rocket' && (
          <group position={[0, -1.82, -0.16]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.14, 0.14, 14]} />
              <Toon color="#B9C6E4" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.12, 0.28, 14]} />
              <Toon color="#FF8A2A" map={grad} />
            </mesh>
            <mesh position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.07, 0.18, 12]} />
              <meshBasicMaterial color="#FFD93D" />
            </mesh>
          </group>
        )}
      </group>
    </Pair>
  );
}

/* ---------------------------------------------------------------- powers */

function Powers({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const bolt = useMemo(
    () =>
      new THREE.ExtrudeGeometry(
        polyShape([
          [0.08, 0.24],
          [-0.13, -0.02],
          [-0.01, -0.02],
          [-0.09, -0.26],
          [0.14, 0.02],
          [0.02, 0.02],
        ]),
        { depth: 0.04, bevelEnabled: false },
      ),
    [],
  );
  const smallStar = useMemo(
    () => new THREE.ExtrudeGeometry(starShape(0.11, 0.05), { depth: 0.04, bevelEnabled: false }),
    [],
  );
  if (!kind) return null;
  return (
    <Pair>
      <group position={HAND}>
        {kind === 'fire' && (
          <group position={[0.06, -0.16, 0.04]}>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.17, 0.42, 16]} />
              <Toon color="#FF8A2A" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0, -0.02, 0.02]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.09, 0.26, 14]} />
              <meshBasicMaterial color="#FFD93D" />
            </mesh>
            <Sparkles count={12} scale={[0.5, 0.5, 0.5]} size={3} speed={0.8} color="#FF8A2A" />
          </group>
        )}
        {kind === 'ice' && (
          <group position={[0.06, -0.18, 0.04]}>
            <mesh>
              <octahedronGeometry args={[0.2, 0]} />
              <Toon color="#9BE7FF" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0.16, -0.16, 0.05]}>
              <octahedronGeometry args={[0.1, 0]} />
              <Toon color="#E6FAFF" map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[-0.13, -0.18, 0.02]}>
              <octahedronGeometry args={[0.08, 0]} />
              <Toon color="#E6FAFF" map={grad} />
              <Ink thin />
            </mesh>
            <Sparkles count={10} scale={[0.5, 0.5, 0.5]} size={2.5} speed={0.4} color="#9BE7FF" />
          </group>
        )}
        {kind === 'bolt' && (
          <mesh geometry={bolt} position={[0.08, -0.2, 0.08]} rotation={[0, 0, -0.2]}>
            <Toon color="#FFD93D" map={grad} />
            <Ink thin />
          </mesh>
        )}
        {kind === 'stars' && (
          <group position={[0.08, -0.18, 0.06]}>
            {[
              [0, 0, 0],
              [0.14, -0.2, 0.04],
              [-0.12, -0.16, 0.02],
            ].map(([x, y, z], i) => (
              <mesh key={i} geometry={smallStar} position={[x, y, z]} scale={1 - i * 0.22}>
                <Toon color="#FFD93D" map={grad} />
                <Ink thin />
              </mesh>
            ))}
            <Sparkles count={12} scale={[0.6, 0.6, 0.6]} size={3} speed={0.6} color="#FFD93D" />
          </group>
        )}
      </group>
    </Pair>
  );
}

/* ------------------------------------------------------------------ mask */

function Mask({ kind, color, tex, grad }: { kind: string; color: string; tex: THREE.Texture | null; grad: THREE.DataTexture }) {
  if (!kind) return null;
  const c = shade(color, -0.28);
  if (kind === 'eye') {
    // the eye mask keeps its holes, so the art is projected onto the face
    return <FaceDecal tex={tex} y={0.05} z={HEAD_R} size={1.0} />;
  }
  if (kind === 'visor') {
    return (
      <mesh position={[0, HEAD_Y + 0.07, 0]}>
        <cylinderGeometry args={[HEAD_R + 0.03, HEAD_R + 0.03, 0.3, 28, 1, true, -Math.PI * 0.35, Math.PI * 0.7]} />
        <meshToonMaterial color={shade(color, -0.5)} gradientMap={grad} side={THREE.DoubleSide} />
        <Ink thin />
      </mesh>
    );
  }
  if (kind === 'helmet') {
    return (
      <group>
        <mesh position={[0, HEAD_Y + 0.02, -0.02]}>
          <sphereGeometry args={[HEAD_R + 0.07, 36, 36, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Toon color={c} map={grad} />
          <Ink />
        </mesh>
        <mesh position={[0, HEAD_Y + HEAD_R + 0.04, -0.02]} scale={[0.3, 1, 1]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <Toon color="#FFD93D" map={grad} />
          <Ink thin />
        </mesh>
        <Pair>
          <mesh position={[HEAD_R - 0.02, HEAD_Y - 0.06, 0]} scale={[0.5, 1, 1]}>
            <sphereGeometry args={[0.2, 18, 18]} />
            <Toon color={shade(c, -0.18)} map={grad} />
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
        <torusGeometry args={[HEAD_R + 0.01, 0.05, 10, 32]} />
        <Toon color={c} map={grad} />
      </mesh>
      <Pair>
        <group position={[0.21, HEAD_Y + 0.08, HEAD_R - 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.19, 0.19, 0.14, 22]} />
            <Toon color={c} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 22]} />
            <Toon color="#9BE7FF" map={grad} />
          </mesh>
        </group>
      </Pair>
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Superhero3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveSuperheroColors(parts, colors);

  const eyesEl = useMemo(() => <FaceEyes colors={eff} />, [eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => <FaceMouth colors={eff} />, []); // eslint-disable-line react-hooks/exhaustive-deps
  const maskEl = useMemo(() => (parts.mask === 'eye' ? <MaskEye colors={eff} /> : null), [parts.mask, eff.suit]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);
  const maskTex = useSvgTexture(maskEl);

  return (
    <group position={[0, -0.05, 0]}>
      <Cape kind={parts.cape ?? ''} color={eff.cape} grad={grad} />
      <Suit kind={parts.suit ?? ''} color={eff.suit} skin={eff.skin} grad={grad} />
      <Emblem kind={parts.emblem ?? ''} color={eff.suit} grad={grad} />
      <Boots kind={parts.boots ?? ''} color={eff.suit} grad={grad} />
      {/* head */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[HEAD_R, 48, 48]} />
        <Toon color={eff.skin} map={grad} />
        <Ink />
        <FaceDecal tex={eyesTex} y={0.05} z={HEAD_R} size={1.0} />
        <FaceDecal tex={mouthTex} y={-0.2} z={HEAD_R} size={0.62} />
        <Mask kind={parts.mask === 'eye' ? 'eye' : ''} color={eff.suit} tex={maskTex} grad={grad} />
      </mesh>
      {/* ears */}
      <Pair>
        <mesh position={[HEAD_R - 0.02, HEAD_Y - 0.03, 0]}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <Toon color={eff.skin} map={grad} />
          <Ink thin />
        </mesh>
      </Pair>
      {/* hair */}
      <mesh position={[0, HEAD_Y + 0.05, -0.04]}>
        <sphereGeometry args={[HEAD_R + 0.03, 36, 36, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        <Toon color="#2B1B12" map={grad} />
        <Ink thin />
      </mesh>
      {parts.mask !== 'eye' && <Mask kind={parts.mask ?? ''} color={eff.suit} tex={null} grad={grad} />}
      <Powers kind={parts.power ?? ''} grad={grad} />
    </group>
  );
}

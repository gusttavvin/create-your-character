import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { PRINCESS, resolvePrincessColors } from './config';
import { findOption } from '../types';
import { INK3D, starShape, useGradientMap, useSvgTexture } from '../../lib/three';
import { shade } from '../../lib/color';

const HEAD_Y = 1.15;
const HEAD_R = 0.68;

function Toon({ color, map }: { color: string; map: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={map} />;
}

/* ----------------------------------------------------------------- dress */

function lathe(points: [number, number][]) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  );
}

function Dress({ kind, color, skin, grad }: { kind: string; color: string; skin: string; grad: THREE.DataTexture }) {
  const geo = useMemo(() => {
    switch (kind) {
      case 'aline':
        return lathe([
          [0.0, -1.8],
          [0.9, -1.8],
          [0.6, -0.6],
          [0.42, 0.1],
          [0.34, 0.45],
          [0.0, 0.5],
        ]);
      case 'mermaid':
        return lathe([
          [0.0, -1.8],
          [0.95, -1.8],
          [0.5, -1.5],
          [0.36, -1.0],
          [0.4, -0.4],
          [0.42, 0.1],
          [0.34, 0.45],
          [0.0, 0.5],
        ]);
      case 'star':
        return lathe([
          [0.0, -1.8],
          [1.05, -1.8],
          [0.75, -0.9],
          [0.45, 0.1],
          [0.36, 0.45],
          [0.0, 0.5],
        ]);
      default: // gown
        return lathe([
          [0.0, -1.8],
          [1.25, -1.8],
          [1.1, -1.2],
          [0.7, -0.5],
          [0.42, 0.1],
          [0.34, 0.45],
          [0.0, 0.5],
        ]);
    }
  }, [kind]);
  const stars = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.13, 0.06), { depth: 0.03, bevelEnabled: false }), []);
  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={geo}>
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {/* sash / trim */}
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[0.43, 0.05, 8, 40]} />
        <Toon color={shade(color, -0.25)} map={grad} />
      </mesh>
      {kind === 'star' &&
        [0, 1.2, 2.4, 3.6, 4.8].map((a, i) => (
          <mesh key={i} geometry={stars} position={[Math.sin(a) * 0.82, -1.1 + (i % 2) * 0.35, Math.cos(a) * 0.82]} rotation={[0, a, 0]}>
            <meshToonMaterial color="#FFD93D" gradientMap={grad} />
          </mesh>
        ))}
      {kind === 'mermaid' && (
        <mesh position={[0, -1.72, 0]} scale={[1.4, 0.25, 1.1]}>
          <sphereGeometry args={[0.8, 24, 24]} />
          <Toon color={shade(color, 0.3)} map={grad} />
          <Ink />
        </mesh>
      )}
      {/* puff sleeves + arms */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.42, 0.35, 0]}>
          <mesh>
            <sphereGeometry args={[0.17, 20, 20]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[s * 0.16, -0.38, 0.05]} rotation={[0, 0, -s * 0.35]}>
            <capsuleGeometry args={[0.08, 0.6, 4, 12]} />
            <Toon color={skin} map={grad} />
            <Ink thin />
          </mesh>
          <mesh position={[s * 0.28, -0.72, 0.08]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            <Toon color={skin} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ hair */

function Hair({ kind, color, grad }: { kind: string; color: string; grad: THREE.DataTexture }) {
  const curls = useMemo(() => {
    const arr: [number, number, number, number][] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const lift = i % 2 === 0 ? 0.15 : -0.05;
      arr.push([Math.cos(a) * 0.62, HEAD_Y + 0.2 + lift, Math.sin(a) * 0.62 - 0.05, 0.22 + (i % 3) * 0.03]);
    }
    return arr;
  }, []);
  return (
    <group>
      {/* cap */}
      <mesh position={[0, HEAD_Y + 0.04, -0.06]}>
        <sphereGeometry args={[HEAD_R + 0.05, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {kind === 'long' && (
        <>
          <mesh position={[0, HEAD_Y - 0.55, -0.3]} scale={[1, 1.4, 0.55]}>
            <sphereGeometry args={[0.7, 32, 32]} />
            <Toon color={color} map={grad} />
            <Ink />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.6, HEAD_Y - 0.55, 0.05]}>
              <capsuleGeometry args={[0.17, 0.9, 6, 16]} />
              <Toon color={color} map={grad} />
              <Ink />
            </mesh>
          ))}
        </>
      )}
      {kind === 'braids' &&
        [-1, 1].map((s) => (
          <group key={s} position={[s * 0.66, HEAD_Y - 0.15, 0.05]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[s * (i % 2 === 0 ? 0.03 : -0.03), -i * 0.27, 0]}>
                <sphereGeometry args={[0.16, 18, 18]} />
                <Toon color={color} map={grad} />
                <Ink thin />
              </mesh>
            ))}
            <mesh position={[0, -1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.12, 0.28, 0.12]} />
              <Toon color="#FF6B78" map={grad} />
              <Ink thin />
            </mesh>
          </group>
        ))}
      {kind === 'bun' && (
        <mesh position={[0, HEAD_Y + HEAD_R + 0.2, -0.1]}>
          <sphereGeometry args={[0.3, 24, 24]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
      )}
      {kind === 'curly' &&
        curls.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 18, 18]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
        ))}
    </group>
  );
}

/* ----------------------------------------------------------------- crown */

function Crown({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const y = HEAD_Y + HEAD_R - 0.05;
  if (kind === 'gold') {
    return (
      <group position={[0, y + 0.1, 0]}>
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
    return (
      <group position={[0, y, 0]} rotation={[0.15, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.05, 8, 40]} />
          <Toon color="#7ED957" map={grad} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const a = (i / 7) * Math.PI * 2;
          const c = ['#FF6EC7', '#ffffff', '#FF6B78', '#A77BFF'][i % 4];
          return (
            <group key={i} position={[Math.sin(a) * 0.5, 0.04, Math.cos(a) * 0.5]}>
              {[0, 1, 2, 3, 4].map((p) => {
                const b = (p / 5) * Math.PI * 2;
                return (
                  <mesh key={p} position={[Math.sin(b) * 0.07, 0, Math.cos(b) * 0.07]}>
                    <sphereGeometry args={[0.05, 10, 10]} />
                    <meshToonMaterial color={c} gradientMap={grad} />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.02, 0]}>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshToonMaterial color="#FFD93D" gradientMap={grad} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }
  if (kind === 'bow') {
    return (
      <group position={[0.35, y + 0.05, 0.1]} rotation={[0, 0, -0.4]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, 0.05, 0]} scale={[1.3, 0.8, 0.6]}>
            <sphereGeometry args={[0.16, 20, 20]} />
            <Toon color="#FF6B78" map={grad} />
            <Ink thin />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <Toon color="#E04E5B" map={grad} />
          <Ink thin />
        </mesh>
      </group>
    );
  }
  // tiara
  return (
    <group position={[0, y - 0.05, 0.05]} rotation={[0.35, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.035, 8, 40, Math.PI]} />
        <Toon color="#E4E9F7" map={grad} />
        <Ink thin />
      </mesh>
      <mesh position={[0, 0.16, 0.42]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.12, 0]} />
        <Toon color="#FF6EC7" map={grad} />
        <Ink thin />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.36]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshToonMaterial color="#4FC3FF" gradientMap={grad} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- accessory */

function Accessory({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.12;
  });
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.22, 0.1), { depth: 0.06, bevelEnabled: false }), []);
  // right hand is around (0.7, -0.22, 0.13)
  return (
    <group ref={ref} position={[0.72, -0.2, 0.15]}>
      {kind === 'book' && (
        <group rotation={[0.2, -0.3, 0]} position={[0.05, 0.15, 0.1]}>
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
        <group position={[0.05, 0.15, 0.15]}>
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
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.11, 0.3, 0.03]} rotation={[0, 0, -s * 0.3]}>
              <coneGeometry args={[0.06, 0.14, 4]} />
              <Toon color="#FF9E4A" map={grad} />
              <Ink thin />
            </mesh>
          ))}
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.17, 0.2]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color={INK3D} />
            </mesh>
          ))}
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
  const EyesSvg = findOption(PRINCESS, 'eyes', parts.eyes)?.Svg;
  const MouthSvg = findOption(PRINCESS, 'mouth', parts.mouth)?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => (MouthSvg ? <MouthSvg colors={eff} /> : null), [MouthSvg]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);

  return (
    <group position={[0, -0.05, 0]}>
      <Dress kind={parts.dress} color={eff.dress} skin={eff.skin} grad={grad} />
      {/* neck */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.3, 16]} />
        <Toon color={eff.skin} map={grad} />
        <Ink thin />
      </mesh>
      {/* head */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[HEAD_R, 48, 48]} />
        <Toon color={eff.skin} map={grad} />
        <Ink />
        <FaceDecal tex={eyesTex} y={0.02} z={HEAD_R} size={0.95} />
        <FaceDecal tex={mouthTex} y={-0.26} z={HEAD_R} size={0.55} />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HEAD_R, HEAD_Y - 0.05, 0]}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <Toon color={eff.skin} map={grad} />
          <Ink thin />
        </mesh>
      ))}
      <Hair kind={parts.hair} color={eff.hair} grad={grad} />
      <Crown kind={parts.crown} grad={grad} />
      <Accessory kind={parts.accessory} grad={grad} />
    </group>
  );
}

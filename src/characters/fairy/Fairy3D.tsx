import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import type { ColorMap, PartMap } from '../types';
import { findOption } from '../types';
import { FAIRY, resolveFairyColors } from './config';
import { Smile } from './parts';
import { starShape, useGradientMap, useSvgTexture } from '../../lib/three';
import { shade } from '../../lib/color';

const HEAD_Y = 1.15;
const HEAD_R = 0.68;

function Toon({ color, map }: { color: string; map: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={map} />;
}

function lathe(points: [number, number][]) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  );
}

/* ----------------------------------------------------------------- dress */

function Dress({ kind, color, skin, grad }: { kind: string; color: string; skin: string; grad: THREE.DataTexture }) {
  const geo = useMemo(() => {
    switch (kind) {
      case 'leaf':
        return lathe([
          [0.0, -1.75],
          [0.95, -1.75],
          [0.68, -1.0],
          [0.45, 0.05],
          [0.34, 0.45],
          [0.0, 0.5],
        ]);
      case 'star':
        return lathe([
          [0.0, -1.75],
          [1.05, -1.75],
          [0.75, -0.9],
          [0.45, 0.1],
          [0.36, 0.45],
          [0.0, 0.5],
        ]);
      case 'bubble':
        return lathe([
          [0.0, -1.55],
          [0.6, -1.7],
          [1.12, -1.2],
          [1.18, -0.7],
          [0.62, -0.12],
          [0.38, 0.4],
          [0.0, 0.5],
        ]);
      default: // petal
        return lathe([
          [0.0, -1.75],
          [1.08, -1.7],
          [0.9, -1.15],
          [0.6, -0.45],
          [0.42, 0.1],
          [0.34, 0.45],
          [0.0, 0.5],
        ]);
    }
  }, [kind]);
  const stars = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.14, 0.065), { depth: 0.03, bevelEnabled: false }), []);
  const ring = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i / 8) * Math.PI * 2);

  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={geo}>
        <Toon color={color} map={grad} />
        <Ink />
      </mesh>
      {/* sash */}
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[0.43, 0.05, 8, 40]} />
        <Toon color={shade(color, -0.25)} map={grad} />
      </mesh>

      {kind === 'petal' &&
        ring.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 0.9, -1.5 + (i % 2) * 0.16, Math.cos(a) * 0.9]} rotation={[0.35, a, 0]} scale={[0.55, 0.85, 0.3]}>
            <sphereGeometry args={[0.5, 18, 18]} />
            <Toon color={shade(color, 0.22)} map={grad} />
            <Ink thin />
          </mesh>
        ))}
      {kind === 'leaf' &&
        ring.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 0.82, -1.86, Math.cos(a) * 0.82]} rotation={[Math.PI, a, 0.2]}>
            <coneGeometry args={[0.2, 0.42, 8]} />
            <Toon color={shade(color, 0.25)} map={grad} />
            <Ink thin />
          </mesh>
        ))}
      {kind === 'star' &&
        [0, 1.2, 2.4, 3.6, 4.8].map((a, i) => (
          <mesh key={i} geometry={stars} position={[Math.sin(a) * 0.82, -1.05 + (i % 2) * 0.35, Math.cos(a) * 0.82]} rotation={[0, a, 0]}>
            <meshToonMaterial color="#FFD93D" gradientMap={grad} />
          </mesh>
        ))}
      {kind === 'bubble' &&
        ring.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 1.02, -1.25 + (i % 2) * 0.3, Math.cos(a) * 1.02]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <Toon color={shade(color, 0.32)} map={grad} />
            <Ink thin />
          </mesh>
        ))}

      {/* puff sleeves + arms + hands */}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={[0.42, 0.35, 0]}>
            <mesh>
              <sphereGeometry args={[0.17, 20, 20]} />
              <Toon color={color} map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0.16, -0.38, 0.05]} rotation={[0, 0, -0.35]}>
              <capsuleGeometry args={[0.08, 0.6, 4, 12]} />
              <Toon color={skin} map={grad} />
              <Ink thin />
            </mesh>
            <mesh position={[0.28, -0.72, 0.08]}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <Toon color={skin} map={grad} />
              <Ink thin />
            </mesh>
          </group>
          {/* a slipper peeking out under the hem */}
          <group position={[0.26, -1.82, 0.12]}>
            <mesh scale={[0.9, 0.6, 1.3]}>
              <sphereGeometry args={[0.2, 18, 18]} />
              <Toon color={shade(color, -0.28)} map={grad} />
              <Ink thin />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ----------------------------------------------------------------- wings */

function butterflyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 1.05, 1.15, 1.25, 1.2, 0.5);
  s.bezierCurveTo(1.25, 0.0, 0.85, -0.2, 0.55, -0.25);
  s.bezierCurveTo(1.0, -0.45, 1.05, -1.0, 0.6, -1.05);
  s.bezierCurveTo(0.2, -1.1, 0.05, -0.5, 0, 0);
  return s;
}

function dragonflyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.4, 0.5, 1.3, 0.62, 1.45, 0.22);
  s.bezierCurveTo(1.55, -0.05, 0.7, -0.35, 0, 0);
  return s;
}

function leafWingShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.2);
  s.bezierCurveTo(0.25, 0.75, 0.9, 1.3, 1.35, 1.35);
  s.bezierCurveTo(1.3, 0.6, 0.85, -0.1, 0, -0.2);
  return s;
}

function starWingShape() {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [0, -0.2], [0.35, 0.75], [0.6, 0.2], [0.95, 1.15], [1.1, 0.35],
    [1.6, 0.6], [1.35, -0.05], [1.6, -0.3], [0, -0.42],
  ];
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

function Wings({ kind, color, grad }: { kind: string; color: string; grad: THREE.DataTexture }) {
  const right = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const shape = kind === 'dragonfly' ? dragonflyShape() : kind === 'leaf' ? leafWingShape() : kind === 'star' ? starWingShape() : butterflyShape();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    g.scale(0.72, 0.72, 1);
    return g;
  }, [kind]);

  useFrame(({ clock }) => {
    const a = 0.34 + Math.sin(clock.getElapsedTime() * 5) * 0.28;
    if (right.current) right.current.rotation.y = a;
    if (left.current) left.current.rotation.y = a;
  });

  const wing = (
    <>
      <mesh geometry={geo}>
        <Toon color={color} map={grad} />
        <Ink thin />
      </mesh>
      {kind === 'dragonfly' && (
        <mesh geometry={geo} position={[0.02, -0.42, -0.02]} rotation={[0, 0, -0.35]} scale={0.82}>
          <Toon color={shade(color, 0.28)} map={grad} />
          <Ink thin />
        </mesh>
      )}
    </>
  );

  return (
    <group position={[0, 0.55, -0.3]}>
      <group ref={right}>{wing}</group>
      <group scale={[-1, 1, 1]}>
        <group ref={left}>{wing}</group>
      </group>
      <Sparkles count={26} scale={[2.6, 1.8, 1.2]} position={[0, 0.2, 0]} size={3} speed={0.5} color={shade(color, 0.5)} />
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
          {[1, -1].map((s) => (
            <group key={s} scale={[s, 1, 1]}>
              <mesh position={[0.6, HEAD_Y - 0.55, 0.05]}>
                <capsuleGeometry args={[0.17, 0.9, 6, 16]} />
                <Toon color={color} map={grad} />
                <Ink />
              </mesh>
            </group>
          ))}
        </>
      )}

      {kind === 'buns' &&
        [1, -1].map((s) => (
          <group key={s} scale={[s, 1, 1]}>
            <mesh position={[0.46, HEAD_Y + 0.6, -0.05]}>
              <sphereGeometry args={[0.27, 24, 24]} />
              <Toon color={color} map={grad} />
              <Ink />
            </mesh>
          </group>
        ))}

      {kind === 'curly' &&
        curls.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 18, 18]} />
            <Toon color={color} map={grad} />
            <Ink thin />
          </mesh>
        ))}

      {kind === 'braid' && (
        <group position={[0.6, HEAD_Y - 0.2, 0.06]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[i % 2 === 0 ? 0.035 : -0.035, -i * 0.27, 0]}>
              <sphereGeometry args={[0.17, 18, 18]} />
              <Toon color={color} map={grad} />
              <Ink thin />
            </mesh>
          ))}
          <mesh position={[0, -1.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.12, 0.3, 0.12]} />
            <Toon color="#FF6EC7" map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ----------------------------------------------------------------- crown */

function Petals({ color, grad, r = 0.07 }: { color: string; grad: THREE.DataTexture; r?: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((p) => {
        const b = (p / 5) * Math.PI * 2;
        return (
          <mesh key={p} position={[Math.sin(b) * r, 0, Math.cos(b) * r]}>
            <sphereGeometry args={[r * 0.75, 10, 10]} />
            <meshToonMaterial color={color} gradientMap={grad} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[r * 0.6, 10, 10]} />
        <meshToonMaterial color="#FFD93D" gradientMap={grad} />
      </mesh>
    </>
  );
}

function Crown({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const y = HEAD_Y + HEAD_R - 0.05;
  const stars = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.12, 0.055), { depth: 0.04, bevelEnabled: false }), []);
  const spots = [0, 1, 2, 3, 4, 5, 6].map((i) => (i / 7) * Math.PI * 2);

  return (
    <group position={[0, y, 0]} rotation={[0.15, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.05, 8, 40]} />
        <Toon color={kind === 'star' ? '#FFD93D' : '#7ED957'} map={grad} />
      </mesh>

      {kind === 'flower' &&
        spots.map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.5, 0.04, Math.cos(a) * 0.5]}>
            <Petals color={['#FF6EC7', '#ffffff', '#FF6B78', '#A77BFF'][i % 4]} grad={grad} />
          </group>
        ))}

      {kind === 'leaf' &&
        spots.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 0.52, 0.06, Math.cos(a) * 0.52]} rotation={[0.6, a, 0]} scale={[0.5, 0.25, 1]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <Toon color={i % 2 === 0 ? '#7ED957' : '#5FA84F'} map={grad} />
            <Ink thin />
          </mesh>
        ))}

      {kind === 'star' &&
        spots.map((a, i) => (
          <mesh key={i} geometry={stars} position={[Math.sin(a) * 0.5, 0.12, Math.cos(a) * 0.5]} rotation={[0, a, 0]}>
            <meshToonMaterial color={i % 2 === 0 ? '#FFD93D' : '#FFF3C4'} gradientMap={grad} />
          </mesh>
        ))}

      {kind === 'berry' &&
        spots.map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.5, 0.06, Math.cos(a) * 0.5]}>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * 0.07, k === 0 ? 0.07 : 0, 0]}>
                <sphereGeometry args={[0.065, 12, 12]} />
                <meshToonMaterial color={k === 0 ? '#FF6B78' : '#E04E5B'} gradientMap={grad} />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------ wand */

function crescentShape(r = 0.24) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-r * 0.3, 0, r * 0.8, Math.PI / 2, -Math.PI / 2, true);
  return s;
}

function Wand({ kind, grad }: { kind: string; grad: THREE.DataTexture }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.12;
  });
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.24, 0.11), { depth: 0.06, bevelEnabled: false }), []);
  const moon = useMemo(() => new THREE.ExtrudeGeometry(crescentShape(0.26), { depth: 0.06, bevelEnabled: false }), []);
  const stick = kind === 'flower' ? '#7ED957' : kind === 'moon' ? '#A77BFF' : kind === 'bubble' ? '#4FC3FF' : '#FFE066';

  // the right hand sits around (0.7, -0.22, 0.13)
  return (
    <group ref={ref} position={[0.72, -0.2, 0.15]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.9, 10]} />
        <Toon color={stick} map={grad} />
        <Ink thin />
      </mesh>

      {kind === 'star' && (
        <mesh geometry={star} position={[0, 0.88, -0.03]}>
          <Toon color="#FFD93D" map={grad} />
          <Ink thin />
        </mesh>
      )}

      {kind === 'flower' && (
        <group position={[0, 0.9, 0]}>
          <Petals color="#FF6EC7" grad={grad} r={0.17} />
        </group>
      )}

      {kind === 'moon' && (
        <mesh geometry={moon} position={[0, 0.9, -0.03]}>
          <Toon color="#FFD93D" map={grad} />
          <Ink thin />
        </mesh>
      )}

      {kind === 'bubble' && (
        <mesh position={[0, 0.92, 0]}>
          <torusGeometry args={[0.2, 0.035, 10, 32]} />
          <Toon color="#4FC3FF" map={grad} />
          <Ink thin />
        </mesh>
      )}

      <Sparkles count={16} scale={[0.7, 0.7, 0.7]} position={[0, 0.9, 0]} size={3} speed={0.6} color={kind === 'bubble' ? '#BFE9FF' : '#FFD93D'} />
    </group>
  );
}

/* ------------------------------------------------------------------ root */

export default function Fairy3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const grad = useGradientMap();
  const eff = resolveFairyColors(parts, colors);
  const EyesSvg = findOption(FAIRY, 'eyes', parts.eyes)?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  const smileEl = useMemo(() => <Smile colors={eff} />, []); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const smileTex = useSvgTexture(smileEl);

  return (
    <group position={[0, -0.05, 0]}>
      {parts.wings !== '' && <Wings kind={parts.wings} color={eff.wings} grad={grad} />}
      {parts.dress !== '' && <Dress kind={parts.dress} color={eff.dress} skin={eff.skin} grad={grad} />}

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
        <FaceDecal tex={smileTex} y={-0.26} z={HEAD_R} size={0.55} />
      </mesh>

      {/* pointed ears — one side, mirrored */}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh position={[HEAD_R - 0.02, HEAD_Y + 0.06, 0]} rotation={[0, 0, -0.9]}>
            <coneGeometry args={[0.11, 0.38, 10]} />
            <Toon color={eff.skin} map={grad} />
            <Ink thin />
          </mesh>
        </group>
      ))}

      {parts.hair !== '' && <Hair kind={parts.hair} color={eff.hair} grad={grad} />}
      {parts.crown !== '' && <Crown kind={parts.crown} grad={grad} />}
      {parts.wand !== '' && <Wand kind={parts.wand} grad={grad} />}
    </group>
  );
}

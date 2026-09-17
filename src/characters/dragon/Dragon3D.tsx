import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { DRAGON, resolveDragonColors } from './config';
import { findOption } from '../types';
import { INK3D, leafShape, pickPart, useGradientMap, usePatternTexture, useSvgTexture } from '../../lib/three';
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
  /** The dragon body carries a snout, and the mouth (and its fire) lives on it. */
  snout?: { y: number; z: number; r: number };
}

const BODY_KINDS = ['classic', 'chubby', 'tall', 'spiky'];

const SPECS: Record<string, Spec> = {
  // the eyes sit high on the skull so the snout in front of them never hides them
  classic: { headY: 1.0, headR: 0.56, eyeY: 0.22, mouthY: -0.1, wingY: 0.15, halfW: 0.85, tailY: -0.75, snout: { y: 0.74, z: 0.6, r: 0.3 } },
  chubby: { headY: 0.95, headR: 0.72, eyeY: 0.12, mouthY: -0.28, wingY: 0.1, halfW: 0.95, tailY: -0.6 },
  tall: { headY: 0.9, headR: 0.7, eyeY: 0.12, mouthY: -0.26, wingY: 0.2, halfW: 0.7, tailY: -0.7 },
  spiky: { headY: 0.3, headR: 1.05, eyeY: 0.35, mouthY: -0.15, wingY: 0.2, halfW: 1.0, tailY: -0.6 },
};

/** The drawn dragon is spotted with a paler, banded belly. */
const BODY_SKIN: PatternKind = 'spots';
const BELLY_SKIN: PatternKind = 'stripes';

const WING_SKIN: Record<string, PatternKind> = {
  bat: 'smooth',
  feather: 'fur',
  tiny: 'scales',
  butterfly: 'spots',
};

/** Evenly spread directions over a sphere, minus the patch where the face goes. */
const SPIKE_DIRS: THREE.Vector3[] = (() => {
  const n = 22;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996;
    const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (v.z > 0.4 && v.y < 0.45) continue; // keep the face clear
    out.push(v);
  }
  return out;
})();

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

/** Turns +y toward `dir`, for cones and shards placed along a curve. */
function aim(dir: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
}

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

/** One flame lick, for fire that burns along a whole tail. */
function Lick({ grad, at, dir, size, color }: { grad: THREE.DataTexture; at: THREE.Vector3; dir: THREE.Vector3; size: number; color: string }) {
  return (
    <mesh position={[at.x, at.y, at.z]} quaternion={aim(dir)}>
      <coneGeometry args={[size * 0.42, size * 1.7, 10]} />
      <meshToonMaterial color={color} gradientMap={grad} />
    </mesh>
  );
}

/** The dark opening the fire shoots out of (the other three mouths stay decals). */
function OpenMouth({ grad, pos, r }: { grad: THREE.DataTexture; pos: [number, number, number]; r: number }) {
  return (
    <mesh position={pos} scale={[1, 0.7, 0.55]}>
      <sphereGeometry args={[r, 28, 28]} />
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

  // the dragon proper: snout, neck, chest, crest of spikes
  if (kind === 'classic') {
    const s = spec.snout!;
    const crest = shade(color, -0.2);
    return (
      <group>
        <mesh position={[0, -0.5, 0]} scale={[1.02, 0.92, 0.95]}>
          <sphereGeometry args={[0.92, 48, 48]} />
          <Toon color={color} map={grad} tex={skin} />
          <Ink />
        </mesh>
        <mesh position={[0, -0.55, 0.62]} scale={[0.62, 0.8, 0.3]}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <Toon color={belly} map={grad} tex={bellySkin} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 0.34, 0.02]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.44, 0.86, 22]} />
          <Toon color={color} map={grad} tex={skin} />
          <Ink />
        </mesh>
        {/* head + snout, each carrying its half of the face */}
        <mesh position={[0, spec.headY, 0]}>
          <sphereGeometry args={[spec.headR, 48, 48]} />
          <Toon color={color} map={grad} tex={skin} />
          <Ink />
          <FaceDecal tex={eyesTex} y={spec.eyeY} z={spec.headR} size={spec.headR * 1.5} />
        </mesh>
        <mesh position={[0, s.y, s.z]}>
          <sphereGeometry args={[s.r, 32, 32]} />
          <Toon color={shade(color, 0.12)} map={grad} />
          <Ink />
          <FaceDecal tex={mouthTex} y={-0.02} z={s.r} size={s.r * 1.8} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.11, s.y + 0.14, s.z + s.r * 0.82]} scale={[1, 0.65, 0.5]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshToonMaterial color={INK3D} gradientMap={grad} />
          </mesh>
        ))}
        {/* crest running from the crown down the neck */}
        {([
          [1.5, -0.02, 0.4, -0.2],
          [1.32, -0.34, 0.38, -0.7],
          [0.98, -0.52, 0.34, -1.1],
          [0.62, -0.46, 0.3, -1.3],
          [0.26, -0.5, 0.26, -1.45],
        ] as const).map(([y, z, h, tilt], i) => (
          <mesh key={i} position={[0, y, z]} rotation={[tilt, 0, 0]}>
            <coneGeometry args={[h * 0.42, h, 8]} />
            <Toon color={crest} map={grad} />
            <Ink />
          </mesh>
        ))}
        <Feet color={color} grad={grad} y={-1.26} />
      </group>
    );
  }

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

  // spiky: one big ball, bristling on every side
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
      {SPIKE_DIRS.map((d, i) => (
        <mesh
          key={i}
          position={[d.x * (spec.headR - 0.08), spec.headY + d.y * (spec.headR - 0.08), d.z * (spec.headR - 0.08)]}
          quaternion={aim(d)}
        >
          <coneGeometry args={[0.15, 0.5, 8]} />
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

/** Leathery wing: a bone arm with a thumb claw, then finger tips joined by scallops. */
function batShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.lineTo(0.62, 0.72);
  s.lineTo(1.12, 1.06);
  s.lineTo(1.26, 1.32);
  s.lineTo(1.44, 1.22);
  s.lineTo(1.3, 1.0);
  s.lineTo(1.58, 0.76);
  s.quadraticCurveTo(1.1, 0.52, 1.5, 0.28);
  s.quadraticCurveTo(1.0, 0.08, 1.34, -0.2);
  s.quadraticCurveTo(0.86, -0.28, 0.98, -0.62);
  s.lineTo(0.44, -0.46);
  s.lineTo(0, -0.3);
  s.closePath();
  return s;
}

/** The same bone arm, but the trailing edge breaks into long blades. */
function featherShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.lineTo(0.62, 0.72);
  s.lineTo(1.12, 1.06);
  s.lineTo(1.26, 1.32);
  s.lineTo(1.44, 1.22);
  s.lineTo(1.3, 1.0);
  ([
    [1.64, 0.84, 1.28, 0.66],
    [1.52, 0.4, 1.14, 0.28],
    [1.3, 0.0, 0.94, -0.08],
    [1.02, -0.36, 0.68, -0.38],
    [0.7, -0.64, 0.34, -0.5],
  ] as const).forEach(([tx, ty, nx, ny]) => {
    s.lineTo(tx, ty);
    s.lineTo(nx, ny);
  });
  s.lineTo(0, -0.3);
  s.closePath();
  return s;
}

function tinyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.lineTo(0.34, 0.42);
  s.lineTo(0.6, 0.62);
  s.lineTo(0.68, 0.8);
  s.lineTo(0.82, 0.72);
  s.lineTo(0.72, 0.56);
  s.lineTo(0.92, 0.4);
  s.quadraticCurveTo(0.62, 0.24, 0.88, 0.08);
  s.quadraticCurveTo(0.56, -0.06, 0.74, -0.28);
  s.lineTo(0.3, -0.26);
  s.lineTo(0, -0.22);
  s.closePath();
  return s;
}

/** Two leathery lobes, with the waist pinched between them. */
function butterflyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.lineTo(0.6, 0.86);
  s.lineTo(1.16, 1.2);
  s.lineTo(1.3, 1.44);
  s.lineTo(1.48, 1.34);
  s.lineTo(1.34, 1.12);
  s.lineTo(1.58, 0.74);
  s.quadraticCurveTo(1.3, 0.5, 1.3, 0.3);
  s.lineTo(0.9, 0.16);
  s.lineTo(1.26, -0.04);
  s.quadraticCurveTo(1.5, -0.34, 1.22, -0.66);
  s.quadraticCurveTo(0.96, -0.5, 0.88, -0.76);
  s.lineTo(0.42, -0.5);
  s.lineTo(0, -0.28);
  s.closePath();
  return s;
}

const WING_SHAPES: Record<string, THREE.Shape> = {
  bat: batShape(),
  feather: featherShape(),
  tiny: tinyShape(),
  butterfly: butterflyShape(),
};

/** Where the finger bones run, per wing: [wrist, ...tips]. */
const WING_BONES: Record<string, [number, number][]> = {
  bat: [[1.16, 1.0], [1.58, 0.76], [1.5, 0.28], [1.34, -0.2], [0.98, -0.62], [0, -0.28]],
  feather: [[1.16, 1.0], [1.62, 0.84], [1.5, 0.4], [1.28, 0.0], [1.0, -0.36], [0, -0.28]],
  tiny: [[0.66, 0.58], [0.92, 0.4], [0.88, 0.08], [0.74, -0.28], [0, -0.2]],
  butterfly: [[1.2, 1.12], [1.58, 0.74], [1.28, 0.28], [0, -0.26]],
};

function Bone({ from, to, color, grad }: { from: [number, number]; to: [number, number]; color: string; grad: THREE.DataTexture }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0.07]} rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}>
      <cylinderGeometry args={[0.035, 0.035, len, 8]} />
      <Toon color={color} map={grad} />
    </mesh>
  );
}

function Wings({ kind, color, grad, y, halfW }: { kind: string | null; color: string; grad: THREE.DataTexture; y: number; halfW: number }) {
  const shape = WING_SHAPES[kind ?? ''] ?? WING_SHAPES.bat;
  const bones = WING_BONES[kind ?? ''] ?? WING_BONES.bat;
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
  const boneColor = shade(color, -0.3);
  const wing = (
    <group>
      <mesh geometry={geo}>
        <meshToonMaterial color={tex ? '#ffffff' : color} gradientMap={grad} map={tex ?? null} side={THREE.DoubleSide} />
        <Ink />
      </mesh>
      {bones.slice(1).map((tip, i) => (
        <Bone key={i} from={bones[0]} to={tip} color={boneColor} grad={grad} />
      ))}
    </group>
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

/* ------------------------------------------------------------------ tail */

/** Each tail is themed from root to tip, so the whole length tells the story. */
const TAIL_KINDS = ['fire', 'lightning', 'ice', 'leaf'];

function Tail({ kind: raw, grad, y }: { kind: string | null; grad: THREE.DataTexture; y: number }) {
  // an id from before the tails were redesigned still gets a tail, not a stump
  const kind = raw === null ? null : TAIL_KINDS.includes(raw) ? raw : 'fire';
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
  /** Stations along the tail: point, outward normal and how far along we are. */
  const stations = useMemo(
    () =>
      [0.1, 0.28, 0.46, 0.64, 0.82, 1].map((t) => {
        const p = curve.getPoint(t);
        const tan = curve.getTangent(t).normalize();
        const out = new THREE.Vector3().crossVectors(tan, UP).normalize().multiplyScalar(0.35).add(UP).normalize();
        return { t, p, tan, out };
      }),
    [curve],
  );
  /** A zig-zag polyline for the lightning bolt. */
  const bolt = useMemo(() => {
    const n = 8;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
      const k = (i % 2 ? 0.24 : -0.24) * (1 - t * 0.35);
      pts.push(p.clone().addScaledVector(side, k).addScaledVector(UP, k * 0.7));
    }
    return pts;
  }, [curve]);
  const leaf = useMemo(() => new THREE.ExtrudeGeometry(leafShape(0.5), { depth: 0.07, bevelEnabled: false }), []);
  const vineSkin = usePatternTexture({ base: '#5FA83F', pattern: 'stripes', scale: 1.4 });
  const iceSkin = usePatternTexture({ base: '#7FE3FF', pattern: 'scales', scale: 1.6 });
  const tip = stations[stations.length - 1];
  const tipQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(FWD, curve.getTangent(1).normalize()), [curve]);
  if (!kind) return null;

  return (
    <group ref={ref} position={[0, y, -0.4]}>
      {/* fire: an orange tail that burns all the way, with a blast at the tip */}
      {kind === 'fire' && (
        <group>
          <mesh>
            <tubeGeometry args={[curve, 32, 0.15, 12, false]} />
            <meshToonMaterial color="#FF7A1A" gradientMap={grad} />
            <Ink />
          </mesh>
          {stations.slice(0, 5).map((s, i) => (
            <group key={i}>
              <Lick grad={grad} at={s.p} dir={s.out} size={0.24 + s.t * 0.3} color="#FF7A1A" />
              <Lick grad={grad} at={s.p} dir={s.out} size={0.15 + s.t * 0.2} color="#FFC400" />
            </group>
          ))}
          <group position={[tip.p.x, tip.p.y, tip.p.z]} quaternion={tipQuat}>
            <Flame grad={grad} len={0.6} />
          </group>
        </group>
      )}

      {/* lightning: a jagged bolt, segment by segment from root to tip */}
      {kind === 'lightning' &&
        bolt.slice(0, -1).map((a, i) => {
          const b = bolt[i + 1];
          const dir = b.clone().sub(a);
          const len = dir.length();
          const k = 1 - i / bolt.length;
          return (
            <mesh key={i} position={[(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]} quaternion={aim(dir)}>
              <cylinderGeometry args={[0.18 * k, 0.2 * k, len * 1.25, 6]} />
              <Toon color="#FFD93D" map={grad} />
              <Ink />
            </mesh>
          );
        })}

      {/* ice: a crystal core with shards growing out of it the whole way */}
      {kind === 'ice' && (
        <group>
          <mesh>
            <tubeGeometry args={[curve, 32, 0.12, 8, false]} />
            <Toon color="#A7EEFF" map={grad} tex={iceSkin} />
            <Ink />
          </mesh>
          {stations.map((s, i) => (
            <mesh key={i} position={[s.p.x, s.p.y, s.p.z]} quaternion={aim(i % 2 ? s.out : s.out.clone().negate())}>
              <coneGeometry args={[0.16 + s.t * 0.06, 0.38 + s.t * 0.5, 4]} />
              <Toon color={i % 2 ? '#7FE3FF' : '#CFF6FF'} map={grad} />
              <Ink />
            </mesh>
          ))}
        </group>
      )}

      {/* leaf: a vine with leaves sprouting the whole way, biggest at the tip */}
      {kind === 'leaf' && (
        <group>
          <mesh>
            <tubeGeometry args={[curve, 32, 0.13, 10, false]} />
            <Toon color="#5FA83F" map={grad} tex={vineSkin} />
            <Ink />
          </mesh>
          {stations.map((s, i) => (
            <mesh
              key={i}
              geometry={leaf}
              position={[s.p.x, s.p.y + 0.12, s.p.z]}
              rotation={[0.25, i % 2 ? -0.9 : 0.9, i % 2 ? -0.7 : 0.7]}
              scale={0.4 + s.t * 0.7}
            >
              <Toon color={i % 2 ? '#7ED957' : '#9CE86F'} map={grad} />
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
  const raw = pickPart(parts.body, 'classic');
  const body = raw === null ? null : BODY_KINDS.includes(raw) ? raw : 'classic';
  const mouth = pickPart(parts.mouth, 'smile');
  const spec = SPECS[body ?? ''] ?? SPECS.classic;
  const fire = mouth === 'fire';
  const EyesSvg = findOption(DRAGON, 'eyes', pickPart(parts.eyes, 'cute') ?? '')?.Svg;
  const MouthSvg = fire ? undefined : findOption(DRAGON, 'mouth', mouth ?? '')?.Svg;
  const eyesEl = useMemo(() => (EyesSvg ? <EyesSvg colors={eff} /> : null), [EyesSvg, eff.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const mouthEl = useMemo(() => (MouthSvg ? <MouthSvg colors={eff} /> : null), [MouthSvg]); // eslint-disable-line react-hooks/exhaustive-deps
  const eyesTex = useSvgTexture(eyesEl);
  const mouthTex = useSvgTexture(mouthEl);
  /** Where the jaw opens: the snout tip if this body has one, else the front of the head. */
  const frontZ = Math.sqrt(Math.max(spec.headR * spec.headR - spec.mouthY * spec.mouthY, 0.04));
  const jaw: [number, number, number] = spec.snout
    ? [0, spec.snout.y - 0.02, spec.snout.z + spec.snout.r * 0.55]
    : [0, spec.headY + spec.mouthY, frontZ * 0.88];
  const jet: [number, number, number] = spec.snout
    ? [0, spec.snout.y - 0.02, spec.snout.z + spec.snout.r * 0.9]
    : [0, spec.headY + spec.mouthY, frontZ * 0.95];

  return (
    <group position={[0, -0.1, 0]}>
      <Tail kind={pickPart(parts.tail, 'fire')} grad={grad} y={spec.tailY} />
      <Wings kind={pickPart(parts.wings, 'bat')} color={eff.wings} grad={grad} y={spec.wingY} halfW={spec.halfW} />
      <Body kind={body} color={eff.body} grad={grad} eyesTex={eyesTex} mouthTex={mouthTex} spec={spec} />
      {fire && body && (
        <group>
          <OpenMouth grad={grad} pos={jaw} r={spec.snout ? spec.snout.r * 0.8 : 0.27} />
          <group position={jet}>
            <Flame grad={grad} len={0.9} />
          </group>
        </group>
      )}
    </group>
  );
}

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import FaceDecal from '../../components/FaceDecal';
import Ink from '../../components/Ink';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { DRAGON, resolveDragonColors } from './config';
import { findOption } from '../types';
import { INK3D, leafShape, pickPart, useGradientMap, usePatternTexture, useSvgTexture, latheBody } from '../../lib/three';
import type { PatternKind } from '../../lib/three';
import { shade } from '../../lib/color';
import Part3D from '../../components/Part3D';

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
  const n = 54;
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
 * The outline a child draws for fire: a tall middle point with smaller licks breaking
 * away either side, and notches between them. It points up (+y) and is one unit wide.
 */
function flameShape() {
  const f = new THREE.Shape();
  // sharp points with round valleys between them, tall and narrow, the way fire is drawn
  f.moveTo(0.24, 0);
  f.quadraticCurveTo(0.34, 0.14, 0.38, 0.34); // right lick
  f.quadraticCurveTo(0.2, 0.42, 0.16, 0.5);
  f.quadraticCurveTo(0.3, 0.62, 0.34, 0.86); // second lick
  f.quadraticCurveTo(0.18, 0.92, 0.12, 1.02);
  f.quadraticCurveTo(0.18, 1.2, 0.14, 1.36);
  f.lineTo(0.0, 1.82); // the tip
  f.lineTo(-0.14, 1.3);
  f.quadraticCurveTo(-0.2, 1.14, -0.12, 0.98);
  f.quadraticCurveTo(-0.34, 0.9, -0.36, 0.64); // left lick
  f.quadraticCurveTo(-0.2, 0.56, -0.16, 0.46);
  f.quadraticCurveTo(-0.34, 0.32, -0.26, 0.1);
  f.quadraticCurveTo(-0.16, 0.02, 0.24, 0);
  f.closePath();
  return f;
}

/** The flame silhouette, flat, ready to be crossed into a 3D-looking fire. */
const FLAME_GEO = new THREE.ExtrudeGeometry(flameShape(), { depth: 0.07, bevelEnabled: false });

/**
 * One layer of fire: the same silhouette on three cards crossed about the jet, so the
 * flame keeps a flame's outline from whatever side the model is turned to. Each layer
 * breathes at its own pace, and the inner ones are shorter and hotter, which is how the
 * drawing shades it: orange outside, yellow inside, white at the heart.
 */
function FlameLayer({
  grad,
  color,
  len,
  phase,
  ink,
}: {
  grad: THREE.DataTexture;
  color: string;
  len: number;
  phase: number;
  ink?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime() * 7 + phase;
    g.scale.set(len * (1 + Math.sin(t * 1.6) * 0.09), len * (1 + Math.sin(t) * 0.2), len);
    g.rotation.z = Math.sin(t * 0.7) * 0.1;
  });
  return (
    <group ref={ref} scale={len}>
      {[0, 60, 120].map((deg) => (
        <group key={deg} rotation={[0, (deg * Math.PI) / 180, 0]}>
          <mesh geometry={FLAME_GEO} position={[0, 0, -0.035]}>
            <meshToonMaterial color={color} gradientMap={grad} side={THREE.DoubleSide} />
            {ink && <Ink thin />}
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Fire: three crossed layers, hottest in the middle, leaning out of the mouth.
 * A single cone only ever looked like a traffic cone, and smooth teardrops looked like
 * balloons; this keeps the drawn outline from every angle.
 */
function Flame({ grad, len = 1 }: { grad: THREE.DataTexture; len?: number }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <FlameLayer grad={grad} color="#FF6A00" len={0.62 * len} phase={0} ink />
      <FlameLayer grad={grad} color="#FFB01F" len={0.42 * len} phase={2.1} />
      <FlameLayer grad={grad} color="#FFF0B8" len={0.24 * len} phase={4.2} />
      {/* little licks breaking away past the tip, which is what says "fire" at a glance */}
      {([
        [0.3, 0.72, 0.17, '#FF8A1F'],
        [-0.32, 0.9, 0.13, '#FFB01F'],
        [0.12, 1.16, 0.11, '#FF6A00'],
      ] as const).map(([x, y, k, c], i) => (
        <group key={i} position={[x * len, y * len, 0]}>
          <FlameLayer grad={grad} color={c} len={k * len} phase={1.1 + i * 1.7} ink />
        </group>
      ))}
    </group>
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

/**
 * The row of spikes down a dragon's head and back.
 *
 * They used to be placed by hand at fixed heights and all but the top one ended up
 * buried inside the head or the belly, so the dragon looked like it had a single fin.
 * Each spike now sits on the surface it grows from and points straight out of it.
 */
function Crest({ spec, color, grad }: { spec: Spec; color: string; grad: THREE.DataTexture }) {
  const spikes = useMemo(() => {
    const out: { pos: [number, number, number]; dir: THREE.Vector3; h: number }[] = [];
    // over the head: from the crown backwards
    for (const [a, h] of [
      [0.1, 0.34],
      [0.55, 0.38],
      [1.0, 0.34],
      [1.45, 0.28],
    ] as const) {
      const dir = new THREE.Vector3(0, Math.cos(a), -Math.sin(a));
      out.push({
        pos: [0, spec.headY + dir.y * spec.headR * 0.94, dir.z * spec.headR * 0.94],
        dir,
        h,
      });
    }
    // down the neck and along the back, on the far side of the body
    const bodyY = -0.5;
    const bodyR = 0.92;
    for (const [a, h] of [
      [0.62, 0.3],
      [0.95, 0.32],
      [1.3, 0.28],
      [1.7, 0.22],
    ] as const) {
      const dir = new THREE.Vector3(0, Math.cos(a), -Math.sin(a));
      out.push({
        pos: [0, bodyY + dir.y * bodyR * 0.96, dir.z * bodyR * 0.96],
        dir,
        h,
      });
    }
    return out;
  }, [spec.headY, spec.headR]);

  return (
    <group>
      {spikes.map((sp, i) => (
        <mesh key={i} position={sp.pos} quaternion={aim(sp.dir)}>
          <coneGeometry args={[sp.h * 0.45, sp.h, 8]} />
          <Toon color={color} map={grad} />
          <Ink />
        </mesh>
      ))}
    </group>
  );
}


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
  // a standing egg: narrow at the top, heavy at the bottom, no seams
  const egg = useMemo(
    () =>
      latheBody([
        [0, -1.0],
        [0.5, -0.9],
        [0.78, -0.55],
        [0.85, -0.05],
        [0.78, 0.5],
        [0.58, 0.95],
        [0.3, 1.25],
        [0, 1.35],
      ]),
    [],
  );
  const belly = shade(color, 0.45);
  const skin = usePatternTexture({ base: color, pattern: BODY_SKIN, scale: 2.8 });
  const bellySkin = usePatternTexture({ base: belly, pattern: BELLY_SKIN, scale: 1.6 });
  if (!kind) return null;
  const face = (
    <>
      <FaceDecal order={2} part="eyes" tex={eyesTex} y={spec.eyeY} z={spec.headR} size={spec.headR * 1.15} />
      <FaceDecal order={3} part="mouth" tex={mouthTex} y={spec.mouthY} z={spec.headR} size={spec.headR * 0.9} />
    </>
  );

  // the dragon proper: snout, neck, chest, crest of spikes
  if (kind === 'classic') {
    const s = spec.snout!;
    const crest = shade(color, -0.2);
    return (
      <group key="classic">
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
          <FaceDecal order={2} part="eyes" tex={eyesTex} y={spec.eyeY} z={spec.headR} size={spec.headR * 1.5} />
        </mesh>
        <mesh position={[0, s.y, s.z]}>
          <sphereGeometry args={[s.r, 32, 32]} />
          <Toon color={shade(color, 0.12)} map={grad} />
          <Ink />
          <FaceDecal order={3} part="mouth" tex={mouthTex} y={-0.02} z={s.r} size={s.r * 1.8} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.11, s.y + 0.14, s.z + s.r * 0.82]} scale={[1, 0.65, 0.5]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshToonMaterial color={INK3D} gradientMap={grad} />
          </mesh>
        ))}
        {/* the row of spikes, riding the outside of the head, neck and back */}
        <Crest spec={spec} color={crest} grad={grad} />
        <Feet color={color} grad={grad} y={-1.26} />
      </group>
    );
  }

  if (kind === 'chubby' || kind === 'tall') {
    const tall = kind === 'tall';
    return (
      <group key={kind}>
        {/* torso: the tall one is a standing egg, the chubby one a wide ball */}
        {tall ? (
          <mesh geometry={egg} position={[0, -0.62, 0]} scale={[0.95, 0.72, 0.95]}>
            <Toon color={color} map={grad} tex={skin} />
            <Ink />
          </mesh>
        ) : (
          <mesh position={[0, -0.35, 0]} scale={[1.15, 0.95, 1.0]}>
            <sphereGeometry args={[0.95, 48, 48]} />
            <Toon color={color} map={grad} tex={skin} />
            <Ink />
          </mesh>
        )}
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
    <group key="spiky">
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
          <coneGeometry args={[0.12, 0.38 + ((i * 7) % 5) * 0.08, 8]} />
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

/**
 * A length of tail. A bare tube is open at both ends, which is why the leaf tail
 * looked snipped off, so each end is closed with a ball.
 */
function CappedTube({
  curve,
  r,
  tip = 1,
  children,
}: {
  curve: THREE.CatmullRomCurve3;
  r: number;
  tip?: number;
  children: React.ReactNode;
}) {
  const a = curve.getPoint(0);
  const b = curve.getPoint(1);
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 40, r, 14, false]} />
        {children}
      </mesh>
      <mesh position={[a.x, a.y, a.z]}>
        <sphereGeometry args={[r, 18, 18]} />
        {children}
      </mesh>
      <mesh position={[b.x, b.y, b.z]}>
        <sphereGeometry args={[r * tip, 18, 18]} />
        {children}
      </mesh>
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
      // the tail sweeps out to the side rather than straight backwards, so the child
      // can see what it is from the front, where the picture is taken
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.45, -0.25, -0.4),
        new THREE.Vector3(1.05, -0.12, -0.62),
        new THREE.Vector3(1.62, 0.5, -0.7),
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
      {/* fire: the tail itself burns, tongue after tongue, up to a blast at the tip */}
      {kind === 'fire' && (
        <group>
          <CappedTube curve={curve} r={0.15} tip={0.7}>
            <meshToonMaterial color="#E8541B" gradientMap={grad} />
          </CappedTube>
          {stations.slice(0, 5).map((s, i) => (
            <group key={i} position={[s.p.x, s.p.y, s.p.z]} quaternion={aim(s.out)}>
              <group rotation={[Math.PI / 2, 0, 0]}>
                <FlameLayer grad={grad} color="#FF6A00" len={0.24 + s.t * 0.22} phase={i * 1.3} ink />
                <FlameLayer grad={grad} color="#FFB01F" len={0.14 + s.t * 0.14} phase={i * 1.3 + 2} />
              </group>
            </group>
          ))}
          <group position={[tip.p.x, tip.p.y, tip.p.z]} quaternion={tipQuat}>
            <Flame grad={grad} len={0.5} />
          </group>
        </group>
      )}

      {/* lightning: a flat, angular bolt rather than a string of fat sausages */}
      {kind === 'lightning' &&
        bolt.slice(0, -1).map((a, i) => {
          const b = bolt[i + 1];
          const dir = b.clone().sub(a);
          const len = dir.length();
          const k = 1 - i / bolt.length;
          return (
            <mesh key={i} position={[(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]} quaternion={aim(dir)}>
              <boxGeometry args={[0.26 * k, len * 1.3, 0.09]} />
              <Toon color="#FFD93D" map={grad} />
              <Ink />
            </mesh>
          );
        })}

      {/* ice: a crystal tail, shards growing along it and a long point at the end */}
      {kind === 'ice' && (
        <group>
          <CappedTube curve={curve} r={0.12} tip={0.6}>
            <meshToonMaterial color="#BDEFFF" gradientMap={grad} map={iceSkin} />
          </CappedTube>
          {stations.map((s, i) => (
            <mesh
              key={i}
              position={[s.p.x, s.p.y, s.p.z]}
              quaternion={aim(i % 2 ? s.out : s.out.clone().negate())}
              scale={[0.13 + s.t * 0.05, 0.3 + s.t * 0.42, 0.13 + s.t * 0.05]}
            >
              <octahedronGeometry args={[1, 0]} />
              <Toon color={i % 2 ? '#8FE7FF' : '#DCF8FF'} map={grad} />
              <Ink thin />
            </mesh>
          ))}
          <mesh position={[tip.p.x, tip.p.y, tip.p.z]} quaternion={tipQuat} scale={[0.17, 0.17, 0.62]}>
            <octahedronGeometry args={[1, 0]} />
            <Toon color="#8FE7FF" map={grad} />
            <Ink thin />
          </mesh>
        </group>
      )}

      {/* leaf: a vine with leaves sprouting the whole way, biggest at the tip */}
      {kind === 'leaf' && (
        <group>
          <CappedTube curve={curve} r={0.13} tip={0.75}>
            <meshToonMaterial color="#5FA83F" gradientMap={grad} map={vineSkin} />
          </CappedTube>
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
          <mesh geometry={leaf} position={[tip.p.x, tip.p.y + 0.1, tip.p.z]} rotation={[0.2, 0.3, -0.2]} scale={1.15}>
            <Toon color="#7ED957" map={grad} />
            <Ink thin />
          </mesh>
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
      <Part3D id="tail"><Tail kind={pickPart(parts.tail, 'fire')} grad={grad} y={spec.tailY} /></Part3D>
      <Part3D id="wings"><Wings kind={pickPart(parts.wings, 'bat')} color={eff.wings} grad={grad} y={spec.wingY} halfW={spec.halfW} /></Part3D>
      <Part3D id="body"><Body kind={body} color={eff.body} grad={grad} eyesTex={eyesTex} mouthTex={mouthTex} spec={spec} /></Part3D>
      {fire && body && (
        <Part3D id="mouth">
          <OpenMouth grad={grad} pos={jaw} r={spec.snout ? spec.snout.r * 0.8 : 0.27} />
          {/* the jet climbs and leans aside, the way the card draws it: fire aimed at the
              viewer is only an orange blob, and fire straight up hides his own face */}
          <group position={jet} rotation={[-0.62, 0.62, 0]}>
            <Flame grad={grad} len={1.2} />
          </group>
        </Part3D>
      )}
    </group>
  );
}

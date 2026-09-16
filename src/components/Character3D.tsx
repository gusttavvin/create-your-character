import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import type { CharacterKind, ColorMap, PartMap } from '../characters/types';
import Monster3D from '../characters/monster/Monster3D';
import Dragon3D from '../characters/dragon/Dragon3D';
import Princess3D from '../characters/princess/Princess3D';

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
}

/** Dev helper: exposes the R3F state getter on window for console inspection. */
function DevExpose() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __r3f?: unknown }).__r3f = get;
  }, [get]);
  return null;
}

function Idle({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = Math.sin(t * 2) * 0.06;
    ref.current.rotation.z = Math.sin(t * 1.3) * 0.02;
  });
  return <group ref={ref}>{children}</group>;
}

export default function Character3D({ kind, parts, colors }: Props) {
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.4, 6.2], fov: 38 }}
      style={{ background: 'transparent' }}
    >
      <DevExpose />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Suspense fallback={null}>
        <Idle>
          {kind === 'dragon' ? (
            <Dragon3D parts={parts} colors={colors} />
          ) : kind === 'princess' ? (
            <Princess3D parts={parts} colors={colors} />
          ) : (
            <Monster3D parts={parts} />
          )}
        </Idle>
        <ContactShadows position={[0, -1.85, 0]} opacity={0.35} scale={6} blur={2.2} far={3} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={9}
        minPolarAngle={0.6}
        maxPolarAngle={1.75}
        autoRotate
        autoRotateSpeed={1.2}
        target={[0, 0, 0]}
        makeDefault
      />
    </Canvas>
  );
}

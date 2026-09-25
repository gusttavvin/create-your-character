import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Box3, Vector3, type Group, type PerspectiveCamera } from 'three';
import type { CharacterKind, ColorMap, LayoutMap, PartMap } from '../characters/types';
import { Layout3DContext } from './layout3d';
import Monster3D from '../characters/monster/Monster3D';
import Dragon3D from '../characters/dragon/Dragon3D';
import Princess3D from '../characters/princess/Princess3D';
import Superhero3D from '../characters/superhero/Superhero3D';
import Fairy3D from '../characters/fairy/Fairy3D';

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
  layout?: LayoutMap;
  /** Lets the child drag the pieces of the model around. */
  editable?: boolean;
  selected?: string | null;
  onSelect?: (categoryId: string | null) => void;
  onMove?: (categoryId: string, dx: number, dy: number, dz: number) => void;
}

/** Dev helper: exposes the R3F state getter on window for console inspection. */
function DevExpose() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __r3f?: unknown }).__r3f = get;
  }, [get]);
  return null;
}

/**
 * Keeps the whole character inside the picture.
 *
 * Characters are built at whatever size their shapes need, so wide ones lost their arms
 * off the side of the canvas and the fairy's wings were sliced in half. This measures the
 * model whenever its pieces change and scales it to fit the frame with a margin, so
 * nothing is cut off and every character fills the sheet about the same amount.
 */
function Fit({ sig, floor, children }: { sig: string; floor?: React.RefObject<Group | null>; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    let stop = false;
    const fit = () => {
      const group = ref.current;
      if (stop || !group) return;
      group.scale.setScalar(1);
      group.position.set(0, 0, 0);
      group.updateWorldMatrix(true, true);
      const box = new Box3().setFromObject(group);
      if (box.isEmpty()) return;
      const span = box.getSize(new Vector3());
      const mid = box.getCenter(new Vector3());
      const dist = camera.position.length();
      const halfH = Math.tan(((camera.fov ?? 38) * Math.PI) / 360) * dist * 0.86;
      const halfW = halfH * (size.width / Math.max(1, size.height));
      const s = Math.min((halfW * 2) / Math.max(0.001, span.x), (halfH * 2) / Math.max(0.001, span.y), 1.2);
      group.scale.setScalar(s);
      group.position.set(-mid.x * s, -mid.y * s, 0);
      // the shadow belongs under whatever the character now stands on
      if (floor?.current) floor.current.position.y = (-span.y * s) / 2 - 0.02;
    };
    fit();
    // geometry can still be arriving on the first frame, so measure again once it settles
    const again = requestAnimationFrame(() => requestAnimationFrame(fit));
    const later = setTimeout(fit, 400);
    return () => {
      stop = true;
      cancelAnimationFrame(again);
      clearTimeout(later);
    };
  }, [sig, floor, camera, size.width, size.height]);

  return <group ref={ref}>{children}</group>;
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

export default function Character3D({ kind, parts, colors, layout, editable, selected, onSelect, onMove }: Props) {
  const floor = useRef<Group>(null);
  // the model is re-measured when the pieces change, not while one is being dragged
  const sig = useMemo(() => kind + '|' + Object.entries(parts).sort().join(','), [kind, parts]);
  const ctx = useMemo(
    () => ({ layout: layout ?? {}, selected: selected ?? null, editable: !!editable, onSelect, onMove }),
    [layout, selected, editable, onSelect, onMove],
  );

  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.4, 6.2], fov: 38 }}
      style={{ background: 'transparent' }}
      onPointerMissed={editable ? () => onSelect?.(null) : undefined}
    >
      <DevExpose />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Suspense fallback={null}>
        <Layout3DContext.Provider value={ctx}>
          <Fit sig={sig} floor={floor}>
            <Idle>
            {kind === 'dragon' ? (
              <Dragon3D parts={parts} colors={colors} />
            ) : kind === 'princess' ? (
              <Princess3D parts={parts} colors={colors} />
            ) : kind === 'superhero' ? (
              <Superhero3D parts={parts} colors={colors} />
            ) : kind === 'fairy' ? (
              <Fairy3D parts={parts} colors={colors} />
            ) : (
              <Monster3D parts={parts} />
            )}
            </Idle>
          </Fit>
        </Layout3DContext.Provider>
        <group ref={floor} position={[0, -1.85, 0]}>
          <ContactShadows opacity={0.35} scale={6} blur={2.2} far={3} />
        </group>
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={9}
        minPolarAngle={0.6}
        maxPolarAngle={1.75}
        /* while a piece is picked the model holds still, so it is easy to place */
        autoRotate={!(editable && selected)}
        autoRotateSpeed={1.2}
        target={[0, 0, 0]}
        makeDefault
      />
    </Canvas>
  );
}

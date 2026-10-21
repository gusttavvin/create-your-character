import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import rawLibrary from './model-library.json';
import { pickOption, type ColorMap, type PartMap } from '../types';
import { PRINCESS, princessColors } from './config';
import { CANVAS, type SkinTone } from './pieces';
import { Ability3D } from './abilities3d';

/**
 * The princess in 3D: a doll assembled from modelled pieces, the way the dragon is.
 *
 * Every piece is a real solid modelled from Clara's doll pictures (art-source/princess/doll/):
 * one skull with its ears, nose and blush; each pair of eyes a pair of balls with iris, pupil,
 * shines, lids, lashes and brows; each mouth real lips; each dress a bodice with puff sleeves,
 * arms and hands and its own skirt (or tail, or legs and shoes); each head of hair a cap and
 * its strands, braid, curls or bun, with its tiara and earrings. The pieces are laid out on the
 * flat princess's sheet, so they line up with nothing more.
 *
 * What is done here: every piece gets its own copy of its materials, the skin is tinted to the
 * tone the child chose, the eyes blink and the ability goes round her. Like the monster and the
 * dragon she is the finished princess the class built on the sheet: nothing is dragged.
 */
const LIB = rawLibrary as unknown as { unit: number; pieces: Record<string, { url: string; group: string }> };
export const U = LIB.unit;
const urlOf = (key: string) => `${import.meta.env.BASE_URL}${LIB.pieces[key].url}`;

const SKIN: Record<SkinTone, string> = { light: '#fdc59b', tan: '#e4a074', brown: '#b2724a', dark: '#72462c' };

/** A copy of a loaded piece this princess can change: its own materials, in her skin. */
function own(scene: THREE.Group, skin: string) {
  const root = scene.clone(true);
  const made = new Map<THREE.Material, THREE.Material>();
  const copy = (m: THREE.Material) => {
    if (!made.has(m)) {
      const c = m.clone() as THREE.MeshStandardMaterial;
      if (c.name === 'Skin') c.color.set(skin);
      made.set(m, c);
    }
    return made.get(m)!;
  };
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  return { root, materials: [...made.values()] };
}
function useDispose(made: { materials: THREE.Material[] }) {
  useEffect(() => () => made.materials.forEach((m) => m.dispose()), [made]);
}

/* ------------------------------------------------------------------ the pieces */

function Plain({ url, skin }: { url: string; skin: string }) {
  const { scene } = useGLTF(url);
  const made = useMemo(() => own(scene, skin), [scene, skin]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

/** Her eyes; they blink, the balls and lids closing towards their middle (the brows stay). */
function Eyes({ id, skin }: { id: string; skin: string }) {
  const { scene } = useGLTF(urlOf(`eyes:${id}`));
  const made = useMemo(() => {
    const made = own(scene, skin);
    const lids = made.root.getObjectByName('Eyes') as THREE.Group | undefined;
    const middle = lids ? new THREE.Box3().setFromObject(lids).getCenter(new THREE.Vector3()).y : 0;
    return { ...made, lids, middle };
  }, [scene, skin]);
  useDispose(made);
  useFrame(({ clock }) => {
    if (!made.lids) return;
    // as on the sheet: open, and every 4.5 seconds a quick blink
    const p = (clock.getElapsedTime() % 4.5) / 4.5;
    const open = p < 0.92 ? 1 : p < 0.95 ? 1 - ((p - 0.92) / 0.03) * 0.88 : 1 - ((1 - p) / 0.05) * 0.88;
    made.lids.scale.y = open;
    made.lids.position.y = made.middle * (1 - open);
  });
  return <primitive object={made.root} dispose={null} />;
}

/** If a piece's file cannot load, that piece is left out and the rest still shows. */
class IfLoads extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Piece({ children, id }: { children: ReactNode; id: string }) {
  return (
    <IfLoads key={id}>
      <Suspense fallback={null}>{children}</Suspense>
    </IfLoads>
  );
}

export default function Princess3D({ parts, colors }: { parts: PartMap; colors: ColorMap; still?: boolean }) {
  const tone = princessColors(parts, colors).tone as SkinTone;
  const skin = SKIN[tone];
  const id = (row: string) => pickOption(PRINCESS, row, parts[row])?.id ?? null;
  const rows = ['dress', 'hair', 'mouth'] as const;
  const eyes = id('eyes');
  const power = id('accessory');

  return (
    <group name="princess-model">
      {/* her whole sheet, unseen: she takes the same room in the frame whatever she wears,
          and whatever her ability does round her */}
      <mesh visible={false}>
        <boxGeometry args={[CANVAS.w * U, CANVAS.h * U, 0.01]} />
        <meshBasicMaterial />
      </mesh>
      <Piece id="head">
        <Plain url={urlOf('head')} skin={skin} />
      </Piece>
      {rows.map((row) => {
        const chosen = id(row);
        return (
          chosen &&
          LIB.pieces[`${row}:${chosen}`] && (
            <Piece key={row} id={`${row}-${chosen}`}>
              <Plain url={urlOf(`${row}:${chosen}`)} skin={skin} />
            </Piece>
          )
        );
      })}
      {eyes && LIB.pieces[`eyes:${eyes}`] && (
        <Piece id={`eyes-${eyes}`}>
          <Eyes id={eyes} skin={skin} />
        </Piece>
      )}
      <Ability3D id={power} />
    </group>
  );
}

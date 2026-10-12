import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { pickOption, type ColorMap, type PartMap } from '../types';
import { PRINCESS, princessColors } from './config';
import { CANVAS, type SkinTone } from './pieces';
import { U } from './relief';
import { buildPrincess, type Built } from './build3d';
import { Ability3D } from './abilities3d';

/**
 * The princess in 3D: the flat princess, given body.
 *
 * She is made from the very pictures the sheet stacks (build3d.ts, relief.ts), so from the
 * front she is the princess the child built on the sheet, and turned round she is round: a
 * round head, round arms, a gown like a bell, hair falling round her and down her back. Her
 * eyes blink as on the sheet, and her ability goes round her.
 *
 * Like the monster and the dragon, the 3D princess is the finished princess the class built on
 * the sheet: her pieces are not dragged about here (see movable3d).
 */
export default function Princess3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const tone = princessColors(parts, colors).tone as SkinTone;
  const id = (row: string) => pickOption(PRINCESS, row, parts[row])?.id ?? null;
  const dress = id('dress');
  const hair = id('hair');
  const eyes = id('eyes');
  const mouth = id('mouth');
  const power = id('accessory');

  const choice = useMemo(() => ({ tone, dress, hair, eyes, mouth }), [tone, dress, hair, eyes, mouth]);
  const [built, setBuilt] = useState<Built | null>(null);

  useEffect(() => {
    let live = true;
    buildPrincess(choice)
      .then((b) => {
        if (live) setBuilt(b);
        else b.dispose();
      })
      .catch((err) => console.error('princess 3D', err));
    return () => {
      live = false;
    };
  }, [choice]);

  // a princess that is replaced, or taken off the page, gives back what she used
  useEffect(() => {
    if (!built) return;
    return () => built.dispose();
  }, [built]);

  const lids = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!lids.current) return;
    // as on the sheet: open, and every 4.5 seconds a quick blink
    const p = (clock.getElapsedTime() % 4.5) / 4.5;
    const k = p < 0.92 ? 1 : p < 0.95 ? 1 - (0.88 * (p - 0.92)) / 0.03 : 0.12 + (0.88 * (p - 0.95)) / 0.05;
    lids.current.scale.y = k;
  });

  return (
    <group>
      {/* her whole picture, unseen: she takes the same room in the frame whatever she wears,
          and whatever her ability does round her */}
      <mesh visible={false}>
        <boxGeometry args={[CANVAS.w * U, CANVAS.h * U, 0.01]} />
        <meshBasicMaterial />
      </mesh>
      {built?.sheets.map((s, k) => (
        <mesh key={k} geometry={s.geometry} material={s.material} />
      ))}
      {built?.eyes && (
        <group ref={lids} position={[0, built.eyeLine, 0]}>
          <mesh geometry={built.eyes.geometry} material={built.eyes.material} />
        </group>
      )}
      <Ability3D id={power} />
    </group>
  );
}

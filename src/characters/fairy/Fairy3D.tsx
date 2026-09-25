import { useContext, useMemo } from 'react';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { ColorMap, PartMap } from '../types';
import { NEUTRAL, UNITS_PER_WORLD } from '../types';
import { resolveFairyColors } from './config';
import { pickPart, starShape } from '../../lib/three';
import { shade } from '../../lib/color';
import { Layout3DContext } from '../../components/layout3d';
import { Fadinha, type FadinhaPart, type PartOverride } from '../../components/Fadinha';

/**
 * The fairy in 3D: a modelled character (`public/models/fadinha.glb`) rather than a pile
 * of spheres. Clara asked for the fairy in the picture she sent, and this is that fairy,
 * modelled with her own face, hair, petal dress and glass wings.
 *
 * The worksheet still drives her. Each row owns a group inside the model, so choosing,
 * erasing, recolouring, moving, turning and resizing a piece work as they do for every
 * other character; the model simply takes the place of the shapes we built by hand.
 */

/** The model stands 1.2 m tall; a character on the sheet is about three units. */
const MODEL_SCALE = 2.6;
const FEET_Y = -1.55;

/** Which groups of the model each row of the worksheet owns. */
const OWNS: Record<string, FadinhaPart[]> = {
  dress: ['Vestido', 'Cinto'],
  wings: ['Asa_E_Superior', 'Asa_E_Inferior', 'Asa_D_Superior', 'Asa_D_Inferior'],
  hair: ['Cabelo'],
  crown: ['Flor_E', 'Flor_D'],
  eyes: ['Olhos'],
};

/**
 * How each choice in a row changes the piece it owns.
 *
 * The model carries one dress, one pair of wings and one head of hair, so for now the
 * choices are told apart by colour and cut — a longer skirt, wider wings, a fuller bun.
 * When the other pieces are modelled they drop in here as meshes of their own.
 */
const LOOK: Record<string, Record<string, PartOverride>> = {
  dress: {
    petal: {},
    leaf: { scale: [1.04, 1.16, 1.04] },
    star: { scale: [1.1, 0.92, 1.1] },
    bubble: { scale: [1.22, 0.86, 1.22] },
  },
  wings: {
    butterfly: {},
    dragonfly: { scale: [1.18, 0.78, 1] },
    leaf: { scale: [0.88, 1.08, 1] },
    star: { scale: [1.06, 1.06, 1] },
  },
  hair: {
    long: { scale: [1.02, 1.06, 1.02] },
    buns: {},
    curly: { scale: [1.12, 1.04, 1.12] },
    braid: { scale: [0.94, 1.02, 0.94] },
  },
  crown: {
    flower: {},
    leaf: { scale: 0.9 },
    star: { scale: 1.1 },
    berry: { scale: 0.8 },
  },
  eyes: {
    sparkly: {},
    happy: { scale: [1, 0.55, 1] },
    wink: { scale: [1, 0.85, 1] },
    big: { scale: 1.18 },
  },
};

/** The blooms in her hair take a colour of their own per choice. */
const BLOOM_COLOR: Record<string, string> = {
  flower: '#C9A7FF',
  leaf: '#7ED957',
  star: '#FFD93D',
  berry: '#FF6B78',
};

/** A little wand, which the model does not carry. */
function Wand({ kind }: { kind: string | null }) {
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.15, 0.065), { depth: 0.05, bevelEnabled: false }), []);
  if (!kind) return null;
  const tip = kind === 'flower' ? '#FF6EC7' : kind === 'moon' ? '#FFF3B0' : kind === 'bubble' ? '#9BE7FF' : '#FFD93D';
  return (
    <group position={[0.62, -0.32, 0.16]} rotation={[0, 0, -0.16]}>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.78, 14]} />
        <meshStandardMaterial color="#FFE066" roughness={0.4} />
      </mesh>
      <group position={[0, 0.8, 0]}>
        {kind === 'star' ? (
          <mesh geometry={star}>
            <meshStandardMaterial color={tip} roughness={0.35} emissive={tip} emissiveIntensity={0.25} />
          </mesh>
        ) : kind === 'moon' ? (
          <mesh rotation={[0, 0, 0.6]}>
            <torusGeometry args={[0.13, 0.042, 12, 26, Math.PI * 1.3]} />
            <meshStandardMaterial color={tip} roughness={0.35} />
          </mesh>
        ) : kind === 'bubble' ? (
          <mesh>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshPhysicalMaterial color={tip} roughness={0.1} clearcoat={1} transparent opacity={0.7} />
          </mesh>
        ) : (
          <group>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.sin(a) * 0.09, 0, Math.cos(a) * 0.09]} scale={[1, 0.4, 1]}>
                  <sphereGeometry args={[0.075, 14, 14]} />
                  <meshStandardMaterial color={tip} roughness={0.4} />
                </mesh>
              );
            })}
            <mesh position={[0, 0.03, 0]} scale={[1, 0.6, 1]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color="#7ED957" roughness={0.4} />
            </mesh>
          </group>
        )}
        <Sparkles count={14} scale={[0.7, 0.7, 0.7]} size={3} speed={0.6} color="#FFD93D" />
      </group>
    </group>
  );
}

export default function Fairy3D({ parts, colors }: { parts: PartMap; colors: ColorMap }) {
  const eff = resolveFairyColors(parts, colors);
  const layout = useContext(Layout3DContext)?.layout;

  const dress = pickPart(parts.dress, 'petal');
  const wings = pickPart(parts.wings, 'butterfly');
  const hair = pickPart(parts.hair, 'buns');
  const crown = pickPart(parts.crown, 'flower');
  const eyes = pickPart(parts.eyes, 'sparkly');
  const wand = pickPart(parts.wand, 'star');

  /** Colour, cut and the child's own nudges, folded into one override per group. */
  const overrides = useMemo(() => {
    const chosen: Record<string, string | null> = { dress, wings, hair, crown, eyes };
    const colorOf: Record<string, string | undefined> = {
      dress: eff.dress,
      wings: eff.wings,
      hair: eff.hair,
      crown: BLOOM_COLOR[crown ?? 'flower'],
      eyes: undefined,
    };
    const out: Partial<Record<FadinhaPart, PartOverride>> = {};

    for (const [row, groups] of Object.entries(OWNS)) {
      const kind = chosen[row];
      const look = (kind && LOOK[row]?.[kind]) || {};
      const t = layout?.[row] ?? NEUTRAL;
      // the sheet counts y downwards, and its units are the character's own
      const move: [number, number, number] = [
        t.dx / UNITS_PER_WORLD / MODEL_SCALE,
        -t.dy / UNITS_PER_WORLD / MODEL_SCALE,
        (t.dz ?? 0) / UNITS_PER_WORLD / MODEL_SCALE,
      ];
      const turn: [number, number, number] = [0, 0, ((t.r ?? 0) * Math.PI) / -180];
      const base = look.scale ?? 1;
      const grow: number | [number, number, number] =
        typeof base === 'number' ? base * t.s : [base[0] * t.s, base[1] * t.s, base[2] * t.s];

      for (const group of groups) {
        out[group] = { visible: !!kind, position: move, rotation: turn, scale: grow, color: colorOf[row] };
      }
    }

    // the belt keeps a darker shade, or it disappears into the dress
    if (out.Cinto) out.Cinto = { ...out.Cinto, color: shade(eff.dress, -0.5) };
    return out;
  }, [dress, wings, hair, crown, eyes, eff.dress, eff.hair, eff.wings, layout]);

  return (
    <group>
      <Fadinha scale={MODEL_SCALE} position={[0, FEET_Y, 0]} parts={overrides} />
      <Wand kind={wand} />
    </group>
  );
}

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import rawLibrary from './model-library.json';
import trellisLibrary from './trellis-library.json';
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

/** How much taller than her sheet the frame she is fitted into is: room to float. */
const FRAME = 1.12;

const SKIN: Record<SkinTone, string> ={ light: '#fdc59b', tan: '#e4a074', brown: '#b2724a', dark: '#72462c' };

/* ----------------------------------------------- models made by TRELLIS.2 from her pictures */

/**
 * Models made by TRELLIS.2 from the 2D princesses' pictures (art-source/princess/trellis/), far
 * closer to the dolls than the modelled pieces. So far only whole princesses: when the child's
 * princess is exactly one of them, she is shown instead of the pieces.
 */
const TRELLIS = trellisLibrary as unknown as { pieces: Record<string, { url: string; group: string; height: number }> };

/** How much each tone is of the light skin, colour by colour (as the flat princess is painted). */
const TONE_RATIO: Record<SkinTone, [number, number, number]> = {
  light: [1, 1, 1],
  tan: [228 / 253, 160 / 197, 116 / 155],
  brown: [178 / 253, 114 / 197, 74 / 155],
  dark: [114 / 253, 70 / 197, 44 / 155],
};

/**
 * A TRELLIS model's material in her skin. Her skin is painted in the model's texture, among
 * everything else (the texture is cut into many small patches), so it is found by its colour as
 * each pixel is drawn: the warm peach of skin (hue about 10–25°) and not the yellower blonde
 * hair and gold (28° and up), the pinker lips and blush (under 9°) or anything grey or dark. That
 * colour is darkened in the chosen tone's proportions.
 */
function inSkin(m: THREE.MeshStandardMaterial, tone: SkinTone) {
  const c = m.clone();
  if (tone === 'light') return c;
  // the shader works in linear colour: a multiplication in screen colour is k^2.2 in it
  const k = new THREE.Vector3(...TONE_RATIO[tone].map((v) => Math.pow(v, 2.2)));
  c.onBeforeCompile = (shader) => {
    shader.uniforms.skinRatio = { value: k };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 skinRatio;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 s = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
          float mx = max(s.r, max(s.g, s.b));
          float mn = min(s.r, min(s.g, s.b));
          float d = mx - mn;
          float sat = mx > 0.0 ? d / mx : 0.0;
          float hue = 0.0;
          if (d > 0.0) {
            if (mx == s.r) hue = mod((s.g - s.b) / d, 6.0);
            else if (mx == s.g) hue = (s.b - s.r) / d + 2.0;
            else hue = (s.r - s.g) / d + 4.0;
            hue *= 60.0;
          }
          float skin = smoothstep(7.0, 11.0, hue) * (1.0 - smoothstep(24.0, 28.0, hue))
            * smoothstep(0.18, 0.28, sat) * (1.0 - smoothstep(0.72, 0.82, sat))
            * smoothstep(0.3, 0.42, mx);
          diffuseColor.rgb *= mix(vec3(1.0), skinRatio, skin);
        }`,
      );
  };
  c.customProgramCacheKey = () => `princess-trellis-${tone}`;
  return c;
}

/** A whole princess made by TRELLIS.2, in the chosen skin. */
function TrellisWhole({ url, tone }: { url: string; tone: SkinTone }) {
  const { scene } = useGLTF(url);
  const made = useMemo(() => {
    const root = scene.clone(true);
    const materials: THREE.Material[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = inSkin(o.material as THREE.MeshStandardMaterial, tone);
      materials.push(m);
      o.material = m;
    });
    return { root, materials };
  }, [scene, tone]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

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
  // one of the whole princesses TRELLIS.2 has made, exactly as she is
  const whole = TRELLIS.pieces[`whole:${id('dress')}-${id('hair')}-${eyes}-${id('mouth')}`];

  return (
    <group name="princess-model">
      {/* her whole sheet, unseen, with a little room above her crown and below her hem: she
          takes the same room in the frame whatever she wears, and floating up and down she is
          never cut off. The models stand on y = 0 (the bottom of the sheet), so the frame is
          raised to stand there too: centred on 0, it doubled her height and she sat high in the
          picture with her head cut off */}
      <mesh visible={false} position={[0, (CANVAS.h * U) / 2, 0]}>
        <boxGeometry args={[CANVAS.w * U, CANVAS.h * U * FRAME, 0.01]} />
        <meshBasicMaterial />
      </mesh>
      {whole && (
        <Piece id={`whole-${whole.url}-${tone}`}>
          <TrellisWhole url={`${import.meta.env.BASE_URL}${whole.url}`} tone={tone} />
        </Piece>
      )}
      {!whole && (
        <Piece id="head">
          <Plain url={urlOf('head')} skin={skin} />
        </Piece>
      )}
      {!whole && rows.map((row) => {
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
      {!whole && eyes && LIB.pieces[`eyes:${eyes}`] && (
        <Piece id={`eyes-${eyes}`}>
          <Eyes id={eyes} skin={skin} />
        </Piece>
      )}
      {/* the abilities are drawn about the middle of her sheet */}
      <group position={[0, (CANVAS.h * U) / 2, 0]}>
        <Ability3D id={power} />
      </group>
    </group>
  );
}

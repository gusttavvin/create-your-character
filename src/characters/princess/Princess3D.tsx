import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import rawLibrary from './model-library.json';
import { pickOption, type ColorMap, type PartMap } from '../types';
import { PRINCESS, princessColors } from './config';
import { browsFile, browsOf, CANVAS, filesOf, headFile, type SkinTone } from './pieces';
import { Ability3D } from './abilities3d';

/**
 * The princess in 3D, assembled from modelled pieces, the way the dragon is.
 *
 * Every piece was modelled from the same pictures the flat princess is made of
 * (art-source/princess/model3d.mjs): her head a skull with its ears, each dress turned on a
 * lathe with its sleeves, arms and legs, each head of hair a rounded mass round her skull, the
 * tiara and the earrings, and her eyes, brows and mouth laid on the skull. The pieces keep
 * their places on the picture, so they line up with nothing more. Each solid wears its own
 * picture on the side that faces the front — put on here, in the skin the child chose — and a
 * flat colour everywhere else.
 *
 * What is done here: the pictures go on; skin is tinted; the hair that hangs past her chin is
 * laid over the front of whichever dress she wears, and the hair behind her is laid behind it;
 * her eyes blink; her ability goes round her. Like the monster and the dragon she is the
 * finished princess the class built on the sheet: nothing here is dragged (see movable3d).
 */
interface Surface {
  step: number;
  nx: number;
  ny: number;
  heights: number[];
}
interface PieceMeta {
  url: string;
  group: string;
  projected?: boolean;
  front?: Surface;
  back?: Surface;
}
const LIB = rawLibrary as unknown as { unit: number; pieces: Record<string, PieceMeta> };
const U = LIB.unit;
const urlOf = (key: string) => `${import.meta.env.BASE_URL}${LIB.pieces[key].url}`;

const SKIN: Record<SkinTone, string> = { light: '#fdc59b', tan: '#e4a074', brown: '#b2724a', dark: '#72462c' };


/* ------------------------------------------------------------------ pictures on */

/** A picture of hers as a texture, read the way the models' UVs expect (top-left origin). */
function usePicture(url: string | null) {
  const tex = useLoader(THREE.TextureLoader, url ?? browsFile);
  return useMemo(() => {
    const t = tex.clone();
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }, [tex]);
}

/**
 * The material of a side that wears a picture: the picture where it is painted, the flat
 * colour where it is not (the picture's edge is soft, and its clear pixels would otherwise
 * show as black or as a hole).
 */
function pictured(colour: THREE.Color, map: THREE.Texture, side: 1 | -1 = 1) {
  const m = new THREE.MeshStandardMaterial({ color: colour, map, roughness: 0.6, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    // the picture fades into the flat colour as the surface turns away from the front: at the
    // silhouette the picture is its own ink outline, which stretched round the side of a
    // dress as a dark seam
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFaceOn;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvFaceOn = normalize(objectNormal).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFaceOn;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 picture = texture2D(map, vMapUv);
          float on = smoothstep(0.06, 0.5, vFaceOn * ${side.toFixed(1)});
          diffuseColor.rgb = mix(diffuseColor.rgb, picture.rgb, picture.a * on);
        #endif`,
      );
  };
  m.customProgramCacheKey = () => `princess-pictured-${side}`;
  return m;
}

type Pictures = Partial<Record<string, THREE.Texture>>;

/**
 * A copy of a loaded piece this princess can change: its own materials, with her pictures on
 * and her skin, and its own geometry (for hair laid on a dress).
 */
function own(scene: THREE.Group, pictures: Pictures, skin: string, rear?: THREE.Texture | null) {
  const root = scene.clone(true);
  const made = new Map<THREE.Material, THREE.Material>();
  const backs = new Map<THREE.Material, THREE.Material>();
  const geometries: THREE.BufferGeometry[] = [];
  const dress = (m: THREE.Material) => {
    if (made.has(m)) return made.get(m)!;
    const src = m as THREE.MeshStandardMaterial;
    const tex = /^Tex_([a-z]+)_([A-Za-z]+)$/.exec(m.name);
    const flatName = tex ? tex[2] : m.name;
    const colour = flatName === 'Skin' ? new THREE.Color(skin) : src.color.clone();
    const pic = tex ? pictures[tex[1]] : undefined;
    const out = pic ? pictured(colour, pic) : new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0 });
    out.name = m.name;
    made.set(m, out);
    return out;
  };
  // the side of a piece facing away from the front wears its picture from behind, if there is
  // one (a solid with two materials loads as a mesh for each: the flat one's sibling wears a
  // picture)
  const back = (m: THREE.Material) => {
    if (backs.has(m)) return backs.get(m)!;
    const src = m as THREE.MeshStandardMaterial;
    const colour = m.name === 'Skin' ? new THREE.Color(skin) : src.color.clone();
    const out = pictured(colour, rear!, -1);
    out.name = m.name;
    backs.set(m, out);
    return out;
  };
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry = o.geometry.clone();
    geometries.push(o.geometry);
    const single = !Array.isArray(o.material) ? (o.material as THREE.Material) : null;
    const flatBack = single && !single.name.startsWith('Tex_') && o.parent?.children.some((s) => s instanceof THREE.Mesh && !Array.isArray(s.material) && (s.material as THREE.Material).name.startsWith('Tex_'));
    if (rear && flatBack) o.material = back(single);
    else o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
  });
  return { root, materials: [...made.values(), ...backs.values()], geometries };
}

/**
 * A piece painted from Clara's three pictures of the princess (art-source/princess/dolls3d.mjs):
 * the front picture projected from the front, the side picture from the side, the back picture
 * from behind, blended by which way the surface faces; where one picture has nothing (its
 * clear pixels), the others paint it. Positions are the model's own, in metres, so a point is
 * read at its own pixel of each picture (a side picture has x = 512 + how far forward).
 */
function projected(front: THREE.Texture, side: THREE.Texture, back: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.mapF = { value: front };
    shader.uniforms.mapS = { value: side };
    shader.uniforms.mapB = { value: back };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjN = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nuniform sampler2D mapF;\nuniform sampler2D mapS;\nuniform sampler2D mapB;')
      .replace(
        '#include <map_fragment>',
        `{
          float px = vObj.x / ${U.toFixed(6)} + 512.0;
          float py = 1536.0 - vObj.y / ${U.toFixed(6)};
          float pz = vObj.z / ${U.toFixed(6)};
          vec2 uvF = vec2(px / 1024.0, py / 1536.0);
          vec2 uvS = vec2((512.0 + pz) / 1024.0, py / 1536.0);
          vec4 cF = texture2D(mapF, uvF);
          vec4 cS = texture2D(mapS, uvS);
          vec4 cB = texture2D(mapB, uvF);
          vec3 n = normalize(vObjN);
          float wF = pow(max(n.z, 0.0), 3.0) * cF.a;
          float wB = pow(max(-n.z, 0.0), 3.0) * cB.a;
          float wS = pow(abs(n.x), 3.0) * cS.a;
          float sum = wF + wB + wS;
          float any = cF.a + cS.a + cB.a;
          // where no picture has her (the inside of a skirt, its very hem), the colour a little
          // higher up
          for (int k = 1; k <= 12; k++) {
            if (any > 0.02) break;
            vec2 up = vec2(0.0, float(k) * 8.0 / 1536.0);
            cF = texture2D(mapF, uvF - up); cS = texture2D(mapS, uvS - up); cB = texture2D(mapB, uvF - up);
            any = cF.a + cS.a + cB.a;
          }
          vec3 col = sum > 0.02 ? (cF.rgb * wF + cB.rgb * wB + cS.rgb * wS) / sum
            : (any > 0.02 ? (cF.rgb * cF.a + cS.rgb * cS.a + cB.rgb * cB.a) / any : diffuseColor.rgb);
          // the inside of a skirt is in its own shade
          if (!gl_FrontFacing) col *= 0.55;
          diffuseColor.rgb = col;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'princess-projected';
  return m;
}

/** A copy of a projected piece: its own geometry and its own painted material. */
function ownProjected(scene: THREE.Group, front: THREE.Texture, side: THREE.Texture, back: THREE.Texture) {
  const root = scene.clone(true);
  const mat = projected(front, side, back);
  const geometries: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry = o.geometry.clone();
    geometries.push(o.geometry);
    o.material = mat;
  });
  return { root, materials: [mat], geometries };
}

function useDispose(made: { materials: THREE.Material[]; geometries: THREE.BufferGeometry[] }) {
  useEffect(
    () => () => {
      made.materials.forEach((m) => m.dispose());
      made.geometries.forEach((g) => g.dispose());
    },
    [made],
  );
}

/* ------------------------------------------------------------------ the pieces */

/**
 * Her head with a hair: each princess's own head, shaped like her face and painted with it (and
 * her plain skin round the sides and back).
 */
function HeadOf({ tone, hair }: { tone: SkinTone; hair: string }) {
  const { scene } = useGLTF(urlOf(`head:${hair}`));
  const front = usePicture(headFile(tone, hair));
  const skin = usePicture(`/princess/head-${hair}-skin-${tone}.webp`);
  const made = useMemo(() => ownProjected(scene, front, skin, skin), [scene, front, skin]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

function Head({ tone, hair }: { tone: SkinTone; hair: string | null }) {
  if (hair && LIB.pieces[`head:${hair}`]) return <HeadOf tone={tone} hair={hair} />;
  return <HeadPlain tone={tone} />;
}
function HeadPlain({ tone }: { tone: SkinTone }) {
  const { scene } = useGLTF(urlOf('head'));
  const pic = usePicture(headFile(tone));
  const made = useMemo(() => own(scene, { head: pic }, SKIN[tone]), [scene, pic, tone]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

function Dress({ id, tone }: { id: string; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`dress:${id}`));
  const front = usePicture(filesOf('dress', id, tone)[0]);
  const side = usePicture(`/princess/dress-${id}-side-${tone}.webp`);
  const back = usePicture(`/princess/dress-${id}-rear-${tone}.webp`);
  const made = useMemo(() => ownProjected(scene, front, side, back), [scene, front, side, back]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

function Hair({ id }: { id: string; dress: string | null; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`hair:${id}`));
  const front = usePicture(`/princess/hair-${id}-front3d.webp`);
  const side = usePicture(`/princess/hair-${id}-side.webp`);
  const back = usePicture(`/princess/hair-${id}-rear.webp`);
  const made = useMemo(() => ownProjected(scene, front, side, back), [scene, front, side, back]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

/** Her eyes, laid on her face; they blink, closing towards their own middle. */
function Eyes({ id, tone }: { id: string; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`eyes:${id}`));
  const pic = usePicture(filesOf('eyes', id, tone)[1]);
  const brows = usePicture(browsOf(id));
  const made = useMemo(() => {
    const made = own(scene, { eyes: pic, brows }, SKIN[tone]);
    const lids = made.root.getObjectByName('Eyes') as THREE.Group | undefined;
    const middle = lids ? new THREE.Box3().setFromObject(lids).getCenter(new THREE.Vector3()).y : 0;
    return { ...made, lids, middle };
  }, [scene, pic, brows, tone]);
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

function Mouth({ id, tone }: { id: string; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`mouth:${id}`));
  const pic = usePicture(filesOf('mouth', id, tone)[0]);
  const made = useMemo(() => own(scene, { mouth: pic }, SKIN[tone]), [scene, pic, tone]);
  useDispose(made);
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
  const id = (row: string) => pickOption(PRINCESS, row, parts[row])?.id ?? null;
  const dress = id('dress');
  const hair = id('hair');
  const eyes = id('eyes');
  const mouth = id('mouth');
  const power = id('accessory');

  return (
    <group name="princess-model">
      {/* her whole picture, unseen: she takes the same room in the frame whatever she wears,
          and whatever her ability does round her */}
      <mesh visible={false}>
        <boxGeometry args={[CANVAS.w * U, CANVAS.h * U, 0.01]} />
        <meshBasicMaterial />
      </mesh>
      <Piece id={`head-${tone}-${hair}`}>
        <Head tone={tone} hair={hair} />
      </Piece>
      {dress && (
        <Piece id={`dress-${dress}-${tone}`}>
          <Dress id={dress} tone={tone} />
        </Piece>
      )}
      {hair && (
        <Piece id={`hair-${hair}-${dress}`}>
          <Hair id={hair} dress={dress} tone={tone} />
        </Piece>
      )}
      {eyes && (
        <Piece id={`eyes-${eyes}-${tone}`}>
          <Eyes id={eyes} tone={tone} />
        </Piece>
      )}
      {mouth && (
        <Piece id={`mouth-${mouth}-${tone}`}>
          <Mouth id={mouth} tone={tone} />
        </Piece>
      )}
      <Ability3D id={power} />
    </group>
  );
}

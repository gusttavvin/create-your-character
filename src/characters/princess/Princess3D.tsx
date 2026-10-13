import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import rawLibrary from './model-library.json';
import { pickOption, type ColorMap, type PartMap } from '../types';
import { PRINCESS, princessColors } from './config';
import { browsFile, CANVAS, filesOf, hairBack, hairFront, headFile, type SkinTone } from './pieces';
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
  front?: Surface;
  back?: Surface;
}
const LIB = rawLibrary as unknown as { unit: number; pieces: Record<string, PieceMeta> };
const U = LIB.unit;
const urlOf = (key: string) => `${import.meta.env.BASE_URL}${LIB.pieces[key].url}`;

const SKIN: Record<SkinTone, string> = { light: '#fdc59b', tan: '#e4a074', brown: '#b2724a', dark: '#72462c' };

/** A surface of a dress (pixels of the picture, -1 off the dress), read anywhere on the picture. */
function surfaceOf(s: Surface | undefined) {
  if (!s) return () => -1;
  return (x: number, y: number) => {
    const u = Math.max(0, Math.min(s.nx - 1.001, x / s.step));
    const v = Math.max(0, Math.min(s.ny - 1.001, y / s.step));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const a = u - i;
    const b = v - j;
    const at = (di: number, dj: number) => s.heights[(j + dj) * s.nx + i + di];
    return (at(0, 0) * (1 - a) + at(1, 0) * a) * (1 - b) + (at(0, 1) * (1 - a) + at(1, 1) * a) * b;
  };
}

/** From a vertex (metres) to the pixel of the picture it was modelled at, and back. */
const toPixel = (X: number, Y: number): [number, number] => [X / U + CANVAS.w / 2, CANVAS.h - Y / U];

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
function pictured(colour: THREE.Color, map: THREE.Texture) {
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
          float on = smoothstep(0.06, 0.5, vFaceOn);
          diffuseColor.rgb = mix(diffuseColor.rgb, picture.rgb, picture.a * on);
        #endif`,
      );
  };
  m.customProgramCacheKey = () => 'princess-pictured';
  return m;
}

type Pictures = Partial<Record<string, THREE.Texture>>;

/**
 * A copy of a loaded piece this princess can change: its own materials, with her pictures on
 * and her skin, and its own geometry (for hair laid on a dress).
 */
function own(scene: THREE.Group, pictures: Pictures, skin: string) {
  const root = scene.clone(true);
  const made = new Map<THREE.Material, THREE.Material>();
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
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry = o.geometry.clone();
    geometries.push(o.geometry);
    o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
  });
  return { root, materials: [...made.values()], geometries };
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

function Head({ tone }: { tone: SkinTone }) {
  const { scene } = useGLTF(urlOf('head'));
  const pic = usePicture(headFile(tone));
  const made = useMemo(() => own(scene, { head: pic }, SKIN[tone]), [scene, pic, tone]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

function Dress({ id, tone }: { id: string; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`dress:${id}`));
  const pic = usePicture(filesOf('dress', id, tone)[0]);
  const made = useMemo(() => own(scene, { dress: pic }, SKIN[tone]), [scene, pic, tone]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

/**
 * Lays the hair that hangs past her chin on the dress: the front of it over the dress's front,
 * the back of it behind the dress's back, blending in over the shoulders so there is no step.
 */
function layOnDress(mesh: THREE.Mesh, surface: (x: number, y: number) => number, sign: 1 | -1) {
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y] = toPixel(p.getX(i), p.getY(i));
    const s = surface(x, y);
    if (s < 0 || y < 600) continue;
    const blend = THREE.MathUtils.smoothstep(y, 600, 720);
    p.setZ(i, p.getZ(i) + sign * (s + 6) * U * blend);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

function Hair({ id, dress, tone }: { id: string; dress: string | null; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`hair:${id}`));
  const front = usePicture(hairFront(id));
  const back = usePicture(hairBack(id));
  const made = useMemo(() => {
    const made = own(scene, { hairfront: front, hairback: back }, SKIN[tone]);
    const meta = dress ? LIB.pieces[`dress:${dress}`] : undefined;
    if (meta) {
      const frontOf = surfaceOf(meta.front);
      const backOf = surfaceOf(meta.back);
      made.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        if (o.name === 'front') layOnDress(o, frontOf, 1);
        if (o.name === 'back') layOnDress(o, backOf, -1);
      });
    }
    return made;
  }, [scene, front, back, tone, dress]);
  useDispose(made);
  return <primitive object={made.root} dispose={null} />;
}

/** Her eyes, laid on her face; they blink, closing towards their own middle. */
function Eyes({ id, tone }: { id: string; tone: SkinTone }) {
  const { scene } = useGLTF(urlOf(`eyes:${id}`));
  const pic = usePicture(filesOf('eyes', id, tone)[1]);
  const brows = usePicture(browsFile);
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
      <Piece id={`head-${tone}`}>
        <Head tone={tone} />
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

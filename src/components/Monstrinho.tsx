import {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo,
} from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree, type ThreeElements } from '@react-three/fiber';
import { Mesh, MeshStandardMaterial, type Object3D, type Material } from 'three';

export const MONSTRINHO_PARTS = [
  'Corpo', 'Juba', 'Rosto', 'Olhos', 'Olho_E', 'Olho_D', 'Sobrancelhas',
  'Boca', 'Dente', 'Lingua', 'Bochechas', 'Pintinhas', 'Chifres', 'Chifre_E', 'Chifre_D',
  'Topete', 'Braco_E', 'Braco_D', 'Mao_E', 'Mao_D', 'Pernas', 'Perna_E', 'Perna_D', 'Pe_E', 'Pe_D',
] as const;
export type MonstrinhoPart = typeof MONSTRINHO_PARTS[number];
type Vec3 = [number, number, number];
export type PartOverride = {
  visible?: boolean;
  /** Offset in metres, relative to the original local position. */
  position?: Vec3;
  /** Euler XYZ offset in radians, relative to the original orientation. */
  rotation?: Vec3;
  /** Multiplier relative to the original scale. */
  scale?: number | Vec3;
  /** Recolors all materials in this part, including decorative subparts. */
  color?: string;
};
export type MonstrinhoHandle = {
  root: Object3D;
  parts: Record<MonstrinhoPart, Object3D>;
};
export type MonstrinhoProps = Omit<ThreeElements['group'], 'children' | 'ref' | 'dispose'> & {
  url?: string;
  parts?: Partial<Record<MonstrinhoPart, PartOverride>>;
};
const EMPTY_PARTS: NonNullable<MonstrinhoProps['parts']> = {};
export const DEFAULT_MONSTRINHO_URL = `${import.meta.env.BASE_URL}models/monstrinho.glb`;

/**
 * The orange monster, modelled.
 *
 * A static GLB — 1.20 m tall, Y up, facing +Z — carrying named groups for every piece of
 * him, so the worksheet can show, hide, move, turn, resize and recolour them one at a time
 * without a skeleton. Built to the same shape as the Fadinha component beside it.
 *
 * Each character on screen clones the objects and the materials so two monsters never share
 * a colour; the geometries and the textures stay in useGLTF's cache.
 */
export const Monstrinho = forwardRef<MonstrinhoHandle, MonstrinhoProps>(function Monstrinho(
  { url = DEFAULT_MONSTRINHO_URL, parts = EMPTY_PARTS, ...groupProps }, ref,
) {
  const { scene } = useGLTF(url);
  const invalidate = useThree((state) => state.invalidate);
  const instance = useMemo(() => {
    const root = scene.clone(true);
    const ownedMaterials: Material[] = [];
    const materialDefaults: Array<{ material: MeshStandardMaterial; color: MeshStandardMaterial['color'] }> = [];
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const cloneMaterial = (source: Material) => {
        const material = source.clone(); // geometries/textures stay shared and immutable
        ownedMaterials.push(material);
        if (material instanceof MeshStandardMaterial) {
          materialDefaults.push({ material, color: material.color.clone() });
          if (material.transparent) material.depthWrite = false;
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = materials.every((material) => !material.transparent);
      object.receiveShadow = true;
    });
    const named = {} as Record<MonstrinhoPart, Object3D>;
    const defaults = new Map<Object3D, {
      position: Object3D['position']; rotation: Object3D['rotation'];
      scale: Object3D['scale']; visible: boolean;
    }>();
    for (const name of MONSTRINHO_PARTS) {
      const object = root.getObjectByName(name);
      if (!object) throw new Error(`Monstrinho: peça ausente no GLB: ${name}`);
      named[name] = object;
      defaults.set(object, {
        position: object.position.clone(), rotation: object.rotation.clone(),
        scale: object.scale.clone(), visible: object.visible,
      });
    }
    return { root, named, defaults, ownedMaterials, materialDefaults };
  }, [scene]);

  useImperativeHandle(ref, () => ({ root: instance.root, parts: instance.named }), [instance]);

  useLayoutEffect(() => {
    for (const { material, color } of instance.materialDefaults) material.color.copy(color);
    for (const name of MONSTRINHO_PARTS) {
      const object = instance.named[name];
      const original = instance.defaults.get(object)!;
      object.position.copy(original.position);
      object.rotation.copy(original.rotation);
      object.scale.copy(original.scale);
      object.visible = original.visible;
      const change = parts[name];
      if (!change) continue;
      if (change.visible !== undefined) object.visible = change.visible;
      if (change.position) {
        object.position.x += change.position[0];
        object.position.y += change.position[1];
        object.position.z += change.position[2];
      }
      if (change.rotation) {
        object.rotation.x += change.rotation[0];
        object.rotation.y += change.rotation[1];
        object.rotation.z += change.rotation[2];
      }
      if (typeof change.scale === 'number') object.scale.multiplyScalar(change.scale);
      else if (change.scale) {
        object.scale.x *= change.scale[0];
        object.scale.y *= change.scale[1];
        object.scale.z *= change.scale[2];
      }
      if (change.color) object.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (material instanceof MeshStandardMaterial) material.color.set(change.color!);
        }
      });
    }
    invalidate();
  }, [instance, parts, invalidate]);

  useEffect(() => () => {
    // Only dispose this instance's materials. useGLTF owns the cached shared assets.
    for (const material of instance.ownedMaterials) material.dispose();
  }, [instance]);

  return (
    <group {...groupProps} dispose={null}>
      <primitive object={instance.root} dispose={null} />
    </group>
  );
});

/** Optional; call when this character is about to be needed. */
export function preloadMonstrinho(url = DEFAULT_MONSTRINHO_URL) {
  useGLTF.preload(url);
}

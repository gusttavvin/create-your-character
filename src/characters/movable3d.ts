import type { CharacterKind, PartMap } from './types';

/**
 * Which parts a child can move in the 3D view.
 *
 * In 3D the faces are painted onto the head, so eyes and mouths are not separate
 * pieces there and cannot be dragged away from it — everything else is its own
 * object and can be placed freely.
 */
const MOVABLE: Record<CharacterKind, string[]> = {
  monster: ['body', 'eyes', 'arms', 'legs'],
  dragon: ['body', 'wings', 'tail', 'mouth'],
  princess: ['dress', 'hair', 'crown', 'accessory'],
  fairy: ['dress', 'wings', 'hair', 'crown', 'wand'],
  superhero: ['suit', 'cape', 'emblem', 'boots', 'mask', 'power'],
};

export function movable3d(kind: CharacterKind, parts: PartMap): string[] {
  const ids = MOVABLE[kind];
  // the dragon's mouth is only a piece of the scene when it is breathing fire
  if (kind === 'dragon' && parts.mouth !== 'fire') return ids.filter((id) => id !== 'mouth');
  return ids;
}

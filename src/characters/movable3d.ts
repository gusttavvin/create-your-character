import type { CharacterKind, PartMap } from './types';

/**
 * Which parts a child can move in the 3D view.
 *
 * A face is painted onto the head rather than modelled, so it cannot be dragged around
 * the way a piece of geometry can — but it still slides and grows with the buttons
 * beside the picture, so it is listed too.
 */
const MOVABLE: Record<CharacterKind, string[]> = {
  monster: ['body', 'eyes', 'mouth', 'arms', 'legs'],
  dragon: ['body', 'wings', 'tail', 'eyes', 'mouth'],
  princess: ['dress', 'hair', 'crown', 'accessory', 'eyes', 'mouth'],
  fairy: ['dress', 'wings', 'hair', 'crown', 'wand', 'eyes'],
  superhero: ['suit', 'cape', 'emblem', 'boots', 'mask', 'power'],
};

export function movable3d(kind: CharacterKind, _parts: PartMap): string[] {
  return MOVABLE[kind];
}

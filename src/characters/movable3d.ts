import type { CharacterKind, PartMap } from './types';

/**
 * Which parts a child can move in the 3D view.
 *
 * A face is painted onto the head rather than modelled, so it cannot be dragged around
 * the way a piece of geometry can — but it still slides and grows with the buttons
 * beside the picture, so it is listed too.
 *
 * A character with an empty list is assembled for the child in 3D: its pieces sit where
 * the model puts them and cannot be picked up. The monster works that way because the
 * class builds it on the 2D sheet first — where a piece is nudged into place — and the
 * 3D view is the finished creature, which needs its own arrangement to look right.
 */
const MOVABLE: Record<CharacterKind, string[]> = {
  monster: [],
  dragon: ['body', 'wings', 'tail', 'eyes', 'mouth'],
  princess: ['dress', 'hair', 'crown', 'accessory', 'eyes', 'mouth'],
  fairy: ['dress', 'wings', 'hair', 'crown', 'wand', 'eyes'],
  superhero: ['suit', 'cape', 'emblem', 'boots', 'mask', 'power'],
};

export function movable3d(kind: CharacterKind, _parts: PartMap): string[] {
  return MOVABLE[kind];
}

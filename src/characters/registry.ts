import type { CharacterDefinition, CharacterKind } from './types';
import { MONSTER } from './monster/config';
import { DRAGON } from './dragon/config';
import { PRINCESS } from './princess/config';

export const CHARACTERS: Record<CharacterKind, CharacterDefinition> = {
  monster: MONSTER,
  dragon: DRAGON,
  princess: PRINCESS,
};

export const KINDS: CharacterKind[] = ['monster', 'dragon', 'princess'];

export function isKind(v: string | undefined): v is CharacterKind {
  return v === 'monster' || v === 'dragon' || v === 'princess';
}

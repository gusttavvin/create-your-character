import type { CharacterDefinition, CharacterKind } from './types';
import { MONSTER } from './monster/config';
import { DRAGON } from './dragon/config';
import { PRINCESS } from './princess/config';
import { SUPERHERO } from './superhero/config';
import { FAIRY } from './fairy/config';

export const CHARACTERS: Record<CharacterKind, CharacterDefinition> = {
  monster: MONSTER,
  dragon: DRAGON,
  princess: PRINCESS,
  superhero: SUPERHERO,
  fairy: FAIRY,
};

/** Order the children see on the picker. */
export const KINDS: CharacterKind[] = ['monster', 'dragon', 'princess', 'superhero', 'fairy'];

export function isKind(v: string | undefined): v is CharacterKind {
  return !!v && v in CHARACTERS;
}

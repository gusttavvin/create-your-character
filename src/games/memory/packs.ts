import { DECKS, type MemoryDeck, type MemoryItem } from './decks';

const STORE = 'funny-games:memory-packs';

/**
 * The teacher's own picture packs.
 *
 * The packs that come with the game cannot be changed, but Clara can copy one, add her
 * own words to it, throw out the ones her class is not learning this term, and build
 * packs from scratch. They live on her computer, next to her class list for the wheel,
 * so they are here again next lesson without anybody signing in.
 */
export interface CustomPack extends MemoryDeck {
  /** Marks the packs the teacher made, which are the ones she may edit. */
  custom: true;
}

export type Pack = MemoryDeck | CustomPack;

export function isCustom(pack: Pack): pack is CustomPack {
  return (pack as CustomPack).custom === true;
}

function clean(list: unknown): CustomPack[] {
  if (!Array.isArray(list)) return [];
  const out: CustomPack[] = [];
  for (const raw of list) {
    const p = raw as Partial<CustomPack>;
    if (!p || typeof p.id !== 'string' || typeof p.label !== 'string') continue;
    const items: MemoryItem[] = Array.isArray(p.items)
      ? p.items
          .map((i) => ({ emoji: String((i as MemoryItem)?.emoji ?? '').trim(), word: String((i as MemoryItem)?.word ?? '').trim() }))
          .filter((i) => i.emoji && i.word)
      : [];
    out.push({
      id: p.id,
      label: p.label.trim() || 'My pack',
      emoji: (p.emoji ?? '⭐').trim() || '⭐',
      learn: (p.learn ?? p.label).trim(),
      items,
      custom: true,
    });
  }
  return out;
}

export function readPacks(): CustomPack[] {
  try {
    return clean(JSON.parse(localStorage.getItem(STORE) ?? '[]'));
  } catch {
    return [];
  }
}

export function writePacks(packs: CustomPack[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(packs));
  } catch {
    /* a full or blocked storage should not take the lesson down */
  }
  window.dispatchEvent(new CustomEvent('funny-games:packs'));
}

/** Every pack the game offers: the ones it ships with, then the teacher's own. */
export function allPacks(): Pack[] {
  return [...DECKS, ...readPacks()];
}

export function packById(id: string): Pack | undefined {
  return allPacks().find((p) => p.id === id);
}

/** A pack only works as a game if it has at least three pairs to deal. */
export const MIN_ITEMS = 3;

export function newPackId() {
  return `my-${Date.now().toString(36)}`;
}

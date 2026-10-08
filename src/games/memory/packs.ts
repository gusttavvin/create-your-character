import { DECKS, DECK_BY_ID, type MemoryDeck, type MemoryItem } from './decks';

const STORE = 'funny-games:memory-packs';

/**
 * The teacher's own picture packs, and her changes to the ones the game comes with.
 *
 * At first the packs that come with the game could not be changed: Clara had to copy one
 * and edit the copy, and ended up with "Sea animals" and "Sea animals (my copy)" side by
 * side. Now she edits the pack itself. Her version is kept under the same id as the
 * original and takes its place in the game; the original stays in the code, so she can
 * always go back to it.
 *
 * Everything lives on the computer she teaches from, next to her class list for the
 * wheel, so it is here again next lesson without anybody signing in.
 */
export interface CustomPack extends MemoryDeck {
  /** Marks a pack the teacher has written or changed. */
  custom: true;
}

export type Pack = MemoryDeck | CustomPack;

export function isCustom(pack: Pack): pack is CustomPack {
  return (pack as CustomPack).custom === true;
}

/** One of the packs the game comes with (changed or not), rather than one she started. */
export function isShipped(id: string) {
  return id in DECK_BY_ID;
}

/** A picture she chose from her computer: only images kept inline, nothing fetched from elsewhere. */
function cleanImage(raw: unknown) {
  return typeof raw === 'string' && raw.startsWith('data:image/') ? raw : undefined;
}

/** A card can be played once it has a picture of either kind and its English word. */
export function hasPicture(item: MemoryItem) {
  return !!(item.emoji.trim() || item.image);
}

function cleanItem(raw: unknown): MemoryItem {
  const i = (raw ?? {}) as Partial<MemoryItem>;
  const image = cleanImage(i.image);
  const item: MemoryItem = { emoji: String(i.emoji ?? '').trim(), word: String(i.word ?? '').trim() };
  if (image) item.image = image;
  return item;
}

function clean(list: unknown): CustomPack[] {
  if (!Array.isArray(list)) return [];
  const out: CustomPack[] = [];
  for (const raw of list) {
    const p = raw as Partial<CustomPack>;
    if (!p || typeof p.id !== 'string' || typeof p.label !== 'string') continue;
    const items = Array.isArray(p.items) ? p.items.map(cleanItem).filter((i) => hasPicture(i) && i.word) : [];
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

/**
 * Keeps the teacher's packs. Says whether it worked.
 *
 * Pictures from her computer take room, and the browser only gives a site so much. It used
 * to fail without a word, which with photos in the pack would have lost an afternoon's work.
 */
export function writePacks(packs: CustomPack[]): boolean {
  try {
    localStorage.setItem(STORE, JSON.stringify(packs));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent('funny-games:packs'));
  return true;
}

/**
 * Every pack the game offers: the ones it comes with, in their usual order and with her
 * changes in place, then the ones she started herself.
 */
export function allPacks(): Pack[] {
  const mine = readPacks();
  const changed = new Map(mine.map((p) => [p.id, p]));
  return [...DECKS.map((d) => changed.get(d.id) ?? d), ...mine.filter((p) => !isShipped(p.id))];
}

export function packById(id: string): Pack | undefined {
  return allPacks().find((p) => p.id === id);
}

/** A pack only works as a game if it has at least three pairs to deal. */
export const MIN_ITEMS = 3;

export function newPackId() {
  return `my-${Date.now().toString(36)}`;
}

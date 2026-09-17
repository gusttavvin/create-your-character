import type { ComponentType } from 'react';

export type CharacterKind = 'monster' | 'dragon' | 'princess' | 'superhero' | 'fairy';
export type ViewMode = '2d' | '3d';

/** Colors that a character can be painted with (keyed by slot, e.g. "body", "skin"). */
export type ColorMap = Record<string, string>;
/** Selected option id per category id. */
export type PartMap = Record<string, string>;

/** How far a child nudged a part from where the layout put it, and how big they made it. */
export interface PartTransform {
  /** Offset in the character's virtual canvas units. */
  dx: number;
  dy: number;
  /** Size multiplier. */
  s: number;
}

export type LayoutMap = Record<string, PartTransform>;

export const NEUTRAL: PartTransform = { dx: 0, dy: 0, s: 1 };
export const MIN_SCALE = 0.45;
export const MAX_SCALE = 2.2;

export interface PartSvgProps {
  colors: ColorMap;
  className?: string;
}

export interface PartOption {
  id: string;
  /** Word shown under the card (uppercase in the UI). */
  label: string;
  /** Natural English phrase used in the sentence and read aloud, e.g. "a round body". */
  phrase: string;
  /** Raster art (monster kit) */
  img?: string;
  /** Vector art (dragon / princess) */
  Svg?: ComponentType<PartSvgProps>;
}

export interface PartCategory {
  id: string;
  label: string;
  /** Row color, matches the worksheet tiles. */
  color: string;
  /** The child may erase this part, leaving the spot empty. Base parts cannot be erased. */
  optional?: boolean;
  options: PartOption[];
}

export interface ColorSlot {
  id: string;
  label: string;
  swatches: { id: string; label: string; value: string }[];
}

export interface CharacterDefinition {
  kind: CharacterKind;
  /** e.g. "Monster" */
  noun: string;
  /** e.g. "Create Your Monster" */
  title: string;
  emoji: string;
  categories: PartCategory[];
  colorSlots: ColorSlot[];
  defaultParts: PartMap;
  defaultColors: ColorMap;
  /** Builds the English sentence that describes the character. */
  sentence: (parts: PartMap, name?: string) => string;
}

/** A place on the character sheet where a part belongs, in the character's virtual canvas. */
export interface SlotRect {
  /** Category id this area belongs to. Several rects may share one id (e.g. two arms). */
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface SlotLayout {
  vw: number;
  vh: number;
  slots: SlotRect[];
}

export interface SavedCharacter {
  id: string;
  kind: CharacterKind;
  name: string;
  parts: PartMap;
  colors: ColorMap;
  layout: LayoutMap;
  created_at: string;
  updated_at: string;
  owner_id?: string | null;
  owner_name?: string | null;
  class_id?: string | null;
}

export function findOption(def: CharacterDefinition, categoryId: string, optionId: string): PartOption | undefined {
  return def.categories.find((c) => c.id === categoryId)?.options.find((o) => o.id === optionId);
}

/** Erased by the child. Stored, saved and restored like any other choice. */
export const ERASED = '';

/**
 * Resolves what to draw for a category.
 * The empty string means the child erased the part, so nothing is drawn; an id we do not
 * recognise falls back to the category's first option rather than leaving a hole.
 */
export function pickOption(def: CharacterDefinition, categoryId: string, optionId: string | undefined): PartOption | null {
  const cat = def.categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  if (optionId === ERASED) return null;
  return cat.options.find((o) => o.id === optionId) ?? cat.options[0] ?? null;
}

/** The English phrases of the parts the character is actually wearing, in the order given. */
export function phrasesOf(def: CharacterDefinition, parts: PartMap, categoryIds: string[]): string[] {
  return categoryIds
    .map((id) => pickOption(def, id, parts[id])?.phrase)
    .filter((p): p is string => !!p);
}

/** "a, b and c" — the spoken list the children hear. */
export function listPhrases(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function randomParts(def: CharacterDefinition): PartMap {
  const out: PartMap = {};
  for (const c of def.categories) {
    out[c.id] = c.options[Math.floor(Math.random() * c.options.length)].id;
  }
  return out;
}

export function randomColors(def: CharacterDefinition): ColorMap {
  const out: ColorMap = {};
  for (const s of def.colorSlots) {
    out[s.id] = s.swatches[Math.floor(Math.random() * s.swatches.length)].value;
  }
  return out;
}

/** Guarantees every category has a valid selection (falls back to defaults). */
export function normalizeParts(def: CharacterDefinition, parts?: Partial<PartMap> | null): PartMap {
  const out: PartMap = { ...def.defaultParts };
  if (parts) {
    for (const c of def.categories) {
      const v = parts[c.id];
      if (v === ERASED) out[c.id] = ERASED;
      else if (v && c.options.some((o) => o.id === v)) out[c.id] = v;
    }
  }
  return out;
}

export function normalizeColors(def: CharacterDefinition, colors?: Partial<ColorMap> | null): ColorMap {
  const out: ColorMap = { ...def.defaultColors };
  if (colors) {
    for (const [k, v] of Object.entries(colors)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

/** A blank sheet: the child starts with nothing and builds the character up. */
export function emptyParts(def: CharacterDefinition): PartMap {
  const out: PartMap = {};
  for (const c of def.categories) out[c.id] = ERASED;
  return out;
}

export function isEmptyCharacter(parts: PartMap): boolean {
  return Object.values(parts).every((v) => v === ERASED);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeLayout(layout?: Partial<Record<string, Partial<PartTransform>>> | null): LayoutMap {
  const out: LayoutMap = {};
  if (!layout) return out;
  for (const [k, v] of Object.entries(layout)) {
    if (!v || typeof v !== 'object') continue;
    const dx = Number(v.dx) || 0;
    const dy = Number(v.dy) || 0;
    const s = clamp(Number(v.s) || 1, MIN_SCALE, MAX_SCALE);
    if (dx === 0 && dy === 0 && s === 1) continue;
    out[k] = { dx, dy, s };
  }
  return out;
}

/** Applies a nudge or a resize to one part, keeping the scale inside its limits. */
export function withTransform(layout: LayoutMap, categoryId: string, patch: Partial<PartTransform>): LayoutMap {
  const cur = layout[categoryId] ?? NEUTRAL;
  const next: PartTransform = {
    dx: patch.dx ?? cur.dx,
    dy: patch.dy ?? cur.dy,
    s: clamp(patch.s ?? cur.s, MIN_SCALE, MAX_SCALE),
  };
  const out = { ...layout };
  if (next.dx === 0 && next.dy === 0 && next.s === 1) delete out[categoryId];
  else out[categoryId] = next;
  return out;
}

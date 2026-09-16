import type { ComponentType } from 'react';

export type CharacterKind = 'monster' | 'dragon' | 'princess';
export type ViewMode = '2d' | '3d';

/** Colors that a character can be painted with (keyed by slot, e.g. "body", "skin"). */
export type ColorMap = Record<string, string>;
/** Selected option id per category id. */
export type PartMap = Record<string, string>;

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
  created_at: string;
  updated_at: string;
  owner_id?: string | null;
  owner_name?: string | null;
  class_id?: string | null;
}

export function findOption(def: CharacterDefinition, categoryId: string, optionId: string): PartOption | undefined {
  return def.categories.find((c) => c.id === categoryId)?.options.find((o) => o.id === optionId);
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
      if (v && c.options.some((o) => o.id === v)) out[c.id] = v;
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

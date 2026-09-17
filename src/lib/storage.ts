import { supabase } from './supabase';
import { normalizeLayout, type CharacterKind, type ColorMap, type LayoutMap, type PartMap, type SavedCharacter } from '../characters/types';

export interface SaveInput {
  id?: string;
  kind: CharacterKind;
  name: string;
  parts: PartMap;
  colors: ColorMap;
  /** Per-part nudges and resizes the child applied. */
  layout: LayoutMap;
}

export interface CharacterStore {
  readonly kind: 'local' | 'cloud';
  list(): Promise<SavedCharacter[]>;
  get(id: string): Promise<SavedCharacter | null>;
  save(input: SaveInput): Promise<SavedCharacter>;
  remove(id: string): Promise<void>;
}

const LOCAL_KEY = 'cyc.characters.v1';

function readLocal(): SavedCharacter[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SavedCharacter[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: SavedCharacter[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable */
  }
}

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Browser-only storage. Used for guests and whenever the backend is not configured. */
export const localStore: CharacterStore = {
  kind: 'local',
  async list() {
    return readLocal().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async get(id) {
    return readLocal().find((c) => c.id === id) ?? null;
  },
  async save(input) {
    const list = readLocal();
    const now = new Date().toISOString();
    const existing = input.id ? list.find((c) => c.id === input.id) : undefined;
    if (existing) {
      Object.assign(existing, { name: input.name, parts: input.parts, colors: input.colors, layout: input.layout, updated_at: now });
      writeLocal(list);
      return existing;
    }
    const created: SavedCharacter = {
      id: uid(),
      kind: input.kind,
      name: input.name,
      parts: input.parts,
      colors: input.colors,
      layout: input.layout,
      created_at: now,
      updated_at: now,
      owner_name: 'Me',
    };
    list.push(created);
    writeLocal(list);
    return created;
  },
  async remove(id) {
    writeLocal(readLocal().filter((c) => c.id !== id));
  },
};

interface Row {
  id: string;
  kind: CharacterKind;
  name: string;
  parts: PartMap;
  colors: ColorMap | null;
  layout: LayoutMap | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  class_id: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
}

function rowToCharacter(r: Row): SavedCharacter {
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    parts: r.parts ?? {},
    colors: r.colors ?? {},
    layout: normalizeLayout(r.layout),
    created_at: r.created_at,
    updated_at: r.updated_at,
    owner_id: r.owner_id,
    owner_name: prof?.display_name ?? null,
    class_id: r.class_id,
  };
}

const SELECT = 'id, kind, name, parts, colors, layout, created_at, updated_at, owner_id, class_id, profiles(display_name)';

/** Supabase-backed storage for signed-in users (teachers and students). */
export function cloudStore(userId: string, classId: string | null): CharacterStore {
  if (!supabase) throw new Error('Backend not configured');
  const db = supabase;
  return {
    kind: 'cloud',
    async list() {
      const { data, error } = await db.from('characters').select(SELECT).eq('owner_id', userId).order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Row[]).map(rowToCharacter);
    },
    async get(id) {
      const { data, error } = await db.from('characters').select(SELECT).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? rowToCharacter(data as unknown as Row) : null;
    },
    async save(input) {
      if (input.id) {
        const { data, error } = await db
          .from('characters')
          .update({ name: input.name, parts: input.parts, colors: input.colors, layout: input.layout, updated_at: new Date().toISOString() })
          .eq('id', input.id)
          .select(SELECT)
          .single();
        if (error) throw error;
        return rowToCharacter(data as unknown as Row);
      }
      const { data, error } = await db
        .from('characters')
        .insert({ kind: input.kind, name: input.name, parts: input.parts, colors: input.colors, layout: input.layout, owner_id: userId, class_id: classId })
        .select(SELECT)
        .single();
      if (error) throw error;
      return rowToCharacter(data as unknown as Row);
    },
    async remove(id) {
      const { error } = await db.from('characters').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

/** Every character saved by members of a class (teacher view and class gallery). */
export async function listClassCharacters(classId: string): Promise<SavedCharacter[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('characters').select(SELECT).eq('class_id', classId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToCharacter);
}

/** Public read of one character (used by share links). Falls back to local storage. */
export async function fetchCharacterAnywhere(id: string): Promise<SavedCharacter | null> {
  const local = await localStore.get(id);
  if (local) return local;
  if (!supabase) return null;
  const { data, error } = await supabase.from('characters').select(SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToCharacter(data as unknown as Row);
}

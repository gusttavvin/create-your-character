import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client, or null when the app runs without a backend
 * (e.g. local development before the project is configured).
 * In that case the game still works: characters are stored in the browser.
 */
export const supabase: SupabaseClient | null =
  url && anonKey && /^https?:\/\//.test(url) && !url.includes('YOUR-PROJECT')
    ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export const hasBackend = supabase !== null;

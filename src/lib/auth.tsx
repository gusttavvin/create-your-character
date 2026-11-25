import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, hasBackend } from './supabase';

export type Role = 'teacher' | 'student' | 'guest';

export interface Profile {
  id: string;
  role: 'teacher' | 'student';
  display_name: string;
  class_id: string | null;
}

export interface ClassRoom {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
}

interface AuthContextValue {
  ready: boolean;
  hasBackend: boolean;
  user: User | null;
  profile: Profile | null;
  role: Role;
  displayName: string;
  signInTeacher: (email: string, password: string) => Promise<void>;
  signUpTeacher: (email: string, password: string, name: string) => Promise<{ needsEmailConfirm: boolean }>;
  joinClass: (code: string, nickname: string) => Promise<void>;
  /** A student's or a teacher's sign-in: a student's username, or an e-mail. */
  signIn: (login: string, password: string) => Promise<void>;
  signUpStudent: (username: string, password: string, name: string, classCode?: string) => Promise<void>;
  /** A student with an account joins a teacher's class by its code; says the class's name. */
  enterClass: (code: string) => Promise<string>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Students have a username and a password, no e-mail (they are children). The sign-in service
 * wants an e-mail, so a username stands for one on the site's own address, which takes no mail:
 * the project confirms new accounts without sending any (mailer_autoconfirm).
 */
const STUDENT_DOMAIN = 'student.create-your-character.pages.dev';
export const cleanUsername = (u: string) =>
  u
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
const loginEmail = (login: string) => (login.includes('@') ? login.trim() : `${cleanUsername(login)}@${STUDENT_DOMAIN}`);

/** The service's messages, as a child can read them. */
function friendly(err: { message?: string }) {
  const m = err.message ?? '';
  if (/invalid login credentials/i.test(m)) return new Error('That username (or e-mail) and password do not match. Try again!');
  if (/already registered|already exists/i.test(m)) return new Error('That name is taken. Try another one!');
  if (/password/i.test(m) && /6|short|least/i.test(m)) return new Error('The password needs at least 6 letters or numbers.');
  return err instanceof Error ? err : new Error(m || 'Something went wrong. Try again!');
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, class_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('profile load failed', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!hasBackend);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const u = data.user ?? null;
    setUser(u);
    setProfile(u ? await fetchProfile(u.id) : null);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (cancelled) return;
      setUser(u);
      if (u) setProfile(await fetchProfile(u.id));
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) void fetchProfile(u.id).then((p) => setProfile(p));
      else setProfile(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInTeacher = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Backend not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpTeacher = useCallback(async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error('Backend not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'teacher', display_name: name } },
    });
    if (error) throw error;
    return { needsEmailConfirm: !data.session };
  }, []);

  const joinClass = useCallback(async (code: string, nickname: string) => {
    if (!supabase) throw new Error('Backend not configured');
    const clean = code.trim().toUpperCase();
    const { data: cls, error: clsErr } = await supabase.from('classes').select('id, name').eq('code', clean).maybeSingle();
    if (clsErr) throw clsErr;
    if (!cls) throw new Error('Class code not found. Ask your teacher for the code!');
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { role: 'student', display_name: nickname.trim(), class_code: clean } },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (login: string, password: string) => {
    if (!supabase) throw new Error('Backend not configured');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(login), password });
    if (error) throw friendly(error);
  }, []);

  const signUpStudent = useCallback(async (username: string, password: string, name: string, classCode?: string) => {
    if (!supabase) throw new Error('Backend not configured');
    const user = cleanUsername(username);
    if (user.length < 3) throw new Error('Your username needs at least 3 letters or numbers.');
    const code = classCode?.trim().toUpperCase();
    if (code) {
      const { data: cls } = await supabase.from('classes').select('id').eq('code', code).maybeSingle();
      if (!cls) throw new Error('Class code not found. Ask your teacher for the code!');
    }
    const { error } = await supabase.auth.signUp({
      email: loginEmail(user),
      password,
      options: { data: { role: 'student', display_name: name.trim() || user, ...(code ? { class_code: code } : {}) } },
    });
    if (error) throw friendly(error);
  }, []);

  const enterClass = useCallback(
    async (code: string) => {
      if (!supabase) throw new Error('Backend not configured');
      const { data, error } = await supabase.rpc('join_class', { p_code: code.trim().toUpperCase() });
      if (error) {
        if (/not found/i.test(error.message)) throw new Error('Class code not found. Ask your teacher for the code!');
        throw friendly(error);
      }
      await refreshProfile();
      return String(data ?? '');
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role: Role = profile?.role ?? (user ? (user.is_anonymous ? 'student' : 'teacher') : 'guest');
    const displayName =
      profile?.display_name ??
      (user?.user_metadata?.display_name as string | undefined) ??
      (role === 'guest' ? 'Guest' : 'Friend');
    return {
      ready,
      hasBackend,
      user,
      profile,
      role,
      displayName,
      signInTeacher,
      signUpTeacher,
      joinClass,
      signIn,
      signUpStudent,
      enterClass,
      signOut,
      refreshProfile,
    };
  }, [ready, user, profile, signInTeacher, signUpTeacher, joinClass, signIn, signUpStudent, enterClass, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

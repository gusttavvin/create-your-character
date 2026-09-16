import { useMemo } from 'react';
import { useAuth } from './auth';
import { cloudStore, localStore, type CharacterStore } from './storage';

/** Cloud storage when signed in (teacher or student), browser storage otherwise. */
export function useStore(): CharacterStore {
  const { user, profile, hasBackend } = useAuth();
  return useMemo(
    () => (hasBackend && user ? cloudStore(user.id, profile?.class_id ?? null) : localStore),
    [hasBackend, user, profile?.class_id],
  );
}

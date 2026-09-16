import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CHARACTERS, isKind } from '../characters/registry';
import type { SavedCharacter } from '../characters/types';
import Builder from '../components/Builder';
import { useStore } from '../lib/useStore';
import { fetchCharacterAnywhere } from '../lib/storage';

export default function BuilderPage() {
  const { kind, id } = useParams();
  const store = useStore();
  const [initial, setInitial] = useState<SavedCharacter | null | undefined>(id ? undefined : null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setInitial(null);
      return;
    }
    setInitial(undefined);
    (async () => {
      const found = (await store.get(id).catch(() => null)) ?? (await fetchCharacterAnywhere(id));
      if (!cancelled) setInitial(found ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, store]);

  if (!isKind(kind)) return <Navigate to="/" replace />;
  const def = CHARACTERS[kind];

  if (initial === undefined) {
    return (
      <div className="center-msg">
        <span className="spinner" /> Loading your {def.noun.toLowerCase()}…
      </div>
    );
  }

  return <Builder key={`${kind}-${initial?.id ?? 'new'}`} def={def} initial={initial} />;
}

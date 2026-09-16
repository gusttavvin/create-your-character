import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SavedCharacter } from '../characters/types';
import CharacterCard from '../components/CharacterCard';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/useStore';
import { listClassCharacters } from '../lib/storage';
import { playClick } from '../lib/sounds';

export default function GalleryPage() {
  const store = useStore();
  const { user, profile, role } = useAuth();
  const [mine, setMine] = useState<SavedCharacter[] | null>(null);
  const [classList, setClassList] = useState<SavedCharacter[] | null>(null);
  const [tab, setTab] = useState<'mine' | 'class'>('mine');
  const [error, setError] = useState<string | null>(null);

  const classId = profile?.class_id ?? null;

  const load = useCallback(async () => {
    try {
      setMine(await store.list());
      if (classId) setClassList(await listClassCharacters(classId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load characters');
    }
  }, [store, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (c: SavedCharacter) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    playClick();
    await store.remove(c.id);
    await load();
  };

  const list = tab === 'class' ? classList : mine;

  return (
    <div className="gallery">
      <div className="gallery-head">
        <h1 className="page-title">🖼 My Characters</h1>
        {classId && (
          <div className="seg" role="tablist">
            <button type="button" role="tab" className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>
              Mine
            </button>
            <button type="button" role="tab" className={tab === 'class' ? 'is-on' : ''} onClick={() => setTab('class')}>
              My class
            </button>
          </div>
        )}
      </div>

      {role === 'guest' && (
        <p className="note">
          Saved on this device. <Link to="/join">Join your class</Link> to keep your characters online and share them with your teacher.
        </p>
      )}
      {error && <p className="note note-error">{error}</p>}

      {list === null ? (
        <div className="center-msg">
          <span className="spinner" /> Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>No characters yet!</p>
          <div className="empty-actions">
            <Link to="/build/monster" className="btn btn-primary">
              👾 Create a monster
            </Link>
            <Link to="/build/dragon" className="btn btn-primary">
              🐉 Create a dragon
            </Link>
            <Link to="/build/princess" className="btn btn-primary">
              👸 Create a princess
            </Link>
          </div>
        </div>
      ) : (
        <div className="cgrid">
          {list.map((c) => (
            <CharacterCard key={c.id} c={c} canEdit={tab === 'mine' || c.owner_id === user?.id} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

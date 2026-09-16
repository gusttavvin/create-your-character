import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CHARACTERS } from '../characters/registry';
import { normalizeColors, normalizeParts, type SavedCharacter } from '../characters/types';
import Stage from '../components/Stage';
import Sentence from '../components/Sentence';
import { usePrefs } from '../lib/prefs';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/useStore';
import { fetchCharacterAnywhere } from '../lib/storage';
import { speak } from '../lib/speech';

/** Presentation view: big stage + sentence. Great for showing on the projector. */
export default function CharacterPage() {
  const { id } = useParams();
  const store = useStore();
  const { user } = useAuth();
  const { mode, setMode } = usePrefs();
  const [c, setC] = useState<SavedCharacter | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    (async () => {
      const found = (await store.get(id).catch(() => null)) ?? (await fetchCharacterAnywhere(id));
      if (!cancelled) setC(found ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, store]);

  if (c === undefined) {
    return (
      <div className="center-msg">
        <span className="spinner" /> Loading…
      </div>
    );
  }
  if (!c) {
    return (
      <div className="center-msg">
        <p>Hmm, we could not find that character.</p>
        <Link to="/gallery" className="btn btn-primary">
          Go to my characters
        </Link>
      </div>
    );
  }

  const def = CHARACTERS[c.kind];
  const parts = normalizeParts(def, c.parts);
  const colors = normalizeColors(def, c.colors);
  const canEdit = !c.owner_id || c.owner_id === user?.id;

  return (
    <div className="show">
      <div className="show-head">
        <h1 className="page-title">
          {def.emoji} {c.name}
        </h1>
        <div className="show-tools">
          <div className="seg" role="group" aria-label="View">
            <button type="button" className={mode === '2d' ? 'is-on' : ''} onClick={() => setMode('2d')}>
              2D
            </button>
            <button type="button" className={mode === '3d' ? 'is-on' : ''} onClick={() => setMode('3d')}>
              3D
            </button>
          </div>
          {canEdit && (
            <Link to={`/build/${c.kind}/${c.id}`} className="btn btn-primary">
              ✏️ Edit
            </Link>
          )}
          <Link to={`/build/${c.kind}`} className="btn btn-ghost">
            ➕ New {def.noun.toLowerCase()}
          </Link>
        </div>
      </div>

      <div className="show-body">
        <Stage kind={c.kind} parts={parts} colors={colors} mode={mode} name={c.name} big />
        <div className="show-side">
          <Sentence def={def} parts={parts} name={c.name} onRead={() => speak(def.sentence(parts, c.name), { force: true, rate: 0.85 })} />
          {c.owner_name && <p className="show-by">Created by {c.owner_name}</p>}
          <div className="show-words">
            <h3>Words to practise</h3>
            <ul>
              {def.categories.map((cat) => {
                const opt = cat.options.find((o) => o.id === parts[cat.id]);
                if (!opt) return null;
                return (
                  <li key={cat.id}>
                    <button type="button" className="word-btn" style={{ ['--w' as string]: cat.color }} onClick={() => speak(opt.phrase, { force: true })}>
                      <b>{cat.label}:</b> {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

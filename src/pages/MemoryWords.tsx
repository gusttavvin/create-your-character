import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DECKS, type MemoryItem } from '../games/memory/decks';
import { MIN_ITEMS, newPackId, readPacks, writePacks, type CustomPack } from '../games/memory/packs';
import { playClick, playPop } from '../lib/sounds';

const EMPTY_ROW: MemoryItem = { emoji: '', word: '' };

function blankPack(): CustomPack {
  return {
    id: newPackId(),
    label: 'My words',
    emoji: '⭐',
    learn: 'my words',
    items: [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }],
    custom: true,
  };
}

/**
 * Where the teacher writes the words the memory game plays with.
 *
 * Clara asked to be able to change the words, add her own and throw some out. The packs
 * the game ships with stay as they are; she copies one or starts an empty pack, and her
 * packs then sit beside the others in the game. No sign-in: the words live on the
 * computer she teaches from, like her class list for the wheel.
 */
export default function MemoryWords() {
  const [packs, setPacks] = useState<CustomPack[]>(readPacks);
  const [editing, setEditing] = useState<CustomPack | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const save = (pack: CustomPack) => {
    const items = pack.items.map((i) => ({ emoji: i.emoji.trim(), word: i.word.trim() })).filter((i) => i.emoji && i.word);
    const tidy: CustomPack = { ...pack, label: pack.label.trim() || 'My words', learn: (pack.label.trim() || 'my words').toLowerCase(), items };
    const next = packs.some((p) => p.id === tidy.id) ? packs.map((p) => (p.id === tidy.id ? tidy : p)) : [...packs, tidy];
    setPacks(next);
    writePacks(next);
    setEditing(null);
    playPop();
  };

  const remove = (id: string) => {
    const next = packs.filter((p) => p.id !== id);
    setPacks(next);
    writePacks(next);
    playClick();
  };

  const copyOf = (deckId: string) => {
    const deck = DECKS.find((d) => d.id === deckId);
    if (!deck) return;
    setEditing({
      id: newPackId(),
      label: `${deck.label} (my copy)`,
      emoji: deck.emoji,
      learn: deck.learn,
      items: deck.items.map((i) => ({ ...i })),
      custom: true,
    });
    playClick();
  };

  if (editing) {
    const set = (patch: Partial<CustomPack>) => setEditing({ ...editing, ...patch });
    const setItem = (i: number, patch: Partial<MemoryItem>) =>
      set({ items: editing.items.map((row, k) => (k === i ? { ...row, ...patch } : row)) });
    const ready = editing.items.filter((i) => i.emoji.trim() && i.word.trim()).length;

    return (
      <div className="words-page">
        <div className="memory-head">
          <div>
            <h1 className="memory-title">
              <span className="t-cream">Edit the</span> <span className="t-yellow">Words</span>
            </h1>
            <p className="memory-sub">A picture and its English word on each line.</p>
          </div>
          <button type="button" className="btn" onClick={() => setEditing(null)}>
            ← Back
          </button>
        </div>

        <div className="words-card">
          <div className="words-name">
            <label className="field">
              <span>Pack name</span>
              <input className="input" value={editing.label} maxLength={28} onChange={(e) => set({ label: e.target.value })} />
            </label>
            <label className="field field-emoji">
              <span>Icon</span>
              <input className="input" value={editing.emoji} maxLength={4} onChange={(e) => set({ emoji: e.target.value })} />
            </label>
          </div>

          <ol className="words-list">
            {editing.items.map((item, i) => (
              <li key={i} className="words-row">
                <input
                  className="input words-emoji"
                  value={item.emoji}
                  maxLength={4}
                  placeholder="🐠"
                  aria-label={`Picture ${i + 1}`}
                  onChange={(e) => setItem(i, { emoji: e.target.value })}
                />
                <input
                  className="input"
                  value={item.word}
                  maxLength={22}
                  placeholder="fish"
                  aria-label={`Word ${i + 1}`}
                  onChange={(e) => setItem(i, { word: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-ghost words-del"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => set({ items: editing.items.filter((_, k) => k !== i) })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>

          <div className="words-actions">
            <button type="button" className="btn" onClick={() => set({ items: [...editing.items, { ...EMPTY_ROW }] })}>
              ➕ Add a word
            </button>
            <span className="wheel-hint">
              {ready} word{ready === 1 ? '' : 's'} ready{ready < MIN_ITEMS ? ` — at least ${MIN_ITEMS} to play` : ''}
            </span>
            <button type="button" className="btn btn-primary" disabled={ready < MIN_ITEMS} onClick={() => save(editing)}>
              💾 Save pack
            </button>
          </div>
        </div>

        <p className="wheel-hint">
          Type or paste any picture you like in the little box — an emoji keyboard is on ⊞ + . on Windows.
        </p>
      </div>
    );
  }

  return (
    <div className="words-page">
      <div className="memory-head">
        <div>
          <h1 className="memory-title">
            <span className="t-cream">Memory</span> <span className="t-yellow">Words</span>
          </h1>
          <p className="memory-sub">Your own picture packs for the memory game.</p>
        </div>
        <Link to="/memory" className="btn" onClick={() => playClick()}>
          🧠 Back to the game
        </Link>
      </div>

      <section className="words-card">
        <h2 className="words-h2">My packs</h2>
        {packs.length === 0 ? (
          <p className="note">No packs of your own yet. Start an empty one, or copy a pack below and change it.</p>
        ) : (
          <ul className="words-packs">
            {packs.map((p) => (
              <li key={p.id} className="words-pack">
                <span className="words-pack-name">
                  <span aria-hidden>{p.emoji}</span> {p.label}
                </span>
                <span className="words-pack-count">{p.items.length} words</span>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(p)}>
                  ✏️ Edit
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => remove(p.id)}>
                  🗑 Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-fun" onClick={() => setEditing(blankPack())}>
          ➕ New pack
        </button>
      </section>

      <section className="words-card">
        <h2 className="words-h2">Packs that come with the game</h2>
        <p className="note">These stay as they are. Copy one to make it yours, then add or remove words.</p>
        <ul className="words-packs">
          {DECKS.map((d) => (
            <li key={d.id} className="words-pack">
              <span className="words-pack-name">
                <span aria-hidden>{d.emoji}</span> {d.label}
              </span>
              <span className="words-pack-count">{d.items.length} words</span>
              <button type="button" className="btn btn-ghost" onClick={() => copyOf(d.id)}>
                📋 Copy to edit
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

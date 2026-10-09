import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DECK_BY_ID, type MemoryItem } from '../games/memory/decks';
import PictureCredits from '../games/memory/Credits';
import ItemPicture from '../games/memory/ItemPicture';
import { allPacks, centreSavedPictures, hasPicture, isShipped, MIN_ITEMS, newPackId, readPacks, writePacks, type CustomPack, type Pack } from '../games/memory/packs';
import { fromCollection } from '../games/memory/images';
import { fullSize } from '../games/memory/library';
import PicturePicker, { type Picked } from '../games/memory/PicturePicker';
import WordPictures from '../games/memory/WordPictures';
import { playClick, playPop } from '../lib/sounds';

const EMPTY_ROW: MemoryItem = { emoji: '', word: '' };

/** A word with a capital, the way the cards in the game show it. */
function caps(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

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

/** The pack as it can be edited: a copy of its cards, under its own id. */
function editable(pack: Pack): CustomPack {
  return { ...pack, items: pack.items.map((i) => ({ ...i })), custom: true };
}

/** Which picture the picker is choosing: the pack's icon, or the picture on one card. */
type Choosing = { kind: 'icon' } | { kind: 'card'; row: number };

/**
 * Where the teacher writes the words the memory game plays with.
 *
 * Clara asked to be able to change the words, add her own and throw some out — and then
 * to change the packs themselves instead of copies of them. Every pack, the ones the game
 * comes with included, opens straight into the editor, and a changed pack keeps its place
 * in the game. She asked not to be shown which packs she changed nor offered to put them
 * back. No sign-in: the words live on the computer she teaches from, like her class list for
 * the wheel.
 */
export default function MemoryWords() {
  const [packs, setPacks] = useState<Pack[]>(allPacks);
  const [editing, setEditing] = useState<CustomPack | null>(null);
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [problem, setProblem] = useState('');
  /** The line she is typing a word on: its pictures show up right under it. */
  const [typingRow, setTypingRow] = useState<number | null>(null);
  /** The picture being copied into the pack, while it is fetched. */
  const [copying, setCopying] = useState<string | null>(null);

  // pictures chosen before they were centred are centred now
  useEffect(() => {
    void centreSavedPictures().then((changed) => changed && setPacks(allPacks()));
  }, []);

  useEffect(() => {
    if (!editing || choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, choosing]);

  /** Keeps the list of what she wrote, and tells her if it did not fit. */
  const keep = (mine: CustomPack[]) => {
    if (!writePacks(mine)) {
      setProblem('There is no room left to keep these pictures. Try smaller pictures, or fewer of them.');
      return false;
    }
    setProblem('');
    setPacks(allPacks());
    return true;
  };

  const save = (pack: CustomPack) => {
    const items = pack.items
      .map((i) => {
        const row: MemoryItem = { emoji: i.emoji.trim(), word: i.word.trim() };
        if (i.image) row.image = i.image;
        return row;
      })
      .filter((i) => hasPicture(i) && i.word);
    const label = pack.label.trim() || 'My words';
    // a pack she renamed is still learning what it was learning
    const learn = isShipped(pack.id) ? DECK_BY_ID[pack.id].learn : label.toLowerCase();
    const tidy: CustomPack = { ...pack, label, learn, items };
    const mine = readPacks();
    const next = mine.some((p) => p.id === tidy.id) ? mine.map((p) => (p.id === tidy.id ? tidy : p)) : [...mine, tidy];
    if (!keep(next)) return;
    setEditing(null);
    setTypingRow(null);
    playPop();
  };

  const remove = (pack: Pack) => {
    if (!window.confirm(`Delete "${pack.label}"? This cannot be undone.`)) return;
    keep(readPacks().filter((p) => p.id !== pack.id));
    playClick();
  };

  if (editing) {
    const set = (patch: Partial<CustomPack>) => setEditing({ ...editing, ...patch });
    const setItem = (i: number, patch: Partial<MemoryItem>) =>
      set({ items: editing.items.map((row, k) => (k === i ? { ...row, ...patch } : row)) });
    const ready = editing.items.filter((i) => hasPicture(i) && i.word.trim()).length;

    const fromStrip = async (row: number, src: string) => {
      setProblem('');
      setCopying(src);
      try {
        const image = await fromCollection(fullSize(src));
        playClick();
        // she may have kept typing while it was fetched, so only this one picture changes
        setEditing((e) => e && { ...e, items: e.items.map((it, k) => (k === row ? { ...it, emoji: '', image } : it)) });
      } catch {
        setProblem('That picture could not be copied. Check the internet, or choose another one.');
      } finally {
        setCopying(null);
      }
    };

    const pick = (picked: Picked) => {
      if (!choosing) return;
      if (choosing.kind === 'icon') set({ emoji: picked.emoji || editing.emoji });
      // a new picture replaces the old one of either kind
      else setItem(choosing.row, { emoji: picked.emoji, image: picked.image });
      setChoosing(null);
    };

    const pickerFor = choosing
      ? choosing.kind === 'icon'
        ? { title: 'Choose the pack icon', current: { emoji: editing.emoji }, allowUpload: false }
        : {
            title: editing.items[choosing.row].word.trim()
              ? `A picture for "${editing.items[choosing.row].word.trim()}"`
              : 'Choose a picture',
            current: editing.items[choosing.row],
            word: editing.items[choosing.row].word,
            allowUpload: true,
          }
      : null;

    return (
      <div className="words-page">
        <div className="memory-head">
          <div>
            <h1 className="memory-title">
              <span className="t-cream">Edit the</span> <span className="t-yellow">Words</span>
            </h1>
            <p className="memory-sub">A picture and its English word on each line. Tap a picture to change it.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditing(null);
              setTypingRow(null);
            }}
          >
            ← Back
          </button>
        </div>

        <div className="words-card">
          <div className="words-name">
            <label className="field">
              <span>Pack name</span>
              <input className="input" value={editing.label} maxLength={28} onChange={(e) => set({ label: e.target.value })} />
            </label>
            <div className="field field-emoji">
              <span>Icon</span>
              <button type="button" className="words-pic" aria-label="Choose the pack icon" onClick={() => setChoosing({ kind: 'icon' })}>
                <span className="words-pic-img" aria-hidden>
                  {editing.emoji}
                </span>
              </button>
            </div>
          </div>

          <ol className="words-list">
            {editing.items.map((item, i) => (
              <li key={i} className="words-row">
                <button
                  type="button"
                  className={`words-pic${hasPicture(item) ? '' : ' is-empty'}`}
                  aria-label={`Choose picture ${i + 1}`}
                  onClick={() => setChoosing({ kind: 'card', row: i })}
                >
                  {hasPicture(item) ? <ItemPicture item={item} className="words-pic-img" /> : <span className="words-pic-add">➕</span>}
                </button>
                <input
                  className="input"
                  value={caps(item.word)}
                  maxLength={22}
                  placeholder="fish"
                  aria-label={`Word ${i + 1}`}
                  onChange={(e) => {
                    setItem(i, { word: e.target.value });
                    setTypingRow(i);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost words-del"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => {
                    set({ items: editing.items.filter((_, k) => k !== i) });
                    setTypingRow(null);
                  }}
                >
                  ✕
                </button>
                {typingRow === i && item.word.trim().length >= 2 && (
                  <div className="words-suggest">
                    <WordPictures word={item.word} perLibrary={1} compact busySrc={copying} onChoose={(src) => void fromStrip(i, src)} />
                    <div className="words-suggest-tools">
                      <button type="button" className="btn btn-ghost" onClick={() => setChoosing({ kind: 'card', row: i })}>
                        🔎 More pictures
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setTypingRow(null)}>
                        ✓ Done
                      </button>
                    </div>
                  </div>
                )}
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
          {problem && (
            <p className="picker-problem" role="alert">
              {problem}
            </p>
          )}
        </div>

        {pickerFor && <PicturePicker {...pickerFor} onPick={pick} onClose={() => setChoosing(null)} />}
        <PictureCredits />
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
          <p className="memory-sub">The picture packs for the memory game. Change any of them, or make a new one.</p>
        </div>
        <Link to="/memory" className="btn" onClick={() => playClick()}>
          🧠 Back to the game
        </Link>
      </div>

      <section className="words-card">
        <h2 className="words-h2">Picture packs</h2>
        <ul className="words-packs">
          {packs.map((p) => {
            const shipped = isShipped(p.id);
            return (
              <li key={p.id} className="words-pack">
                <span className="words-pack-name">
                  <span aria-hidden>{p.emoji}</span> {p.label}
                </span>
                <span className="words-pack-count">{p.items.length} words</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditing(editable(p));
                    playClick();
                  }}
                >
                  ✏️ Edit
                </button>
                {!shipped && (
                  <button type="button" className="btn btn-ghost" onClick={() => remove(p)}>
                    🗑 Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="btn btn-fun"
          onClick={() => {
            setEditing(blankPack());
            playClick();
          }}
        >
          ➕ New pack
        </button>
        {problem && (
          <p className="picker-problem" role="alert">
            {problem}
          </p>
        )}
      </section>
      <PictureCredits />
    </div>
  );
}

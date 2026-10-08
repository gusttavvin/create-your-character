import { useEffect, useRef, useState } from 'react';
import { playClick } from '../../lib/sounds';
import { fromCollection, fromFile } from './images';
import ItemPicture from './ItemPicture';
import { fullSize } from './library';
import WordPictures from './WordPictures';

/**
 * Pictures to choose from, a click each.
 *
 * The picture used to be typed into a little box, which meant knowing the emoji keyboard
 * shortcut. Clara asked to be able to choose it, and then for nicer pictures than emoji:
 * the card's word is looked up in every picture collection the game knows (library.ts)
 * and those come first. Below them she can use a picture of her own from the computer, or
 * pick an emoji grouped the way a lesson is — animals, food, school.
 */
const GROUPS: { label: string; icon: string; pictures: string[] }[] = [
  {
    label: 'Animals',
    icon: '🐶',
    pictures: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🐴', '🦄', '🐝', '🦋', '🐌', '🐞', '🐢', '🐍', '🦖', '🐘', '🦒', '🦓', '🐑', '🐐', '🐇', '🐿️'],
  },
  {
    label: 'Sea',
    icon: '🐠',
    pictures: ['🐠', '🐟', '🐡', '🐬', '🐳', '🐋', '🦈', '🐙', '🦑', '🦀', '🦞', '🦐', '🐚', '⭐', '🪼', '🦭', '🐊', '🌊', '⚓', '🏝️'],
  },
  {
    label: 'Food',
    icon: '🍕',
    pictures: ['🍕', '🍔', '🌭', '🍟', '🥪', '🌮', '🍝', '🍚', '🍞', '🧀', '🥚', '🥛', '🧃', '🍰', '🎂', '🍦', '🍩', '🍪', '🍫', '🍬', '🍭', '🥕', '🌽', '🥦', '🍅', '🥔', '🥗', '🍿'],
  },
  {
    label: 'Fruit',
    icon: '🍎',
    pictures: ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍈', '🥑'],
  },
  {
    label: 'School',
    icon: '✏️',
    pictures: ['📕', '📗', '📘', '📓', '✏️', '🖍️', '🖊️', '📏', '📐', '✂️', '🎒', '🧮', '🖌️', '🎨', '🕐', '💻', '🧽', '📎', '🗂️', '🏫', '🔤', '🔢', '📅', '🌍'],
  },
  {
    label: 'Toys',
    icon: '🧸',
    pictures: ['⚽', '🏀', '🪁', '🧸', '🤖', '🧩', '🎲', '🪀', '🎈', '🚗', '🚲', '🛴', '🛹', '🥁', '🎸', '🎹', '🎺', '🪅', '🎮', '🪆', '🎁', '🎠'],
  },
  {
    label: 'Colors & shapes',
    icon: '🎨',
    pictures: ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🩷', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🔺', '🔷', '⭐', '❤️', '🌈'],
  },
  {
    label: 'People',
    icon: '👧',
    pictures: ['👶', '👦', '👧', '🧒', '👨', '👩', '👴', '👵', '👪', '👮', '🧑‍🏫', '🧑‍🍳', '🧑‍⚕️', '🧑‍🚒', '🧑‍🌾', '🤴', '👸', '🧙', '🧚', '🦸', '🧜', '🤡'],
  },
  {
    label: 'Body & feelings',
    icon: '😀',
    pictures: ['👀', '👂', '👃', '👄', '👅', '🦷', '✋', '👍', '🦶', '🦵', '💪', '🧠', '😀', '😢', '😡', '😴', '😱', '😋', '🤒', '😎', '🥰', '🤔'],
  },
  {
    label: 'Clothes',
    icon: '👕',
    pictures: ['👕', '👖', '👗', '🧥', '🧦', '🧤', '🧣', '👟', '👞', '👢', '👠', '🩳', '👒', '🧢', '🎩', '👓', '🕶️', '👜', '☂️', '👙'],
  },
  {
    label: 'Home',
    icon: '🏠',
    pictures: ['🏠', '🛏️', '🛋️', '🪑', '🚪', '🪟', '🛁', '🚿', '🚽', '📺', '💡', '🔑', '🧹', '🍽️', '🥄', '🍴', '⏰', '📱', '🧺', '🪥'],
  },
  {
    label: 'Nature & weather',
    icon: '🌳',
    pictures: ['☀️', '🌙', '⭐', '☁️', '🌧️', '⛈️', '❄️', '☃️', '🌈', '🌳', '🌲', '🌵', '🌻', '🌷', '🌹', '🍀', '🍁', '🍄', '🌍', '🔥', '💧', '⛰️'],
  },
  {
    label: 'Transport',
    icon: '🚌',
    pictures: ['🚗', '🚕', '🚌', '🚓', '🚑', '🚒', '🚜', '🚲', '🏍️', '🚂', '✈️', '🚁', '🚀', '⛵', '🚢', '🛸', '🚦', '🛺'],
  },
  {
    label: 'Sports',
    icon: '🏆',
    pictures: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '⛳', '🥊', '🏊', '🚴', '⛷️', '🏄', '🤸', '🏆', '🥇', '🛼'],
  },
];

export interface Picked {
  emoji: string;
  image?: string;
}

export default function PicturePicker({
  title,
  current,
  word = '',
  allowUpload = true,
  onPick,
  onClose,
}: {
  title: string;
  current: Picked;
  /** The card's English word: its pictures in every collection are shown first. */
  word?: string;
  /**
   * Pictures from the collections and from her computer. The pack's icon is shown as text
   * on its button, so it can only be an emoji.
   */
  allowUpload?: boolean;
  onPick: (picked: Picked) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(0);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState(word);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (emoji: string) => {
    playClick();
    onPick({ emoji });
  };

  const fromLibrary = async (src: string) => {
    setProblem('');
    setFetching(src);
    try {
      const image = await fromCollection(fullSize(src));
      playClick();
      onPick({ emoji: '', image });
    } catch {
      setProblem('That picture could not be copied. Check the internet, or choose another one.');
    } finally {
      setFetching(null);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProblem('That file is not a picture. Try a photo or a drawing (JPG or PNG).');
      return;
    }
    setProblem('');
    setLoading(true);
    try {
      const image = await fromFile(file);
      playClick();
      onPick({ emoji: '', image });
    } catch {
      setProblem('That picture could not be opened. Try another one.');
    } finally {
      setLoading(false);
    }
  };

  const shown = GROUPS[group];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal modal-wide picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <div className="picker-head">
          <h2 id="picker-title">{title}</h2>
          <span className="picker-now" aria-label="Picture now">
            {current.image || current.emoji ? <ItemPicture item={current} className="picker-now-pic" /> : '—'}
          </span>
        </div>

        {problem && (
          <p className="picker-problem" role="alert">
            {problem}
          </p>
        )}

        {allowUpload && (
          <>
            <label className="field">
              <span>Find pictures of</span>
              <input
                className="input"
                value={search}
                maxLength={30}
                placeholder="dolphin"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </label>
            <WordPictures word={search} perLibrary={4} busySrc={fetching} onChoose={(src) => void fromLibrary(src)} />

            <div className="picker-upload">
              <button type="button" className="btn btn-fun" disabled={loading} onClick={() => fileRef.current?.click()}>
                {loading ? '⏳ Opening…' : '📷 Use a picture from my computer'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <h3 className="wp-name">Or an emoji</h3>
          </>
        )}

        <div className="picker-groups" role="tablist" aria-label="Kinds of pictures">
          {GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              role="tab"
              aria-selected={i === group}
              className={`pack${i === group ? ' is-on' : ''}`}
              onClick={() => setGroup(i)}
            >
              <span aria-hidden>{g.icon}</span> {g.label}
            </button>
          ))}
        </div>

        <div className="picker-grid" role="tabpanel" aria-label={shown.label}>
          {shown.pictures.map((p) => (
            <button
              key={p}
              type="button"
              className={`picker-pic${!current.image && current.emoji === p ? ' is-on' : ''}`}
              onClick={() => choose(p)}
              aria-label={`Choose ${p}`}
            >
              {p}
            </button>
          ))}
        </div>

        <form
          className="picker-type"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) choose(typed.trim());
          }}
        >
          <label className="field">
            <span>Or type any emoji</span>
            <input className="input" value={typed} maxLength={8} placeholder="🦔" onChange={(e) => setTyped(e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={!typed.trim()}>
            Use it
          </button>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

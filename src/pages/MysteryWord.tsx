import { useCallback, useEffect, useRef, useState } from 'react';
import GameHead from '../games/older/GameHead';
import { speak } from '../lib/speech';
import { playBuzz, playClick, playPop, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

/**
 * Mystery Word (a word game like Wordle), for the older students (11 and up): a student alone,
 * or the class on Clara's shared screen, finds an English word in six tries, from a theme they
 * choose (sports, food, animals, superpowers & fantasy, school & everyday life) or all mixed. After each try every letter turns green (right letter, right
 * place), yellow (in the word, somewhere else) or grey (not in it). A hint says what the word
 * means, for when the class is stuck.
 *
 * The words are ones a class of 11-year-olds knows; Clara can also type her own secret word
 * (of 3 to 8 letters) with its hint. Any letters count as a try: there is no dictionary to
 * check them against, so the teacher decides what is a word.
 */
const WORDS: [string, string][] = [
  ['apple', 'a red or green fruit'],
  ['beach', 'sand and sea, in the summer'],
  ['bread', 'you make a sandwich with it'],
  ['chair', 'you sit on it'],
  ['clock', 'it tells you the time'],
  ['dance', 'you move to music'],
  ['dream', 'a story in your head when you sleep'],
  ['earth', 'the planet we live on'],
  ['fruit', 'apples, bananas and grapes'],
  ['green', 'the colour of grass'],
  ['happy', 'the opposite of sad'],
  ['horse', 'a big animal you can ride'],
  ['house', 'a home'],
  ['juice', 'a drink made from fruit'],
  ['lemon', 'a sour yellow fruit'],
  ['light', 'the opposite of dark'],
  ['money', 'you pay with it'],
  ['mouse', 'a small animal — or part of a computer'],
  ['music', 'songs and sounds'],
  ['night', 'when it is dark and you sleep'],
  ['ocean', 'a very big sea'],
  ['paper', 'you write on it'],
  ['party', 'friends, music and cake'],
  ['phone', 'you call people with it'],
  ['pizza', 'Italian food with cheese'],
  ['plant', 'it grows in the garden'],
  ['queen', 'the wife of a king'],
  ['river', 'water that goes to the sea'],
  ['robot', 'a machine that can move and work'],
  ['shirt', 'clothes for the top of your body'],
  ['sleep', 'you do it in bed'],
  ['smile', 'your face when you are happy'],
  ['snake', 'a long animal with no legs'],
  ['space', 'where the stars and planets are'],
  ['sport', 'football, tennis, swimming…'],
  ['storm', 'very bad weather'],
  ['sugar', 'it makes food sweet'],
  ['table', 'you eat at it'],
  ['teeth', 'you brush them'],
  ['tiger', 'a big orange cat with stripes'],
  ['train', 'it runs on tracks'],
  ['water', 'you drink it'],
  ['watch', 'a clock on your wrist'],
  ['whale', 'the biggest animal in the sea'],
  ['world', 'all the countries'],
  ['write', 'what you do with a pen'],
  ['young', 'the opposite of old'],
  ['zebra', 'a black and white horse'],
];

const TRIES = 6;
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
type Mark = 'right' | 'near' | 'out';

/** How each letter of a try matches the word (a letter counted only as often as it is in it). */
function marks(guess: string, word: string): Mark[] {
  const out: Mark[] = Array(guess.length).fill('out');
  const left: Record<string, number> = {};
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) out[i] = 'right';
    else left[word[i]] = (left[word[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (out[i] === 'right' || !left[guess[i]]) continue;
    out[i] = 'near';
    left[guess[i]]--;
  }
  return out;
}

/** The same themes as the other games for the older students, and the everyday words above. */
const THEMES: { id: string; label: string; emoji: string; words: [string, string][] }[] = [
  {
    id: 'sports',
    label: 'Sports',
    emoji: '⚽',
    words: [
      ['goal', 'a point in football'],
      ['tennis', 'a sport with a racket and a small ball'],
      ['skate', 'you do it on ice, or on wheels'],
      ['coach', 'the person who trains a team'],
      ['medal', 'you win it: gold, silver or bronze'],
      ['swim', 'what you do in the pool'],
      ['match', 'a game between two teams'],
      ['bike', 'you ride it, it has two wheels'],
      ['team', 'players who play together'],
      ['score', 'the number of points'],
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍕',
    words: [
      ['apple', 'a red or green fruit'],
      ['bread', 'you make a sandwich with it'],
      ['juice', 'a drink made from fruit'],
      ['lemon', 'a sour yellow fruit'],
      ['pizza', 'Italian food with cheese'],
      ['sugar', 'it makes food sweet'],
      ['onion', 'it makes you cry when you cut it'],
      ['pasta', 'Italian food: spaghetti is one'],
      ['honey', 'bees make it'],
      ['salad', 'a dish of leaves and vegetables'],
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🐶',
    words: [
      ['horse', 'a big animal you can ride'],
      ['mouse', 'a small animal that likes cheese'],
      ['snake', 'a long animal with no legs'],
      ['tiger', 'a big orange cat with stripes'],
      ['whale', 'the biggest animal in the sea'],
      ['zebra', 'a black and white horse'],
      ['sheep', 'it gives us wool'],
      ['shark', 'a big fish with lots of teeth'],
      ['rabbit', 'it has long ears and loves carrots'],
      ['eagle', 'a big bird that flies very high'],
    ],
  },
  {
    id: 'fantasy',
    label: 'Superpowers & fantasy',
    emoji: '🦸',
    words: [
      ['magic', 'wands, spells and tricks'],
      ['witch', 'she rides a broom'],
      ['giant', 'a very, very big person'],
      ['fairy', 'she is tiny and has wings'],
      ['ghost', 'it says "Boo!"'],
      ['dragon', 'it breathes fire'],
      ['robot', 'a machine that can move and work'],
      ['alien', 'a visitor from another planet'],
      ['power', 'every superhero has one'],
      ['wizard', 'a man who does magic'],
    ],
  },
  {
    id: 'school',
    label: 'School & everyday life',
    emoji: '🎒',
    words: [
      ['chair', 'you sit on it'],
      ['clock', 'it tells you the time'],
      ['paper', 'you write on it'],
      ['pencil', 'you write and draw with it'],
      ['ruler', 'you draw straight lines with it'],
      ['class', 'a group of students'],
      ['lunch', 'the meal in the middle of the day'],
      ['music', 'songs and sounds'],
      ['book', 'you read it'],
      ['teeth', 'you brush them every day'],
    ],
  },
  { id: 'everyday', label: 'Everyday words', emoji: '🔤', words: WORDS },
];
const ALL = THEMES.flatMap((t) => t.words);
const wordsOf = (theme: string) => THEMES.find((t) => t.id === theme)?.words ?? ALL;

function randomWord(theme = 'mix', not?: string) {
  const list = wordsOf(theme);
  let w = list[Math.floor(Math.random() * list.length)];
  while (list.length > 1 && w[0] === not) w = list[Math.floor(Math.random() * list.length)];
  return { word: w[0], hint: w[1] };
}

export default function MysteryWord() {
  const [theme, setTheme] = useState('mix');
  const [{ word, hint }, setSecret] = useState(() => randomWord());
  const [tries, setTries] = useState<string[]>([]);
  const [typing, setTyping] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [focus, setFocus] = useState(false);
  const [ownWord, setOwnWord] = useState('');
  const [ownHint, setOwnHint] = useState('');

  const won = tries.includes(word);
  const lost = !won && tries.length >= TRIES;
  const over = won || lost;

  const start = (next: { word: string; hint: string }) => {
    setSecret(next);
    setTries([]);
    setTyping('');
    setShowHint(false);
  };

  // the letters typed and the tries so far, also kept here, so keys pressed quickly one after
  // another (before the page has redrawn) each see the ones before them
  const live = useRef({ typing, tries });
  live.current = { typing, tries };
  const setTyped = (t: string) => {
    live.current.typing = t;
    setTyping(t);
  };

  const press = useCallback(
    (key: string) => {
      const { typing: now, tries: done } = live.current;
      if (choosing || done.includes(word) || done.length >= TRIES) return;
      if (key === 'enter') {
        if (now.length !== word.length) {
          playBuzz();
          setShake(true);
          window.setTimeout(() => setShake(false), 400);
          return;
        }
        const next = [...done, now];
        live.current.tries = next;
        setTries(next);
        setTyped('');
        if (now === word) {
          playTada();
          burstConfetti(120);
          speak(word, { force: true });
        } else if (next.length >= TRIES) playBuzz();
        else playPop();
        return;
      }
      if (key === 'back') {
        setTyped(now.slice(0, -1));
        return;
      }
      if (/^[a-z]$/.test(key) && now.length < word.length) {
        playClick();
        setTyped(now + key);
      }
    },
    [choosing, word],
  );

  // the computer's own keyboard types too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey || target?.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') press('enter');
      else if (k === 'backspace') press('back');
      else if (/^[a-z]$/.test(k)) press(k);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  /** The colour each key has earned so far: green beats yellow beats grey. */
  const keyMarks: Record<string, Mark> = {};
  for (const t of tries)
    marks(t, word).forEach((m, i) => {
      const k = t[i];
      if (keyMarks[k] === 'right' || (keyMarks[k] === 'near' && m === 'out')) return;
      keyMarks[k] = m;
    });

  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < tries.length) return { letters: tries[r], marks: marks(tries[r], word) };
    if (r === tries.length && !over) return { letters: typing, marks: null };
    return { letters: '', marks: null };
  });

  const stage = (
    <div className="mw-stage">
      <div className="memory-group mw-themes" role="group" aria-label="Theme">
        {[{ id: 'mix', label: 'Mix it all!', emoji: '🎲' }, ...THEMES].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pack${t.id === theme ? ' is-on' : ''}`}
            onClick={() => {
              playClick();
              setTheme(t.id);
              start(randomWord(t.id));
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div className="mw-grid" style={{ ['--len' as string]: word.length }}>
        {rows.map((row, r) => (
          <div key={r} className={`mw-row${shake && r === tries.length ? ' is-shaking' : ''}`}>
            {Array.from({ length: word.length }, (_, i) => (
              <span key={i} className={`mw-tile${row.marks ? ` is-${row.marks[i]}` : row.letters[i] ? ' is-typed' : ''}`}>
                {row.letters[i] ?? ''}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="mw-message" role="status">
        {won && `🎉 Yes! The word is ${word.toUpperCase()}.`}
        {lost && `The word was ${word.toUpperCase()}.`}
        {!over && showHint && (hint ? `💡 ${hint}` : '💡 No hint for this word.')}
        {!over && !showHint && ' '}
      </p>

      <div className="mw-keys">
        {KEYS.map((line, l) => (
          <div key={l} className="mw-keyrow">
            {l === 2 && (
              <button type="button" className="mw-key is-wide" onClick={() => press('enter')}>
                Enter
              </button>
            )}
            {[...line].map((k) => (
              <button key={k} type="button" className={`mw-key${keyMarks[k] ? ` is-${keyMarks[k]}` : ''}`} onClick={() => press(k)}>
                {k}
              </button>
            ))}
            {l === 2 && (
              <button type="button" className="mw-key is-wide" onClick={() => press('back')} aria-label="Delete a letter">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mw-tools">
        {!over && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => (playClick(), setShowHint(true))} disabled={showHint}>
            💡 Hint
          </button>
        )}
        {over && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => speak(word, { force: true })}>
            🔈 Say it
          </button>
        )}
        <button type="button" className="btn btn-fun btn-small" onClick={() => (playClick(), start(randomWord(theme, word)))}>
          🔀 New word
        </button>
      </div>
    </div>
  );

  // ▶ Play: the word alone on the screen, as big as it allows (like the memory game's Play)
  if (focus)
    return (
      <div className="memory-focus mw-focus">
        <button type="button" className="memory-focus-exit" aria-label="Exit" title="Exit" onClick={() => setFocus(false)}>
          ✕
        </button>
        {stage}
      </div>
    );

  return (
    <div className="older-page">
      <GameHead first="Mystery" second="Word" sub="Find the English word in six tries! Say your guess or write it in the chat.">
        {!choosing && (
          <button type="button" className="btn btn-fun" onClick={() => setFocus(true)} title="Only the game on the screen, big">
            ▶ Play
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => (playClick(), setChoosing(!choosing))}>
          {choosing ? '← Back to the game' : '🔒 Choose a word'}
        </button>
      </GameHead>

      {choosing ? (
        <div className="older-edit">
          <p className="wheel-hint">Type a secret word for the class (3 to 8 letters) and a hint. Nobody sees it while you type.</p>
          <div className="older-edit-row">
            <label className="older-label">
              Secret word
              <input
                className="older-input"
                type="password"
                autoComplete="off"
                value={ownWord}
                onChange={(e) => setOwnWord(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8))}
              />
            </label>
            <label className="older-label older-grow">
              Hint
              <input className="older-input" value={ownHint} onChange={(e) => setOwnHint(e.target.value)} placeholder="what it means" />
            </label>
            <button
              type="button"
              className="btn btn-fun"
              disabled={ownWord.length < 3}
              onClick={() => {
                playClick();
                start({ word: ownWord, hint: ownHint.trim() });
                setOwnWord('');
                setOwnHint('');
                setChoosing(false);
              }}
            >
              ▶ Play this word
            </button>
          </div>
        </div>
      ) : (
        stage
      )}
    </div>
  );
}

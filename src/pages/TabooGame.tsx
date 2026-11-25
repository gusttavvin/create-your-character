import { useMemo, useRef, useState, type FormEvent } from 'react';
import GameHead from '../games/older/GameHead';
import { Clock, defaultTeams, isTeams, Teams, teamColor, useCountdown, useStored } from '../games/older/shared';
import { playBuzz, playClick, playPop, playShuffle, playTada } from '../lib/sounds';

/**
 * Don't Say It! (a word game like Taboo), for the older students (11 and up), in Clara's online
 * classes: she shares her screen, but only the student who describes may know the word. So the
 * card stays face down on the screen everyone sees, and she sends it to that student in a private
 * chat message (📋 Copy for the chat). They describe it in English, without saying it or any of
 * its forbidden words, and their team guesses out loud or in the chat. Every word guessed before
 * the time runs out is a point; a forbidden word said is a buzz and no point. Each word is shown
 * to everyone once it is done. Then it is the next team's turn. (👀 Show the card turns the card
 * face up, for a class in a room, with the player sitting with their back to the screen.)
 *
 * 🙋 Just me: a student alone guesses instead. The forbidden words are the clues; they type the
 * word, and every word found before the time runs out is a point.
 *
 * The cards are words 11-year-olds know, by theme (sports, food, animals, superpowers & fantasy,
 * school & everyday life, everyday words) or all mixed; Clara can write her own (✏️ My cards).
 */
interface Card {
  word: string;
  banned: string[];
}

const cards = (list: string[][]): Card[] => list.map(([word, ...banned]) => ({ word, banned }));

const THEMES: { id: string; label: string; emoji: string; cards: Card[] }[] = [
  {
    id: 'sports',
    label: 'Sports',
    emoji: '⚽',
    cards: cards([
      ['football', 'ball', 'goal', 'team', 'kick'],
      ['tennis', 'racket', 'ball', 'court', 'net'],
      ['swimming', 'water', 'pool', 'swim', 'sea'],
      ['basketball', 'ball', 'basket', 'jump', 'team'],
      ['skateboard', 'wheels', 'board', 'ride', 'park'],
      ['medal', 'gold', 'win', 'silver', 'prize'],
      ['coach', 'team', 'teacher', 'train', 'players'],
      ['race', 'run', 'fast', 'win', 'finish'],
      ['goalkeeper', 'goal', 'hands', 'football', 'catch'],
      ['bicycle', 'ride', 'wheels', 'bike', 'pedal'],
    ]),
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍕',
    cards: cards([
      ['pizza', 'cheese', 'Italy', 'food', 'slice'],
      ['chocolate', 'sweet', 'brown', 'candy', 'eat'],
      ['ice cream', 'cold', 'sweet', 'summer', 'dessert'],
      ['breakfast', 'morning', 'eat', 'meal', 'first'],
      ['egg', 'chicken', 'breakfast', 'white', 'yellow'],
      ['banana', 'yellow', 'fruit', 'monkey', 'long'],
      ['sandwich', 'bread', 'ham', 'cheese', 'lunch'],
      ['popcorn', 'cinema', 'corn', 'movie', 'salt'],
      ['water', 'drink', 'wet', 'bottle', 'glass'],
      ['cake', 'birthday', 'sweet', 'candles', 'party'],
    ]),
  },
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🐶',
    cards: cards([
      ['dog', 'pet', 'bark', 'cat', 'animal'],
      ['elephant', 'big', 'grey', 'trunk', 'animal'],
      ['shark', 'sea', 'fish', 'teeth', 'dangerous'],
      ['spider', 'legs', 'web', 'insect', 'scary'],
      ['cat', 'pet', 'meow', 'dog', 'mouse'],
      ['monkey', 'banana', 'tree', 'jungle', 'animal'],
      ['bird', 'fly', 'wings', 'feathers', 'tree'],
      ['horse', 'ride', 'farm', 'run', 'animal'],
      ['penguin', 'ice', 'black', 'white', 'bird'],
      ['snake', 'long', 'legs', 'dangerous', 'hiss'],
    ]),
  },
  {
    id: 'fantasy',
    label: 'Superpowers & fantasy',
    emoji: '🦸',
    cards: cards([
      ['dragon', 'fire', 'fly', 'wings', 'castle'],
      ['superhero', 'powers', 'save', 'cape', 'fly'],
      ['magic', 'wand', 'trick', 'spell', 'wizard'],
      ['ghost', 'scary', 'boo', 'white', 'night'],
      ['castle', 'king', 'queen', 'princess', 'big'],
      ['robot', 'machine', 'metal', 'computer', 'future'],
      ['unicorn', 'horse', 'horn', 'rainbow', 'magic'],
      ['alien', 'space', 'green', 'planet', 'UFO'],
      ['witch', 'broom', 'hat', 'magic', 'black'],
      ['treasure', 'gold', 'pirate', 'box', 'find'],
    ]),
  },
  {
    id: 'school',
    label: 'School & everyday life',
    emoji: '🎒',
    cards: cards([
      ['teacher', 'school', 'students', 'class', 'lesson'],
      ['homework', 'school', 'teacher', 'do', 'house'],
      ['pencil', 'write', 'draw', 'pen', 'paper'],
      ['book', 'read', 'pages', 'story', 'library'],
      ['library', 'books', 'read', 'quiet', 'borrow'],
      ['computer', 'screen', 'internet', 'keyboard', 'mouse'],
      ['bed', 'sleep', 'night', 'bedroom', 'tired'],
      ['phone', 'call', 'mobile', 'apps', 'message'],
      ['clock', 'time', 'hours', 'wall', 'watch'],
      ['kitchen', 'cook', 'food', 'room', 'house'],
    ]),
  },
];

/** Words of every day, the first cards (they stay, as one more theme). */
const SAMPLE: Card[] = [
  ['teacher', 'school', 'students', 'class', 'lesson'],
  ['pizza', 'cheese', 'Italy', 'food', 'slice'],
  ['beach', 'sand', 'sea', 'summer', 'swim'],
  ['birthday', 'party', 'cake', 'age', 'presents'],
  ['football', 'ball', 'goal', 'team', 'sport'],
  ['dog', 'animal', 'pet', 'bark', 'cat'],
  ['hospital', 'doctor', 'sick', 'nurse', 'ill'],
  ['phone', 'call', 'mobile', 'apps', 'message'],
  ['winter', 'cold', 'snow', 'season', 'summer'],
  ['breakfast', 'morning', 'eat', 'meal', 'first'],
  ['library', 'books', 'read', 'quiet', 'borrow'],
  ['rain', 'water', 'umbrella', 'wet', 'weather'],
  ['music', 'song', 'listen', 'sing', 'band'],
  ['money', 'pay', 'buy', 'cash', 'rich'],
  ['moon', 'night', 'sky', 'sun', 'stars'],
  ['kitchen', 'cook', 'food', 'room', 'house'],
  ['airport', 'plane', 'fly', 'travel', 'trip'],
  ['homework', 'school', 'teacher', 'do', 'house'],
  ['chocolate', 'sweet', 'brown', 'candy', 'eat'],
  ['shoes', 'feet', 'wear', 'socks', 'walk'],
  ['computer', 'screen', 'internet', 'keyboard', 'mouse'],
  ['movie', 'cinema', 'watch', 'film', 'actor'],
  ['bicycle', 'ride', 'wheels', 'bike', 'pedal'],
  ['ice cream', 'cold', 'sweet', 'summer', 'dessert'],
  ['mirror', 'look', 'face', 'see', 'glass'],
  ['friend', 'best', 'together', 'play', 'person'],
  ['bed', 'sleep', 'night', 'bedroom', 'tired'],
  ['teeth', 'mouth', 'brush', 'white', 'dentist'],
  ['holiday', 'vacation', 'travel', 'school', 'rest'],
  ['shark', 'sea', 'fish', 'teeth', 'dangerous'],
  ['clock', 'time', 'hours', 'wall', 'watch'],
  ['city', 'town', 'people', 'buildings', 'big'],
  ['egg', 'chicken', 'breakfast', 'white', 'yellow'],
  ['bus', 'drive', 'stop', 'school', 'ride'],
  ['photo', 'camera', 'picture', 'take', 'phone'],
  ['swimming pool', 'water', 'swim', 'summer', 'dive'],
  ['elephant', 'big', 'grey', 'trunk', 'animal'],
  ['rainbow', 'colours', 'rain', 'sky', 'sun'],
  ['spider', 'legs', 'web', 'insect', 'scary'],
  ['video game', 'play', 'console', 'controller', 'win'],
].map(([word, ...banned]) => ({ word, banned }));

THEMES.push({ id: 'everyday', label: 'Everyday words', emoji: '🗂', cards: SAMPLE });
const ALL = THEMES.flatMap((th) => th.cards);

/** A typed guess and a word, the same but for capitals, spaces and punctuation. */
const same = (a: string, b: string) => a.toLowerCase().replace(/[^a-z]/g, '') === b.toLowerCase().replace(/[^a-z]/g, '');

type Mode = 'solo' | 'class';

const MINE = 'funny-games:taboo-cards';
const TEAMS = 'funny-games:taboo-teams';
const TIMES = [30, 60, 90, 120];

/** "word: one, two, three" on each line, as Clara writes them, into cards. */
function parse(text: string): Card[] {
  return text
    .split('\n')
    .map((line) => {
      const [word, rest = ''] = line.split(':');
      return { word: word.trim(), banned: rest.split(',').map((w) => w.trim()).filter(Boolean) };
    })
    .filter((c) => c.word);
}

function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'ready' | 'playing' | 'over';

export default function TabooGame() {
  const [teams, setTeams] = useStored(TEAMS, defaultTeams(2), isTeams);
  const [mine, setMine] = useStored(MINE, '', (v): v is string => typeof v === 'string');
  const [theme, setTheme] = useStored('funny-games:taboo-theme', 'mix', (v): v is string => typeof v === 'string');
  const [mode, setMode] = useStored<Mode>('funny-games:taboo-mode', 'solo', (v): v is Mode => v === 'solo' || v === 'class');
  const [seconds, setSeconds] = useStored('funny-games:taboo-time', 60, (v): v is number => TIMES.includes(v as number));
  const [editing, setEditing] = useState(false);
  const mineCards = useMemo(() => parse(mine), [mine]);
  const deck = theme === 'mine' && mineCards.length ? mineCards : (THEMES.find((th) => th.id === theme)?.cards ?? ALL);
  /** Alone: what is typed, and a shake when it is not the word. */
  const [guess, setGuess] = useState('');
  const [wrong, setWrong] = useState(false);

  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [roundPoints, setRoundPoints] = useState(0);
  /** The cards still to come, and the one on the screen. */
  const pile = useRef<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  /** The word just done, shown to everyone, and whether it was guessed. */
  const [last, setLast] = useState<{ word: string; got: boolean } | null>(null);
  /** Online, the card is face down on the shared screen; face up for a class in a room. */
  const [faceUp, setFaceUp] = useStored('funny-games:taboo-face-up', false, (v): v is boolean => typeof v === 'boolean');
  const [copied, setCopied] = useState(false);

  const timer = useCountdown(seconds, () => {
    playTada();
    setPhase('over');
  });

  const draw = () => {
    if (!pile.current.length) pile.current = shuffled(deck);
    setCard(pile.current.pop()!);
    setCopied(false);
    setGuess('');
  };

  /** The card as a chat message for the student who describes. */
  const copy = async () => {
    if (!card) return;
    playClick();
    const text = `Your word: ${card.word.toUpperCase()} — don't say: ${card.banned.join(', ')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // (a browser that will not copy: the text is shown to copy by hand)
      window.prompt('Copy this and send it in a private message:', text);
    }
  };

  /** Alone, a guess checked: the word, a point and the next card; not it, a shake. */
  const tryGuess = (e: FormEvent) => {
    e.preventDefault();
    if (!card || !guess.trim()) return;
    if (same(guess, card.word)) {
      playPop();
      setRoundPoints((p) => p + 1);
      done(true);
      return;
    }
    playBuzz();
    setWrong(true);
    window.setTimeout(() => setWrong(false), 400);
  };

  const done = (got: boolean) => {
    if (card) setLast({ word: card.word, got });
    draw();
  };

  const begin = () => {
    playShuffle();
    setRoundPoints(0);
    setLast(null);
    setGuess('');
    setPhase('playing');
    draw();
    timer.start();
  };

  const got = () => {
    playPop();
    setRoundPoints((p) => p + 1);
    if (mode === 'solo') return done(true);
    setTeams(teams.map((t, i) => (i === turn ? { ...t, score: t.score + 1 } : t)));
    done(true);
  };
  const taboo = () => {
    playBuzz();
    done(false);
  };
  const skip = () => {
    playClick();
    done(false);
  };
  const nextTeam = () => {
    playClick();
    setTurn((turn + 1) % teams.length);
    setPhase('ready');
    setCard(null);
    timer.reset();
  };

  return (
    <div className="older-page">
      <GameHead
        first="Don't"
        second="Say It!"
        sub={mode === 'solo' ? 'Read the clues and guess the word in English!' : 'Describe the word in English — but never say the forbidden words!'}
      >
        <button type="button" className="btn btn-ghost" onClick={() => (playClick(), setEditing(!editing))}>
          {editing ? '▶ Play' : '✏️ My cards'}
        </button>
      </GameHead>

      <div className="memory-bar">
        <div className="memory-group" role="group" aria-label="Who is playing">
          <button type="button" className={`pack${mode === 'solo' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('solo'), setPhase('ready'), timer.reset())} disabled={timer.running}>
            🙋 Just me
          </button>
          <button type="button" className={`pack${mode === 'class' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('class'), setPhase('ready'), timer.reset())} disabled={timer.running}>
            👥 With my class
          </button>
        </div>
        <div className="memory-group" role="group" aria-label="Theme">
          {[{ id: 'mix', label: 'Mix it all!', emoji: '🎲' }, ...THEMES].map((th) => (
            <button
              key={th.id}
              type="button"
              className={`pack${theme === th.id ? ' is-on' : ''}`}
              onClick={() => (playClick(), setTheme(th.id), (pile.current = []))}
              disabled={timer.running}
            >
              {th.emoji} {th.label}
            </button>
          ))}
          <button
            type="button"
            className={`pack${theme === 'mine' ? ' is-on' : ''}`}
            onClick={() => {
              playClick();
              setTheme('mine');
              pile.current = [];
              if (!mineCards.length) setEditing(true);
            }}
            disabled={timer.running}
          >
            ⭐ My cards ({mineCards.length})
          </button>
        </div>
        {mode === 'class' && (
        <div className="memory-group" role="group" aria-label="The card on the screen">
          <button type="button" className={`pack${!faceUp ? ' is-on' : ''}`} onClick={() => (playClick(), setFaceUp(false))}>
            💻 Online: card hidden
          </button>
          <button type="button" className={`pack${faceUp ? ' is-on' : ''}`} onClick={() => (playClick(), setFaceUp(true))}>
            🏫 In the classroom: card on the screen
          </button>
        </div>
        )}
        <div className="memory-group" role="group" aria-label="Time for each team">
          <span className="memory-pairs-label">TIME</span>
          {TIMES.map((s) => (
            <button key={s} type="button" className={`pack${s === seconds ? ' is-on' : ''}`} onClick={() => (playClick(), setSeconds(s), timer.reset())} disabled={timer.running}>
              {s < 60 ? `${s}s` : `${s / 60} min`}
            </button>
          ))}
        </div>
      </div>

      {editing ? (
        <div className="older-edit">
          <label className="older-label" htmlFor="taboo-mine">
            My cards — one per line: the word, a colon, then the forbidden words
          </label>
          <textarea
            id="taboo-mine"
            className="older-input older-text"
            rows={14}
            value={mine}
            placeholder={'cat: animal, pet, dog, meow\nsummer: hot, season, beach, winter'}
            onChange={(e) => {
              setMine(e.target.value);
              pile.current = [];
            }}
          />
          <p className="wheel-hint">Saved on this computer as you type. {mineCards.length} cards.</p>
        </div>
      ) : (
        <>
          {mode === 'class' && <Teams teams={teams} setTeams={setTeams} turn={turn} />}
          <div className="taboo-stage" style={{ ['--team' as string]: mode === 'class' ? teamColor(turn) : 'var(--mint)' }}>
            {phase === 'ready' && mode === 'solo' && (
              <div className="taboo-ready">
                <p className="taboo-turn">Guess the word!</p>
                <p className="taboo-how">Read the clues and type the word. How many can you find before the time runs out?</p>
                <button type="button" className="btn btn-fun taboo-go" onClick={begin}>
                  ▶ Start ({seconds < 60 ? `${seconds} seconds` : `${seconds / 60} min`})
                </button>
              </div>
            )}
            {phase === 'playing' && mode === 'solo' && card && (
              <div className="taboo-play">
                <Clock left={timer.left} total={seconds} />
                <div className="taboo-card">
                  <p className="taboo-word taboo-blanks" aria-label={`A word of ${card.word.length} letters`}>
                    {[...card.word].map((ch) => (ch === ' ' ? '\u00a0\u00a0' : '_')).join(' ')}
                  </p>
                  <ul className="taboo-banned taboo-clues" aria-label="Clues">
                    {card.banned.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                {last && (
                  <p className={`taboo-last${last.got ? ' is-got' : ''}`}>
                    {last.got ? '✓' : '✗'} It was: <b>{last.word}</b>
                  </p>
                )}
                <form className={`taboo-guess${wrong ? ' is-shaking' : ''}`} onSubmit={tryGuess}>
                  <input className="older-input" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type the word" autoFocus aria-label="Your guess" />
                  <button type="submit" className="btn taboo-yes" disabled={!guess.trim()}>
                    ✓ Check
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={skip}>
                    → Skip
                  </button>
                </form>
                <p className="taboo-round">Words found: {roundPoints}</p>
              </div>
            )}
            {phase === 'over' && mode === 'solo' && (
              <div className="taboo-ready">
                <p className="taboo-turn">⏰ Time's up!</p>
                <p className="taboo-how">
                  You found <b>{roundPoints}</b> {roundPoints === 1 ? 'word' : 'words'}! {roundPoints >= 8 ? 'Amazing!' : roundPoints >= 4 ? 'Great job!' : 'Good try!'}
                </p>
                <button type="button" className="btn btn-fun taboo-go" onClick={begin}>
                  ↺ Play again
                </button>
              </div>
            )}
            {phase === 'ready' && mode === 'class' && (
              <div className="taboo-ready">
                <p className="taboo-turn">
                  <b>{teams[turn]?.name}</b>, it's your turn!
                </p>
                <p className="taboo-how">
                  {faceUp
                    ? 'One player sits with their back to the screen. The team describes the word — without the forbidden words.'
                    : 'Choose who describes. Send them the word in a private chat message (📋 Copy for the chat). Their team guesses out loud or in the chat!'}
                </p>
                <button type="button" className="btn btn-fun taboo-go" onClick={begin}>
                  ▶ Start ({seconds < 60 ? `${seconds} seconds` : `${seconds / 60} min`})
                </button>
              </div>
            )}
            {phase === 'playing' && mode === 'class' && card && (
              <div className="taboo-play">
                <Clock left={timer.left} total={seconds} />
                {faceUp ? (
                  <div className="taboo-card">
                    <p className="taboo-word">{card.word}</p>
                    <ul className="taboo-banned" aria-label="Forbidden words">
                      {card.banned.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="taboo-card is-hidden">
                    <p className="taboo-word">🤫 Secret word</p>
                    <div className="taboo-secret">
                      <button type="button" className="btn btn-fun" onClick={copy}>
                        📋 Copy for the chat
                      </button>
                      <p className="taboo-hint">{copied ? 'Copied! Paste it in a private message to the player who describes.' : 'Only the player who describes may see it.'}</p>
                    </div>
                  </div>
                )}
                {last && (
                  <p className={`taboo-last${last.got ? ' is-got' : ''}`}>
                    {last.got ? '✓' : '✗'} It was: <b>{last.word}</b>
                  </p>
                )}
                <div className="taboo-buttons">
                  <button type="button" className="btn taboo-yes" onClick={got}>
                    ✓ Got it! +1
                  </button>
                  <button type="button" className="btn taboo-no" onClick={taboo}>
                    ✗ Said it!
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={skip}>
                    → Skip
                  </button>
                </div>
                <p className="taboo-round">This turn: {roundPoints}</p>
              </div>
            )}
            {phase === 'over' && mode === 'class' && (
              <div className="taboo-ready">
                <p className="taboo-turn">⏰ Time's up!</p>
                <p className="taboo-how">
                  <b>{teams[turn]?.name}</b> got <b>{roundPoints}</b> {roundPoints === 1 ? 'word' : 'words'}.
                  {card && (
                    <>
                      {' '}
                      The last word was <b>{card.word}</b>.
                    </>
                  )}
                </p>
                <button type="button" className="btn btn-fun taboo-go" onClick={nextTeam}>
                  ▶ Next: {teams[(turn + 1) % teams.length]?.name}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

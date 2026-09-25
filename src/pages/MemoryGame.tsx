import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DECKS, DECK_BY_ID, type MemoryItem } from '../games/memory/decks';
import { speak } from '../lib/speech';
import { playClick, playPop, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

/** How many pairs each level deals. */
const LEVELS = [
  { id: 'easy', label: 'Easy', pairs: 6 },
  { id: 'medium', label: 'Medium', pairs: 8 },
  { id: 'hard', label: 'Hard', pairs: 10 },
];

type Mode = 'pictures' | 'words';

interface Card {
  /** Unique per card. */
  key: string;
  /** Which pair it belongs to. */
  pair: number;
  item: MemoryItem;
  /** In "picture & word" a card shows one or the other. */
  face: 'picture' | 'word';
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function deal(deckId: string, pairs: number, mode: Mode): Card[] {
  const deck = DECK_BY_ID[deckId] ?? DECKS[0];
  const chosen = shuffle(deck.items).slice(0, pairs);
  const cards: Card[] = [];
  chosen.forEach((item, pair) => {
    if (mode === 'words') {
      cards.push({ key: `${pair}-p`, pair, item, face: 'picture' });
      cards.push({ key: `${pair}-w`, pair, item, face: 'word' });
    } else {
      cards.push({ key: `${pair}-a`, pair, item, face: 'picture' });
      cards.push({ key: `${pair}-b`, pair, item, face: 'picture' });
    }
  });
  return shuffle(cards);
}

/**
 * Memory, with a pack of pictures and the English word on every card.
 *
 * Two cards are turned over at a time. A pair that matches stays up and the word is
 * read aloud, so the class hears it each time it is found; a pair that does not match
 * turns back. "Picture & word" deals one picture and one word per pair, which asks the
 * child to read as well as remember.
 */
export default function MemoryGame() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [level, setLevel] = useState(LEVELS[0]);
  const [mode, setMode] = useState<Mode>('pictures');
  const [cards, setCards] = useState<Card[]>(() => deal(DECKS[0].id, LEVELS[0].pairs, 'pictures'));
  const [up, setUp] = useState<string[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const deck = DECK_BY_ID[deckId] ?? DECKS[0];
  const won = found.length > 0 && found.length === cards.length / 2;

  const start = useCallback(
    (nextDeck = deckId, nextLevel = level, nextMode = mode) => {
      window.clearTimeout(timer.current);
      setCards(deal(nextDeck, nextLevel.pairs, nextMode));
      setUp([]);
      setFound([]);
      setMoves(0);
      setBusy(false);
    },
    [deckId, level, mode],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!won) return;
    playTada();
    burstConfetti();
  }, [won]);

  const flip = (card: Card) => {
    if (busy || up.includes(card.key) || found.includes(card.pair)) return;
    playClick();
    const next = [...up, card.key];
    setUp(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next.map((k) => cards.find((c) => c.key === k)!);
    if (a.pair === b.pair) {
      playPop();
      speak(a.item.word);
      setFound((f) => [...f, a.pair]);
      setUp([]);
      return;
    }
    // a miss: both cards stay up long enough to be read, then turn back
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setUp([]);
      setBusy(false);
    }, 900);
  };

  const columns = useMemo(() => (cards.length <= 12 ? 4 : cards.length <= 16 ? 4 : 5), [cards.length]);

  return (
    <div className="memory">
      <div className="memory-head">
        <div>
          <h1 className="memory-title">
            <span className="t-cream">Memory</span> <span className="t-yellow">Game</span>
          </h1>
          <p className="memory-sub">
            Find the pairs and say the word! <b>{deck.learn}</b>
          </p>
        </div>
        <Link to="/" className="btn" onClick={() => playClick()}>
          🏠 Games
        </Link>
      </div>

      <div className="memory-bar">
        <div className="memory-group" role="group" aria-label="Picture pack">
          {DECKS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pack${d.id === deckId ? ' is-on' : ''}`}
              onClick={() => {
                setDeckId(d.id);
                start(d.id, level, mode);
              }}
            >
              <span aria-hidden>{d.emoji}</span> {d.label}
            </button>
          ))}
        </div>

        <div className="memory-group">
          <div className="seg seg-small" role="group" aria-label="How many cards">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={l.id === level.id ? 'is-on' : ''}
                onClick={() => {
                  setLevel(l);
                  start(deckId, l, mode);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="seg seg-small" role="group" aria-label="What to match">
            <button
              type="button"
              className={mode === 'pictures' ? 'is-on' : ''}
              onClick={() => {
                setMode('pictures');
                start(deckId, level, 'pictures');
              }}
            >
              🖼️ Pictures
            </button>
            <button
              type="button"
              className={mode === 'words' ? 'is-on' : ''}
              onClick={() => {
                setMode('words');
                start(deckId, level, 'words');
              }}
            >
              🔤 Picture &amp; word
            </button>
          </div>

          <button type="button" className="btn btn-fun" onClick={() => start()}>
            🔀 New game
          </button>
        </div>
      </div>

      <div className="memory-score">
        <span>
          Pairs found: <b>{found.length}</b> / {cards.length / 2}
        </span>
        <span>
          Tries: <b>{moves}</b>
        </span>
      </div>

      {won && (
        <p className="memory-win" role="status">
          🎉 You found them all in {moves} tries!
        </p>
      )}

      <div className="memory-board" style={{ ['--cols' as string]: columns }}>
        {cards.map((card) => {
          const isUp = up.includes(card.key) || found.includes(card.pair);
          const isFound = found.includes(card.pair);
          return (
            <button
              key={card.key}
              type="button"
              className={`mcard${isUp ? ' is-up' : ''}${isFound ? ' is-found' : ''}`}
              onClick={() => flip(card)}
              aria-label={isUp ? card.item.word : 'Hidden card'}
            >
              <span className="mcard-inner">
                <span className="mcard-back" aria-hidden>
                  ❓
                </span>
                <span className="mcard-front">
                  {card.face === 'picture' ? (
                    <>
                      <span className="mcard-emoji" aria-hidden>
                        {card.item.emoji}
                      </span>
                      {mode === 'pictures' && <span className="mcard-word">{card.item.word}</span>}
                    </>
                  ) : (
                    <span className="mcard-only-word">{card.item.word}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

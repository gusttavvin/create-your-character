import { useMemo, useState } from 'react';
import GameHead from '../games/older/GameHead';
import { Clock, useCountdown, useStored } from '../games/older/shared';
import { resultOf, THEMES, TRAITS, type Question, type Trait } from '../games/older/wyrQuestions';
import { speak } from '../lib/speech';
import { playClick, playPop, playShuffle, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

/**
 * Would You Rather, for the older students (11 and up).
 *
 * A theme (sports, food, animals, superpowers & fantasy, school & everyday life, or all of them
 * mixed), then ten questions, each two choices, A and B, and at the end a fun result: the
 * personality the choices point to ("You are a Dreamer!", wyrQuestions.ts).
 *
 *   🙋 Just me: a student plays alone, clicking the choice they would rather.
 *   👥 With my class: on Clara's shared screen in an online class, the class votes by writing A or
 *   B in the chat, she counts the votes on the two sides, students say why on the mic ("I'd rather
 *   … because …", with a timer for each speaker), and the votes make the class's result.
 *
 * Clara can also write her own questions (✏️ My questions), one per line, the two choices with a |
 * between them; those have no personalities, so no result.
 */
const MINE = 'funny-games:wyr-mine';
const TIMES = [20, 30, 60];
const ROUND = 10;

type Mode = 'solo' | 'class';
type Phase = 'pick' | 'play' | 'result';

function parse(text: string): Question[] {
  return text
    .split('\n')
    .map((l) => l.split('|').map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map((p) => [
      [p[0], 'chill'],
      [p[1], 'chill'],
    ]);
}

function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const question = (q: Question) => `Would you rather ${q[0][0]} or ${q[1][0]}?`;

export default function WouldYouRather() {
  const [mine, setMine] = useStored(MINE, '', (v): v is string => typeof v === 'string');
  const [mode, setMode] = useStored<Mode>('funny-games:wyr-mode', 'solo', (v): v is Mode => v === 'solo' || v === 'class');
  const [seconds, setSeconds] = useStored('funny-games:wyr-time', 30, (v): v is number => TIMES.includes(v as number));
  const [editing, setEditing] = useState(false);
  const mineList = useMemo(() => parse(mine), [mine]);

  const [phase, setPhase] = useState<Phase>('pick');
  const [themeId, setThemeId] = useState('');
  const [round, setRound] = useState<Question[]>([]);
  const [at, setAt] = useState(0);
  const [votes, setVotes] = useState<[number, number]>([0, 0]);
  const [points, setPoints] = useState<Partial<Record<Trait, number>>>({});
  const [chosen, setChosen] = useState<0 | 1 | null>(null);
  const timer = useCountdown(seconds, () => playTada());

  const own = themeId === 'mine';
  const pair = round[at];

  const start = (id: string) => {
    playShuffle();
    const from = id === 'mine' ? mineList : id === 'mix' ? THEMES.flatMap((t) => t.questions) : (THEMES.find((t) => t.id === id)?.questions ?? []);
    setThemeId(id);
    setRound(shuffled(from).slice(0, id === 'mine' ? from.length : ROUND));
    setAt(0);
    setVotes([0, 0]);
    setPoints({});
    setChosen(null);
    timer.reset();
    setPhase('play');
  };

  /** Points for the choices made on this question, then the next one (or the result). */
  const advance = (add: [number, number]) => {
    const next = { ...points };
    if (pair)
      add.forEach((n, side) => {
        const trait = pair[side][1];
        next[trait] = (next[trait] ?? 0) + n;
      });
    setPoints(next);
    setVotes([0, 0]);
    setChosen(null);
    timer.reset();
    if (at + 1 < round.length) {
      setAt(at + 1);
      return;
    }
    if (own) {
      setPhase('pick');
      return;
    }
    playTada();
    burstConfetti(120);
    setPhase('result');
  };

  const choose = (side: 0 | 1) => {
    if (chosen !== null) return;
    playPop();
    setChosen(side);
    // (a moment to see the choice light up, then on)
    window.setTimeout(() => advance(side === 0 ? [1, 0] : [0, 1]), 450);
  };
  const vote = (side: 0 | 1, by: number) => {
    playPop();
    setVotes((v) => (side === 0 ? [Math.max(0, v[0] + by), v[1]] : [v[0], Math.max(0, v[1] + by)]));
  };

  const result = resultOf(points);
  const theme = THEMES.find((t) => t.id === themeId);

  return (
    <div className="older-page">
      <GameHead
        first="Would You"
        second="Rather?"
        sub={
          mode === 'solo' ? (
            <>Choose a theme, pick A or B, and find out what kind of person you are!</>
          ) : (
            <>
              Vote in the chat: <b>A</b> or <b>B</b>. Then say why: <b>“I'd rather … because …”</b>
            </>
          )
        }
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            playClick();
            setEditing(!editing);
            setPhase('pick');
          }}
        >
          {editing ? '▶ Play' : '✏️ My questions'}
        </button>
      </GameHead>

      <div className="memory-bar">
        <div className="memory-group" role="group" aria-label="Who is playing">
          <button type="button" className={`pack${mode === 'solo' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('solo'), setPhase('pick'))}>
            🙋 Just me
          </button>
          <button type="button" className={`pack${mode === 'class' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('class'), setPhase('pick'))}>
            👥 With my class
          </button>
        </div>
        {mode === 'class' && (
          <div className="memory-group" role="group" aria-label="Time to speak">
            <span className="memory-pairs-label">TIME TO SPEAK</span>
            {TIMES.map((s) => (
              <button key={s} type="button" className={`pack${s === seconds ? ' is-on' : ''}`} onClick={() => (playClick(), setSeconds(s), timer.reset())} disabled={timer.running}>
                {s}s
              </button>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <div className="older-edit">
          <label className="older-label" htmlFor="wyr-mine">
            My questions — one per line: the two choices with a | between them
          </label>
          <textarea
            id="wyr-mine"
            className="older-input older-text"
            rows={14}
            value={mine}
            placeholder={'live in Brazil | live in England\nhave a cat | have a dog'}
            onChange={(e) => setMine(e.target.value)}
          />
          <p className="wheel-hint">
            Saved on this computer as you type. {mineList.length} questions. Each one reads “Would you rather <i>first</i> or <i>second</i>?” (Your
            own questions have no personality result.)
          </p>
        </div>
      ) : phase === 'pick' ? (
        <div className="wyr-themes">
          <p className="wyr-title">Choose a theme</p>
          <div className="wyr-theme-grid">
            {THEMES.map((t) => (
              <button key={t.id} type="button" className="wyr-theme" onClick={() => start(t.id)}>
                <span className="wyr-theme-emoji" aria-hidden>
                  {t.emoji}
                </span>
                {t.label}
              </button>
            ))}
            <button type="button" className="wyr-theme is-mix" onClick={() => start('mix')}>
              <span className="wyr-theme-emoji" aria-hidden>
                🎲
              </span>
              Mix it all!
            </button>
            {mineList.length > 0 && (
              <button type="button" className="wyr-theme is-mine" onClick={() => start('mine')}>
                <span className="wyr-theme-emoji" aria-hidden>
                  ⭐
                </span>
                My questions ({mineList.length})
              </button>
            )}
          </div>
        </div>
      ) : phase === 'play' && pair ? (
        <div className="wyr-stage">
          <p className="wyr-title">Would you rather…</p>
          <div className="wyr-sides">
            {([0, 1] as const).map((side) =>
              mode === 'solo' ? (
                <button
                  key={side}
                  type="button"
                  className={`wyr-side is-${side ? 'b' : 'a'}${chosen === side ? ' is-chosen' : ''}${chosen !== null && chosen !== side ? ' is-not' : ''}`}
                  onClick={() => choose(side)}
                >
                  <span className="wyr-letter">{side ? 'B' : 'A'}</span>
                  <span className="wyr-choice">{pair[side][0]}</span>
                </button>
              ) : (
                <div key={side} className={`wyr-side is-${side ? 'b' : 'a'}`}>
                  <span className="wyr-letter">{side ? 'B' : 'A'}</span>
                  <p className="wyr-choice">{pair[side][0]}</p>
                  <div className="wyr-votes" aria-label={`Votes for ${pair[side][0]}`}>
                    <button type="button" className="team-step" onClick={() => vote(side, -1)} aria-label="One vote less">
                      −
                    </button>
                    <span className="wyr-count">
                      {votes[side]} {votes[side] === 1 ? 'vote' : 'votes'}
                    </span>
                    <button type="button" className="team-step" onClick={() => vote(side, 1)} aria-label="One more vote">
                      +
                    </button>
                  </div>
                </div>
              ),
            )}
            <span className="wyr-or" aria-hidden>
              or
            </span>
          </div>
          <div className="wyr-tools">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => speak(question(pair), { force: true })}>
              🔈 Read it
            </button>
            {mode === 'class' && (
              <>
                {timer.running || timer.left < seconds ? (
                  <>
                    <Clock left={timer.left} total={seconds} />
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => (playClick(), timer.start())}>
                      ↺ Next speaker
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => (playClick(), timer.start())}>
                    ⏱ Start the timer
                  </button>
                )}
                <button type="button" className="btn btn-fun" onClick={() => (playShuffle(), advance(votes))}>
                  {at + 1 < round.length ? 'Next question →' : own ? 'Finish' : '🎉 See our result'}
                </button>
              </>
            )}
          </div>
          {mode === 'class' && (
            <p className="wyr-frame">
              I'd rather <b>…</b> because <b>…</b>
            </p>
          )}
          <p className="wheel-hint">
            {theme ? `${theme.emoji} ${theme.label} · ` : ''}Question {at + 1} of {round.length}
          </p>
        </div>
      ) : (
        <div className="wyr-result" style={{ ['--trait' as string]: TRAITS[result.top].color }}>
          <p className="wyr-result-emoji" aria-hidden>
            {TRAITS[result.top].emoji}
          </p>
          <p className="wyr-result-title">
            {mode === 'solo' ? 'You are' : 'Our class is'} {TRAITS[result.top].title}!
          </p>
          <p className="wyr-result-text">{TRAITS[result.top].text}</p>
          <div className="wyr-bars">
            {result.shares.map(({ trait, share }) => (
              <div key={trait} className="wyr-bar">
                <span className="wyr-bar-name">
                  {TRAITS[trait].emoji} {TRAITS[trait].title.replace(/^an? /, '')}
                </span>
                <span className="wyr-bar-track">
                  <span className="wyr-bar-fill" style={{ width: `${Math.round(share * 100)}%`, background: TRAITS[trait].color }} />
                </span>
                <span className="wyr-bar-pct">{Math.round(share * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="wheel-hint">Just for fun! 😄</p>
          <div className="wyr-tools">
            <button type="button" className="btn btn-fun" onClick={() => start(themeId)}>
              ↺ Play again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (playClick(), setPhase('pick'))}>
              Choose another theme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

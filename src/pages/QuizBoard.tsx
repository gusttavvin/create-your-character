import { useState, type FormEvent } from 'react';
import GameHead from '../games/older/GameHead';
import { defaultTeams, isTeams, Teams, teamColor, useStored } from '../games/older/shared';
import { BUILT_IN, isRight, shownAnswer, type Board, type Cell } from '../games/older/quizBoards';
import { speak } from '../lib/speech';
import { playBuzz, playClick, playPop, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

/**
 * Quiz Board, for the older students (11 and up): a board of categories and questions worth
 * 100, 200, 300 points. A question opens big when it is picked.
 *
 *   👥 With my class: on Clara's shared screen, the class in teams (or each student on their
 *   own); she shows the answer and gives the points to whoever got it.
 *   🙋 Just me: a student plays alone, types the answer and it is checked (quizBoards.isRight);
 *   if the site cannot tell, they see the answer and say themselves whether they had it.
 *
 * The boards are the site's own (a review and one per theme, quizBoards.ts) and Clara's own
 * (➕ New board, ✏️ Edit), kept on her computer like the wheel's class list.
 */
const MINE = 'funny-games:quiz-my-boards';
const TEAMS = 'funny-games:quiz-teams';
const points = (row: number) => (row + 1) * 100;

type Mode = 'solo' | 'class';

const isBoards = (v: unknown): v is Board[] =>
  Array.isArray(v) && v.every((b) => b && typeof b.id === 'string' && typeof b.title === 'string' && Array.isArray(b.categories) && Array.isArray(b.cells));

const blankCell = (): Cell => ({ q: '', a: '' });

export default function QuizBoard() {
  const [mine, setMine] = useStored<Board[]>(MINE, [], isBoards);
  const [teams, setTeams] = useStored(TEAMS, defaultTeams(2), isTeams);
  const [mode, setMode] = useStored<Mode>('funny-games:quiz-mode', 'solo', (v): v is Mode => v === 'solo' || v === 'class');
  const boards = [...BUILT_IN, ...mine];
  const [boardId, setBoardId] = useState(BUILT_IN[0].id);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const isMine = mine.some((b) => b.id === board.id);
  const [editing, setEditing] = useState(false);
  /** Questions already asked on this board, as "category-row". */
  const [used, setUsed] = useState<string[]>([]);
  const [open, setOpen] = useState<{ c: number; r: number } | null>(null);
  const [shown, setShown] = useState(false);
  /** Playing alone: the score, what was typed, and whether it was right. */
  const [score, setScore] = useState(0);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'unsure' | null>(null);

  const rows = Math.max(...board.cells.map((c) => c.length));
  const update = (b: Board) => setMine(mine.map((x) => (x.id === b.id ? b : x)));

  const choose = (id: string) => {
    playClick();
    setBoardId(id);
    setUsed([]);
    setScore(0);
    setEditing(false);
  };

  const ask = (c: number, r: number) => {
    if (used.includes(`${c}-${r}`) || !board.cells[c][r]?.q.trim()) return;
    playPop();
    setOpen({ c, r });
    setShown(false);
    setTyped('');
    setVerdict(null);
  };

  const close = (key: string) => {
    setUsed([...used, key]);
    setOpen(null);
  };

  const award = (team: number | null) => {
    if (!open) return;
    if (team === null) playBuzz();
    else {
      setTeams(teams.map((t, i) => (i === team ? { ...t, score: t.score + points(open.r) } : t)));
      playTada();
      burstConfetti(70);
    }
    close(`${open.c}-${open.r}`);
  };

  /** Alone: the typed answer checked; right, the points; not sure, the answer to judge. */
  const check = (e: FormEvent) => {
    e.preventDefault();
    if (!open || !typed.trim()) return;
    const cell = board.cells[open.c][open.r];
    if (isRight(typed, cell.a)) {
      playTada();
      burstConfetti(70);
      setScore((s) => s + points(open.r));
      setVerdict('right');
    } else {
      playBuzz();
      setVerdict('unsure');
    }
    setShown(true);
  };
  const selfMark = (right: boolean) => {
    if (!open) return;
    if (right) {
      playPop();
      setScore((s) => s + points(open.r));
    }
    close(`${open.c}-${open.r}`);
  };

  const filled = board.cells.flatMap((col, c) => col.map((cell, r) => (cell.q.trim() ? `${c}-${r}` : null))).filter(Boolean);
  const done = filled.length > 0 && filled.every((k) => used.includes(k as string));
  const most = filled.reduce((s, k) => s + points(Number((k as string).split('-')[1])), 0);

  return (
    <div className="older-page">
      <GameHead
        first="Quiz"
        second="Board"
        sub={
          mode === 'solo'
            ? 'Pick a category and a value, type your answer in English and win the points!'
            : 'Pick a category and a value. Answer in English — in the chat or on the mic — to win the points!'
        }
      >
        {isMine && (
          <button type="button" className="btn btn-ghost" onClick={() => (playClick(), setEditing(!editing))}>
            {editing ? '▶ Play' : '✏️ Edit'}
          </button>
        )}
      </GameHead>

      <div className="memory-bar">
        <div className="memory-group" role="group" aria-label="Who is playing">
          <button type="button" className={`pack${mode === 'solo' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('solo'))}>
            🙋 Just me
          </button>
          <button type="button" className={`pack${mode === 'class' ? ' is-on' : ''}`} onClick={() => (playClick(), setMode('class'))}>
            👥 With my class
          </button>
        </div>
        <div className="memory-group" role="group" aria-label="Board">
          {boards.map((b) => (
            <button key={b.id} type="button" className={`pack${b.id === board.id ? ' is-on' : ''}`} onClick={() => choose(b.id)}>
              {b.emoji ?? '⭐'} {b.title || 'Untitled'}
            </button>
          ))}
          <button
            type="button"
            className="pack"
            onClick={() => {
              playClick();
              const b: Board = {
                id: `b-${Date.now().toString(36)}`,
                title: 'My board',
                categories: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
                cells: Array.from({ length: 4 }, () => Array.from({ length: 3 }, blankCell)),
              };
              setMine([...mine, b]);
              setBoardId(b.id);
              setUsed([]);
              setEditing(true);
            }}
          >
            ➕ New board
          </button>
        </div>
        {!editing && (
          <div className="memory-group">
            <button type="button" className="pack" onClick={() => (playClick(), setUsed([]), setScore(0))}>
              ↺ Play this board again
            </button>
          </div>
        )}
      </div>

      {!editing &&
        (mode === 'class' ? (
          <Teams teams={teams} setTeams={setTeams} step={100} />
        ) : (
          <p className="quiz-score">
            Your points: <b>{score}</b>
          </p>
        ))}

      {editing && isMine ? (
        <BoardEditor
          board={board}
          onChange={update}
          onDelete={() => {
            if (!window.confirm(`Delete the board "${board.title}"? This cannot be undone.`)) return;
            setMine(mine.filter((b) => b.id !== board.id));
            setBoardId(BUILT_IN[0].id);
            setEditing(false);
          }}
        />
      ) : (
        <div className="quiz-board" style={{ ['--cols' as string]: board.categories.length }}>
          {board.categories.map((name, c) => (
            <div key={`h${c}`} className="quiz-cat" style={{ gridColumn: c + 1, gridRow: 1 }}>
              {name}
            </div>
          ))}
          {board.cells.map((col, c) =>
            Array.from({ length: rows }, (_, r) => {
              const cell = col[r];
              const isUsed = used.includes(`${c}-${r}`);
              const empty = !cell?.q.trim();
              return (
                <button
                  key={`${c}-${r}`}
                  type="button"
                  className={`quiz-cell${isUsed ? ' is-used' : ''}${empty ? ' is-empty' : ''}`}
                  style={{ gridColumn: c + 1, gridRow: r + 2 }}
                  onClick={() => ask(c, r)}
                  disabled={isUsed || empty}
                >
                  {isUsed || empty ? '' : points(r)}
                </button>
              );
            }),
          )}
        </div>
      )}

      {done && !editing && (
        <p className="older-done">
          {mode === 'solo'
            ? `🎉 You finished the board with ${score} of ${most} points! ${score >= most * 0.7 ? 'Amazing!' : score >= most * 0.4 ? 'Great job!' : 'Good try — play again!'}`
            : '🎉 Every question has been asked! The winner is the team with the most points.'}
        </p>
      )}

      {open && (
        <div className="quiz-open" role="dialog" aria-label="Question">
          <div className="quiz-card">
            <p className="quiz-card-head">
              {board.categories[open.c]} · <b>{points(open.r)}</b>
            </p>
            <p className="quiz-q">{board.cells[open.c][open.r].q}</p>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => speak(board.cells[open.c][open.r].q, { force: true })}>
              🔈 Read it
            </button>
            {mode === 'solo' ? (
              !shown ? (
                <form className="quiz-answer" onSubmit={check}>
                  <input className="older-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer" autoFocus aria-label="Your answer" />
                  <button type="submit" className="btn btn-fun" disabled={!typed.trim()}>
                    Check
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => (playClick(), setVerdict('unsure'), setShown(true))}>
                    I don't know
                  </button>
                </form>
              ) : verdict === 'right' ? (
                <>
                  <p className="quiz-a">✓ Yes! {shownAnswer(board.cells[open.c][open.r].a)}</p>
                  <button type="button" className="btn btn-fun" onClick={() => close(`${open.c}-${open.r}`)}>
                    +{points(open.r)} · Next
                  </button>
                </>
              ) : (
                <>
                  <p className="quiz-a">The answer: {shownAnswer(board.cells[open.c][open.r].a) || '—'}</p>
                  <div className="quiz-award">
                    {typed.trim() && (
                      <button type="button" className="btn" style={{ background: 'var(--mint)' }} onClick={() => selfMark(true)}>
                        ✓ I had it right
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={() => selfMark(false)}>
                      Next time!
                    </button>
                  </div>
                </>
              )
            ) : shown ? (
              <>
                <p className="quiz-a">{shownAnswer(board.cells[open.c][open.r].a) || '—'}</p>
                <div className="quiz-award">
                  {teams.map((t, i) => (
                    <button key={i} type="button" className="btn" style={{ background: teamColor(i) }} onClick={() => award(i)}>
                      +{points(open.r)} {t.name}
                    </button>
                  ))}
                  <button type="button" className="btn btn-ghost" onClick={() => award(null)}>
                    Nobody
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn btn-fun" onClick={() => (playClick(), setShown(true))}>
                👀 Show the answer
              </button>
            )}
            <button type="button" className="quiz-close" aria-label="Close without using the question" onClick={() => setOpen(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Where Clara writes a board: its name, its categories, and each question with its answer. */
function BoardEditor({ board, onChange, onDelete }: { board: Board; onChange: (b: Board) => void; onDelete?: () => void }) {
  const rows = Math.max(...board.cells.map((c) => c.length));
  const setCell = (c: number, r: number, cell: Partial<Cell>) =>
    onChange({ ...board, cells: board.cells.map((col, i) => (i === c ? col.map((x, j) => (j === r ? { ...x, ...cell } : x)) : col)) });
  const setRows = (n: number) =>
    onChange({ ...board, cells: board.cells.map((col) => (col.length >= n ? col.slice(0, n) : [...col, ...Array.from({ length: n - col.length }, blankCell)])) });
  const setCols = (n: number) =>
    onChange({
      ...board,
      categories: n <= board.categories.length ? board.categories.slice(0, n) : [...board.categories, ...Array.from({ length: n - board.categories.length }, (_, i) => `Category ${board.categories.length + i + 1}`)],
      cells: n <= board.cells.length ? board.cells.slice(0, n) : [...board.cells, ...Array.from({ length: n - board.cells.length }, () => Array.from({ length: rows }, blankCell))],
    });

  return (
    <div className="older-edit">
      <div className="older-edit-row">
        <label className="older-label">
          Board name
          <input className="older-input" value={board.title} onChange={(e) => onChange({ ...board, title: e.target.value })} />
        </label>
        <label className="older-label">
          Categories
          <select className="older-input" value={board.categories.length} onChange={(e) => setCols(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="older-label">
          Questions in each
          <select className="older-input" value={rows} onChange={(e) => setRows(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {onDelete && (
          <button type="button" className="btn btn-danger btn-small" onClick={onDelete}>
            🗑 Delete board
          </button>
        )}
      </div>
      <p className="wheel-hint">Everything is saved on this computer as you type.</p>
      <div className="quiz-edit-cols">
        {board.categories.map((name, c) => (
          <div key={c} className="quiz-edit-col">
            <input
              className="older-input quiz-edit-cat"
              value={name}
              onChange={(e) => onChange({ ...board, categories: board.categories.map((x, i) => (i === c ? e.target.value : x)) })}
              aria-label={`Category ${c + 1}`}
            />
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="quiz-edit-cell">
                <span className="quiz-edit-pts">{points(r)}</span>
                <textarea
                  className="older-input"
                  rows={2}
                  placeholder="Question"
                  value={board.cells[c][r]?.q ?? ''}
                  onChange={(e) => setCell(c, r, { q: e.target.value })}
                />
                <input className="older-input" placeholder="Answer" value={board.cells[c][r]?.a ?? ''} onChange={(e) => setCell(c, r, { a: e.target.value })} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

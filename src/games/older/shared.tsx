import { useEffect, useRef, useState } from 'react';
import { playClick, playTick } from '../../lib/sounds';

/**
 * What the games for the older students (11 and up) share: a value kept on the teacher's
 * computer, the teams and their points, and a countdown.
 */

/** A value kept on this computer between lessons, like the wheel's class list. */
export function useStored<T>(key: string, initial: T, valid: (v: unknown) => v is T = (_v): _v is T => true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        if (valid(v)) return v;
      }
    } catch {
      /* a blocked or full storage: the game starts from its own content */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not being able to remember is not worth interrupting the lesson */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export interface Team {
  name: string;
  score: number;
}

const TEAM_COLORS = ['#2EC4A6', '#FF6B4A', '#FFC23D', '#B69CE0', '#7FD8C6', '#FF9E7D', '#FFD97A', '#9B7CC9'];
/** Online, each student can play for themselves: up to 8 teams or players. */
export const MAX_TEAMS = 8;
export const teamColor = (i: number) => TEAM_COLORS[i % TEAM_COLORS.length];

export const defaultTeams = (n = 2): Team[] => Array.from({ length: n }, (_, i) => ({ name: `Team ${i + 1}`, score: 0 }));

export const isTeams = (v: unknown): v is Team[] =>
  Array.isArray(v) && v.length >= 2 && v.length <= MAX_TEAMS && v.every((t) => t && typeof t.name === 'string' && Number.isFinite(t.score));

/**
 * The teams along the top of a game: their names (the teacher can rename them), their points
 * with + and − (by `step`) to put a mistake right, and 2 to 8 of them (teams, or each student on their own). `turn` marks whose go it is.
 */
export function Teams({ teams, setTeams, turn, step = 1 }: { teams: Team[]; setTeams: (t: Team[]) => void; turn?: number; step?: number }) {
  const change = (i: number, t: Partial<Team>) => setTeams(teams.map((x, j) => (j === i ? { ...x, ...t } : x)));
  return (
    <div className="teams" role="group" aria-label="Teams">
      {teams.map((t, i) => (
        <div key={i} className={`team${turn === i ? ' is-turn' : ''}`} style={{ ['--team' as string]: teamColor(i) }}>
          <input className="team-name" value={t.name} onChange={(e) => change(i, { name: e.target.value })} aria-label={`Name of team ${i + 1}`} />
          <div className="team-score">
            <button type="button" className="team-step" onClick={() => change(i, { score: t.score - step })} aria-label={`Take a point from ${t.name}`}>
              −
            </button>
            <span className="team-points">{t.score}</span>
            <button type="button" className="team-step" onClick={() => change(i, { score: t.score + step })} aria-label={`Give a point to ${t.name}`}>
              +
            </button>
          </div>
        </div>
      ))}
      <div className="teams-tools">
        {teams.length < MAX_TEAMS && (
          <button
            type="button"
            className="pack"
            title="Add a team, or a student playing on their own (click a name to change it)"
            onClick={() => (playClick(), setTeams([...teams, ...defaultTeams(teams.length + 1).slice(teams.length)]))}
          >
            + Add
          </button>
        )}
        {teams.length > 2 && (
          <button type="button" className="pack" title="Take away the last one" onClick={() => (playClick(), setTeams(teams.slice(0, -1)))}>
            − Remove
          </button>
        )}
        <button type="button" className="pack" onClick={() => (playClick(), setTeams(teams.map((t) => ({ ...t, score: 0 }))))}>
          ↺ Scores
        </button>
      </div>
    </div>
  );
}

/**
 * A countdown of `seconds`: `start` sets it going from the top, `stop` stops it. It ticks in
 * the last five seconds and calls `onEnd` once at zero.
 */
export function useCountdown(seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const from = left;
    let last = from;
    const id = window.setInterval(() => {
      const now = Math.max(0, from - Math.floor((performance.now() - started) / 1000));
      if (now === last) return;
      last = now;
      setLeft(now);
      if (now > 0 && now <= 5) playTick();
      if (now === 0) {
        window.clearInterval(id);
        setRunning(false);
        end.current();
      }
    }, 100);
    return () => window.clearInterval(id);
    // (started again only when it is started or stopped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return {
    left,
    running,
    start: () => {
      setLeft(seconds);
      setRunning(true);
    },
    stop: () => setRunning(false),
    reset: () => {
      setRunning(false);
      setLeft(seconds);
    },
  };
}

/** A clock face for a countdown: big, and red in its last seconds. */
export function Clock({ left, total }: { left: number; total: number }) {
  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <div className={`clock${left <= 5 && left > 0 ? ' is-low' : ''}${left === 0 ? ' is-out' : ''}`} style={{ ['--done' as string]: `${(1 - left / total) * 360}deg` }}>
      <span>{m > 0 ? `${m}:${String(s).padStart(2, '0')}` : s}</span>
    </div>
  );
}

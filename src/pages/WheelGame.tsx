import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { speak } from '../lib/speech';
import { playClick, playShuffle, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

const STORE = 'funny-games:wheel-names';

const SLICE_COLORS = ['#4FC3FF', '#FF8FC8', '#FFD93D', '#8BD43B', '#A77BFF', '#FF9E4A', '#4FE0C0', '#FF6B78'];

const SAMPLE = ['Ana', 'Beatriz', 'Caio', 'Davi', 'Elisa', 'Felipe', 'Giovana', 'Heitor'];

/** How long one spin lasts, in milliseconds. */
const SPIN_MS = 4200;

function readNames(): string[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list.filter((n) => typeof n === 'string');
    }
  } catch {
    /* a blocked or full storage just means we start from the sample */
  }
  return SAMPLE;
}

/** Point on the wheel, with 0° at the top and angles running clockwise. */
function rim(angle: number, r: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

/** Fast at first, drifting to a stop. */
function ease(t: number) {
  return 1 - Math.pow(1 - t, 3.2);
}

/**
 * The name wheel.
 *
 * Clara spins one in class to choose who answers, because on some days nobody
 * volunteers. She kept it on another site where free accounts hold only three
 * activities; this one is hers and remembers her class between lessons.
 *
 * The names stay upright while the wheel turns — they are placed at a point on the rim
 * rather than rotated with their slice, so none of them ends up upside down — and a
 * name that has had its turn only leaves the wheel on the next spin, so there is time
 * to read it.
 */
export default function WheelGame() {
  const [names, setNames] = useState<string[]>(readNames);
  const [text, setText] = useState(() => readNames().join('\n'));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [removeWinner, setRemoveWinner] = useState(false);
  const frame = useRef<number | undefined>(undefined);
  /** The name that leaves the wheel when the next spin starts. */
  const spent = useRef<string | null>(null);

  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(names));
    } catch {
      /* not being able to remember the list is not worth interrupting the lesson */
    }
  }, [names]);

  const applyText = (value: string) => {
    setText(value);
    const list = value
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    setNames(list);
    setWinner(null);
    spent.current = null;
  };

  const slices = useMemo(() => {
    const n = Math.max(names.length, 1);
    const step = 360 / n;
    return names.map((name, i) => {
      const from = i * step;
      const [x1, y1] = rim(from, 48);
      const [x2, y2] = rim(from + step, 48);
      const large = step > 180 ? 1 : 0;
      return {
        name,
        mid: from + step / 2,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
        d: `M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A48,48 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
      };
    });
  }, [names]);

  const spin = () => {
    if (spinning || names.length < 2) return;

    // the winner of the last spin has been on screen all this time; it goes now
    let list = names;
    if (spent.current) {
      list = names.filter((n) => n !== spent.current);
      spent.current = null;
      if (list.length !== names.length) {
        setNames(list);
        setText(list.join('\n'));
      }
      if (list.length < 2) {
        setWinner(null);
        return;
      }
    }

    playShuffle();
    setWinner(null);
    setSpinning(true);

    const pick = Math.floor(Math.random() * list.length);
    const step = 360 / list.length;
    const middle = pick * step + step / 2;
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const from = angle;
    const to = from + 360 * 5 + ((360 - ((from + middle + jitter) % 360)) % 360);

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / SPIN_MS);
      setAngle(from + (to - from) * ease(t));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      setSpinning(false);
      setWinner(list[pick]);
      if (removeWinner) spent.current = list[pick];
      playTada();
      burstConfetti(90);
      speak(list[pick]);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const fontSize = Math.max(3.2, Math.min(5.6, 40 / Math.max(names.length, 4)));

  return (
    <div className="wheel-page">
      <div className="memory-head">
        <div>
          <h1 className="memory-title">
            <span className="t-cream">Spin the</span> <span className="t-yellow">Wheel</span>
          </h1>
          <p className="memory-sub">Whose turn is it? Give it a spin and find out!</p>
        </div>
        <Link to="/" className="btn" onClick={() => playClick()}>
          🏠 Games
        </Link>
      </div>

      <div className="wheel-layout">
        <div className="wheel-stage">
          <div className="wheel-pin" aria-hidden>
            ▼
          </div>
          <svg className="wheel-svg" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="49" fill="#fff" stroke="#0B1B3B" strokeWidth="2" />
            <g transform={`rotate(${angle} 50 50)`}>
              {slices.map((s) => (
                <path key={s.name + s.mid} d={s.d} fill={s.color} stroke="#0B1B3B" strokeWidth="0.8" />
              ))}
            </g>
            {/* the names ride round with their slice but never turn over */}
            {slices.map((s) => {
              const [x, y] = rim(s.mid + angle, 30);
              return (
                <text
                  key={`t-${s.name}-${s.mid}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight="800"
                  fill="#0B1B3B"
                  stroke="#fff"
                  strokeWidth="0.9"
                  paintOrder="stroke"
                >
                  {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                </text>
              );
            })}
            <circle cx="50" cy="50" r="6" fill="#fff" stroke="#0B1B3B" strokeWidth="2" />
          </svg>

          <button type="button" className="btn btn-fun wheel-spin" onClick={spin} disabled={spinning || names.length < 2}>
            {spinning ? 'Spinning…' : '🎡 Spin!'}
          </button>

          <p className="wheel-winner" role="status">
            {winner ? `🎉 ${winner}!` : names.length < 2 ? 'Add at least two names' : ' '}
          </p>
        </div>

        <div className="wheel-side">
          <label className="wheel-label" htmlFor="wheel-names">
            Names — one per line
          </label>
          <textarea
            id="wheel-names"
            className="wheel-names"
            value={text}
            onChange={(e) => applyText(e.target.value)}
            rows={12}
            spellCheck={false}
          />
          <label className="wheel-check">
            <input type="checkbox" checked={removeWinner} onChange={(e) => setRemoveWinner(e.target.checked)} />
            Take the name off the wheel after it wins
          </label>
          {removeWinner && spent.current && <p className="wheel-hint">{spent.current} leaves the wheel on the next spin.</p>}
          <p className="wheel-hint">Your class is saved on this computer, so it is here again next lesson.</p>
        </div>
      </div>
    </div>
  );
}

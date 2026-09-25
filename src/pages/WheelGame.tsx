import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { speak } from '../lib/speech';
import { playClick, playShuffle, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

const STORE = 'funny-games:wheel-names';

const SLICE_COLORS = ['#4FC3FF', '#FF8FC8', '#FFD93D', '#8BD43B', '#A77BFF', '#FF9E4A', '#4FE0C0', '#FF6B78'];

const SAMPLE = ['Ana', 'Beatriz', 'Caio', 'Davi', 'Elisa', 'Felipe', 'Giovana', 'Heitor'];

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

/** Point on the wheel's rim, with 0° at the top and angles running clockwise. */
function rim(angle: number, r: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

/**
 * The name wheel.
 *
 * Clara spins one in class to choose who answers, because on some days nobody
 * volunteers. She kept it on another site where free accounts hold only three
 * activities; this one is hers, remembers her class between lessons and can drop each
 * name as it comes up, so everybody gets a turn.
 */
export default function WheelGame() {
  const [names, setNames] = useState<string[]>(readNames);
  const [text, setText] = useState(() => readNames().join('\n'));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [removeWinner, setRemoveWinner] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

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
  };

  const slices = useMemo(() => {
    const n = Math.max(names.length, 1);
    const step = 360 / n;
    return names.map((name, i) => {
      const from = i * step;
      const to = from + step;
      const [x1, y1] = rim(from, 48);
      const [x2, y2] = rim(to, 48);
      const large = step > 180 ? 1 : 0;
      return {
        name,
        from,
        to,
        mid: from + step / 2,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
        d: `M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A48,48 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
      };
    });
  }, [names]);

  const spin = () => {
    if (spinning || names.length < 2) return;
    playShuffle();
    setWinner(null);
    setSpinning(true);
    // land on a random name: five whole turns plus wherever that name sits
    const pick = Math.floor(Math.random() * names.length);
    const step = 360 / names.length;
    const middle = pick * step + step / 2;
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const target = angle + 360 * 5 + ((360 - ((angle + middle + jitter) % 360)) % 360);
    setAngle(target);
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setWinner(names[pick]);
      playTada();
      burstConfetti(90);
      speak(names[pick]);
      if (removeWinner) {
        const left = names.filter((_, i) => i !== pick);
        setNames(left);
        setText(left.join('\n'));
      }
    }, 4200);
  };

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
          <svg
            className="wheel-svg"
            viewBox="0 0 100 100"
            style={{ transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.16, 0.9, 0.2, 1)' : 'none' }}
            aria-hidden
          >
            <circle cx="50" cy="50" r="49" fill="#fff" stroke="#0B1B3B" strokeWidth="2" />
            {slices.map((s) => (
              <g key={s.name + s.from}>
                <path d={s.d} fill={s.color} stroke="#0B1B3B" strokeWidth="0.8" />
                <text
                  x="50"
                  y="50"
                  // a name on the lower half of the wheel would otherwise read upside down
                  transform={`rotate(${s.mid} 50 50) translate(0 -30)${s.mid > 95 && s.mid < 265 ? ' rotate(180 50 50)' : ''}`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(3, Math.min(6, 44 / Math.max(names.length, 4)))}
                  fontWeight="800"
                  fill="#0B1B3B"
                >
                  {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                </text>
              </g>
            ))}
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
          <p className="wheel-hint">Your class is saved on this computer, so it is here again next lesson.</p>
        </div>
      </div>
    </div>
  );
}

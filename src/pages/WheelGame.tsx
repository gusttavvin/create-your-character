import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { speak } from '../lib/speech';
import { playClick, playShuffle, playTada } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';

const STORE = 'funny-games:wheel-names';
/** Where she moved the wheel to on the page. */
const PLACE = 'funny-games:wheel-place';

/**
 * A little window of its own that stays on top of everything on the screen (Chrome and Edge):
 * Clara sometimes shares only part of her screen with the class, and wants the wheel there.
 */
interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}
const pipApi = () => (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** Where the wheel may go up to: the bottom of the site's bar (sticky at the top of the screen). */
function barBottom() {
  // (and a little room, for the wheel's pointer, which stands above it)
  return (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) + 10;
}

function readPlace(): { x: number; y: number } {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE) ?? 'null');
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y };
  } catch {
    /* a blocked storage: the wheel starts where it always was */
  }
  return { x: 0, y: 0 };
}

const SLICE_COLORS = ['#2EC4A6', '#FF6B4A', '#FFC23D', '#B69CE0', '#7FD8C6', '#FF9E7D', '#FFD97A', '#9B7CC9'];

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
  /** Where the wheel has been dragged to, from its own place on the page. */
  const [place, setPlace] = useState(readPlace);
  const drag = useRef<{ id: number; x: number; y: number; from: { x: number; y: number }; box: DOMRect } | null>(null);
  /** The little window the wheel is popped out into, if it is. */
  const [pip, setPip] = useState<Window | null>(null);
  const pipRef = useRef<Window | null>(null);
  pipRef.current = pip;
  const [noPip, setNoPip] = useState(false);

  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);
  // (the little window closes with the page)
  useEffect(() => () => pipRef.current?.close(), []);

  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLAnchorElement>(null);
  // a wheel left under the site's bar (moved there before it was kept below it) comes down to
  // just under it when the page opens, at the top of the page
  useLayoutEffect(() => {
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    // (where its top is with no move down, so running twice moves it no further)
    const base = stage.top + window.scrollY - place.y;
    const bar = barBottom();
    setPlace((p) => (base + p.y < bar - 1 ? { x: p.x, y: bar - base } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Whether the wheel lies over the title, or over the Games button: those are hidden then. */
  const [covers, setCovers] = useState({ title: false, home: false });
  useLayoutEffect(() => {
    const check = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const over = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return !!(stage && r && !pip && stage.left < r.right && stage.right > r.left && stage.top < r.bottom && stage.bottom > r.top);
      };
      const next = { title: over(titleRef.current), home: over(homeRef.current) };
      setCovers((c) => (c.title === next.title && c.home === next.home ? c : next));
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('scroll', check, true);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('scroll', check, true);
    };
  }, [place, pip, names.length]);

  const startDrag = (e: ReactPointerEvent<Element>) => {
    const stage = e.currentTarget.closest('.wheel-stage') as HTMLElement | null;
    if (!stage) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* (a pointer the browser does not know, as in a test: dragged all the same) */
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: place, box: stage.getBoundingClientRect() };
  };
  const moveDrag = (e: ReactPointerEvent<Element>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // (kept on the screen, at least a corner of it, and its top below the site's bar, so it can
    // always be caught again: moved up under the bar, its Move button was hidden and it was stuck)
    const dx = Math.max(-d.box.right + 80, Math.min(window.innerWidth - d.box.left - 80, e.clientX - d.x));
    const dy = Math.max(barBottom() - d.box.top, Math.min(window.innerHeight - d.box.top - 60, e.clientY - d.y));
    setPlace({ x: d.from.x + dx, y: d.from.y + dy });
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    try {
      localStorage.setItem(PLACE, JSON.stringify(place));
    } catch {
      /* it is only where the wheel was left */
    }
  };
  const putBack = () => {
    playClick();
    setPlace({ x: 0, y: 0 });
    try {
      localStorage.removeItem(PLACE);
    } catch {
      /* nothing to forget */
    }
  };

  const popOut = async () => {
    const api = pipApi();
    if (!api || pip) return;
    playClick();
    let win: Window;
    try {
      win = await api.requestWindow({ width: 460, height: 600 });
    } catch {
      // (some browsers, and pages inside other apps, cannot open one)
      setNoPip(true);
      return;
    }
    // the page's look, copied into the little window
    for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style')) win.document.head.appendChild(node.cloneNode(true));
    win.document.title = 'Spin the Wheel';
    win.document.body.className = 'wheel-pip-body';
    win.addEventListener('pagehide', () => {
      // (closed while spinning: the spin stops there, so the wheel can be spun again)
      win.cancelAnimationFrame(frame.current ?? 0);
      setSpinning(false);
      setPip(null);
    });
    setPip(win);
  };

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

    // (timed by the window the wheel is in: popped out, the page itself may be hidden behind what
    // Clara is sharing, and a hidden page's frames stop, so the wheel would not have turned)
    const win = pipRef.current ?? window;
    const started = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / SPIN_MS);
      setAngle(from + (to - from) * ease(t));
      if (t < 1) {
        frame.current = win.requestAnimationFrame(tick);
        return;
      }
      setSpinning(false);
      setWinner(list[pick]);
      if (removeWinner) spent.current = list[pick];
      playTada();
      burstConfetti(90, pipRef.current ?? undefined);
      speak(list[pick]);
    };
    frame.current = win.requestAnimationFrame(tick);
  };

  const fontSize = Math.max(3.2, Math.min(5.6, 40 / Math.max(names.length, 4)));

  const moved = place.x !== 0 || place.y !== 0;
  const stage = (
    <div
      ref={pip ? undefined : stageRef}
      className={`wheel-stage${pip ? ' is-popped' : ''}${moved && !pip ? ' is-moved' : ''}`}
      style={pip ? undefined : { translate: `${place.x}px ${place.y}px` }}
    >
      <div className="wheel-pin" aria-hidden>
        ▼
      </div>
      <svg
        className={`wheel-svg${pip ? '' : ' is-draggable'}`}
        viewBox="0 0 100 100"
        aria-hidden
        {...(pip ? {} : { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag })}
      >
        <circle cx="50" cy="50" r="49" fill="#fff" stroke="#3B1E54" strokeWidth="2" />
        <g transform={`rotate(${angle} 50 50)`}>
          {slices.map((s) => (
            <path key={s.name + s.mid} d={s.d} fill={s.color} stroke="#3B1E54" strokeWidth="0.8" />
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
              fill="#3B1E54"
              stroke="#fff"
              strokeWidth="0.9"
              paintOrder="stroke"
            >
              {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
            </text>
          );
        })}
        <circle cx="50" cy="50" r="6" fill="#fff" stroke="#3B1E54" strokeWidth="2" />
      </svg>

      <button type="button" className="btn btn-fun wheel-spin" onClick={spin} disabled={spinning || names.length < 2}>
        {spinning ? 'Spinning…' : '🎡 Spin!'}
      </button>
      {/* (under the Spin button, Clara asked) */}
      {!pip && (
        <div className="wheel-tools">
          <span
            className="wheel-handle"
            title="Drag the wheel anywhere on the page"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            ✥ Move
          </span>
          {moved && (
            <button type="button" className="wheel-tool" onClick={putBack}>
              ↺ Put back
            </button>
          )}
          {pipApi() && !noPip && (
            <button type="button" className="wheel-tool" onClick={popOut} title="A little window you can put anywhere on the screen">
              🪟 Pop out
            </button>
          )}
        </div>
      )}
      {noPip && !pip && <p className="wheel-hint">This browser cannot open the wheel in its own window: drag it with ✥ Move.</p>}

      <p className="wheel-winner" role="status">
        {winner ? `🎉 ${winner}!` : names.length < 2 ? 'Add at least two names' : ' '}
      </p>
    </div>
  );

  return (
    <div className="wheel-page">
      <div className="memory-head">
        {/* (hidden while the wheel is moved over it) */}
        <div ref={titleRef} className={covers.title ? 'is-covered' : undefined}>
          <h1 className="memory-title">
            <span className="t-cream">Spin the</span> <span className="t-yellow">Wheel</span>
          </h1>
          <p className="memory-sub">Whose turn is it? Give it a spin and find out!</p>
        </div>
        <Link ref={homeRef} to="/" className={`btn${covers.home ? ' is-covered' : ''}`} onClick={() => playClick()}>
          🏠 Games
        </Link>
      </div>

      <div className="wheel-layout">
        {pip ? (
          <div className="wheel-stage wheel-away">
            <p>🪟 The wheel is in its own little window.</p>
            <button type="button" className="btn" onClick={() => pip.close()}>
              ↩ Bring it back here
            </button>
          </div>
        ) : (
          stage
        )}
        {pip && createPortal(stage, pip.document.body)}

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

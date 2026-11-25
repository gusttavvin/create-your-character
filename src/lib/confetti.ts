/** Minimal confetti burst rendered on a full-screen canvas. */

// (the site's own colours: coral, sun, mint, lilac, and a peach and a light mint)
const COLORS = ['#FF6B4A', '#FFC23D', '#2EC4A6', '#B69CE0', '#FF9E7D', '#7FD8C6', '#3B1E54'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

/** `win`: the window it bursts in (the wheel can be popped out into a little window of its own). */
export function burstConfetti(count = 140, win?: Window) {
  if (typeof globalThis.document === 'undefined') return;
  const window = win ?? globalThis.window;
  const document = window.document;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pieces: Piece[] = [];
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 9;
    pieces.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 8 + Math.random() * 8,
      h: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      life: 1,
    });
  }

  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of pieces) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (frame > 60) p.life -= 0.02;
      if (p.life <= 0 || p.y > canvas.height + 20) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive > 0 && frame < 240) window.requestAnimationFrame(tick);
    else canvas.remove();
  };
  window.requestAnimationFrame(tick);
}

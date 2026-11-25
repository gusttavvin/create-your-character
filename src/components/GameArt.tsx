import type { ReactNode } from 'react';

/**
 * A game's cover on the home page: the thing the game is played with, drawn in the site's own
 * colours and plum outline (the covers were emoji, the same as on any other site; the
 * characters beside them Clara did not want).
 */
const INK = 'var(--ink)';
const W = 4;

function Thing({ children }: { children: ReactNode }) {
  return (
    <svg className="game-art-thing" viewBox="0 0 120 120" aria-hidden>
      <g stroke={INK} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

const STAR = 'M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z';

const THINGS: Record<string, ReactNode> = {
  // two memory cards: one face down, one turned over
  memory: (
    <Thing>
      <rect x="14" y="26" width="52" height="70" rx="10" fill="var(--coral)" transform="rotate(-12 40 61)" />
      <path d={STAR} transform="translate(40 61) rotate(-12) scale(1.5)" fill="var(--sun)" strokeWidth={2.5} />
      <rect x="54" y="22" width="52" height="70" rx="10" fill="#fff" transform="rotate(9 80 57)" />
      <text x="80" y="66" transform="rotate(9 80 57)" textAnchor="middle" fontFamily="Grandstander" fontWeight="700" fontSize="30" fill={INK} stroke="none">
        A
      </text>
    </Thing>
  ),
  // the wheel, with its pointer
  wheel: (
    <Thing>
      {['var(--coral)', 'var(--sun)', 'var(--mint)', '#b69ce0', 'var(--coral)', 'var(--sun)'].map((c, i) => {
        const a = (i * 60 * Math.PI) / 180;
        const b = ((i + 1) * 60 * Math.PI) / 180;
        return <path key={i} d={`M60 64 L${60 + 44 * Math.sin(a)} ${64 - 44 * Math.cos(a)} A44 44 0 0 1 ${60 + 44 * Math.sin(b)} ${64 - 44 * Math.cos(b)} Z`} fill={c} />;
      })}
      <circle cx="60" cy="64" r="9" fill="#fff" />
      <path d="M52 10 L68 10 L60 24 Z" fill={INK} />
    </Thing>
  ),
  // a trophy with a star on it
  quiz: (
    <Thing>
      <path d="M38 22 H82 V46 C82 62 72 72 60 72 C48 72 38 62 38 46 Z" fill="var(--sun)" />
      <path d="M38 30 C24 30 24 52 42 56 M82 30 C96 30 96 52 78 56" fill="none" />
      <path d="M54 72 H66 V86 H54 Z" fill="var(--sun)" />
      <rect x="40" y="86" width="40" height="14" rx="4" fill="var(--coral)" />
      <path d={STAR} transform="translate(60 44) scale(1.3)" fill="#fff" strokeWidth={2.5} />
    </Thing>
  ),
  // a speech bubble, its mouth zipped
  'dont-say-it': (
    <Thing>
      <path d="M18 30 C18 20 26 14 36 14 H84 C94 14 102 20 102 30 V66 C102 76 94 82 84 82 H50 L32 100 L36 82 C26 82 18 76 18 66 Z" fill="var(--mint)" />
      <path d="M38 48 H82" strokeWidth={5} />
      {[44, 52, 60, 68, 76].map((x) => (
        <path key={x} d={`M${x} 42 V54`} strokeWidth={3} />
      ))}
      <circle cx="86" cy="48" r="5" fill="var(--sun)" />
    </Thing>
  ),
  // letter tiles: right, near and out
  'mystery-word': (
    <Thing>
      {[
        ['#6ac04a', 'W', -6],
        ['var(--sun)', 'O', 4],
        ['#b8a9c9', 'R', -3],
      ].map(([c, l, r], i) => (
        <g key={i} transform={`translate(${10 + i * 36} ${34 + (i % 2) * 10}) rotate(${r} 16 16)`}>
          <rect width="32" height="32" rx="6" fill={c as string} />
          <text x="16" y="24" textAnchor="middle" fontFamily="Grandstander" fontWeight="700" fontSize="22" fill={i === 1 ? INK : '#fff'} stroke="none">
            {l}
          </text>
        </g>
      ))}
      <path d="M30 92 Q60 82 90 92" fill="none" stroke="var(--coral)" strokeWidth={5} />
    </Thing>
  ),
  // two choices, and "or" between them
  'would-you-rather': (
    <Thing>
      <rect x="10" y="26" width="48" height="62" rx="12" fill="var(--mint)" transform="rotate(-6 34 57)" />
      <rect x="62" y="26" width="48" height="62" rx="12" fill="var(--coral)" transform="rotate(6 86 57)" />
      <circle cx="60" cy="58" r="16" fill="var(--sun)" />
      <text x="60" y="64" textAnchor="middle" fontFamily="Grandstander" fontWeight="700" fontSize="16" fill={INK} stroke="none">
        or
      </text>
    </Thing>
  ),
};

/** A game's cover: the drawing of what it is played with. */
export default function GameArt({ id }: { id: string }) {
  return <>{THINGS[id]}</>;
}

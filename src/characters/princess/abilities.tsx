import type { ReactNode } from 'react';

/**
 * The princess's abilities, drawn and moving round her (Clara's ideas): birds flying round her
 * (she talks to animals), snow falling with sparkles, a planet, a moon and stars going round
 * her (space), and flowers opening round her.
 *
 * Everything is drawn on the 1024 by 1536 canvas of her pictures and moves with SVG's own
 * animation, so it scales with her. What goes round her is drawn twice: once behind her and
 * once in front, the front one showing only the near half of the way round (below CY), so
 * whatever is on the far side passes behind her.
 */
const INK = '#3B2314';
/** The way round her: an ellipse about her middle, wider than she is. */
export const CX = 512;
export const CY = 640;
export const RX = 480;
export const RY = 450;
/** From her left, over her head, down her right and back under her skirt. */
const ORBIT = `M${CX - RX} ${CY} A${RX} ${RY} 0 1 1 ${CX + RX} ${CY} A${RX} ${RY} 0 1 1 ${CX - RX} ${CY}`;
/** Where on the way round a thing is at a moment, for a still picture: 0 to 1. */
function orbitAt(t: number): [number, number] {
  const a = Math.PI + 2 * Math.PI * t;
  return [CX + RX * Math.cos(a), CY + RY * Math.sin(a)];
}

/* ------------------------------------------------------------------ the drawings */
export function Bird({ body, wing, animate, flap = 0 }: { body: string; wing: string; animate: boolean; flap?: number }) {
  return (
    <g>
      <path d="M-26 -4 L-50 -16 L-45 2 L-52 14 L-26 9 Z" fill={wing} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={0} cy={0} rx={32} ry={26} fill={body} stroke={INK} strokeWidth={4.5} />
      <ellipse cx={6} cy={9} rx={19} ry={12} fill="#FFF3D6" />
      <path d="M29 -3 L46 2 L29 9 Z" fill="#FFB547" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <circle cx={15} cy={-7} r={4.6} fill={INK} />
      <circle cx={16.5} cy={-8.5} r={1.6} fill="#fff" />
      <circle cx={11} cy={4} r={4.5} fill="#FF9DB0" opacity={0.75} />
      <g transform={flap ? `rotate(${flap} -6 -4)` : undefined}>
        <path d="M-8 -4 Q-24 -40 10 -30 Q12 -14 -8 -4 Z" fill={wing} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        {animate && <animateTransform attributeName="transform" type="rotate" values="0 -6 -4;-38 -6 -4;0 -6 -4" dur="0.32s" repeatCount="indefinite" />}
      </g>
    </g>
  );
}

const sparklePath = (s: number) =>
  `M0 ${-s} L${s * 0.24} ${-s * 0.24} L${s} 0 L${s * 0.24} ${s * 0.24} L0 ${s} L${-s * 0.24} ${s * 0.24} L${-s} 0 L${-s * 0.24} ${-s * 0.24} Z`;
export function Sparkle({ s, colour = '#FFE27A', animate, delay = 0 }: { s: number; colour?: string; animate: boolean; delay?: number }) {
  return (
    <path d={sparklePath(s)} fill={colour} stroke="#E0A93A" strokeWidth={3} strokeLinejoin="round">
      {animate && (
        <animateTransform attributeName="transform" type="scale" values="0.3;1.1;0.3" dur="1.6s" begin={`${-delay}s`} repeatCount="indefinite" />
      )}
    </path>
  );
}

export function Snowflake({ s }: { s: number }) {
  const arms = [0, 60, 120].map((a) => {
    const c = Math.cos((a * Math.PI) / 180) * s, d = Math.sin((a * Math.PI) / 180) * s;
    return `M${-c} ${-d} L${c} ${d}`;
  });
  const twigs = [0, 60, 120, 180, 240, 300].map((a) => {
    const r = (a * Math.PI) / 180, px = Math.cos(r) * s * 0.6, py = Math.sin(r) * s * 0.6;
    const t = s * 0.28;
    return `M${px} ${py} L${px + Math.cos(r + 0.7) * t} ${py + Math.sin(r + 0.7) * t} M${px} ${py} L${px + Math.cos(r - 0.7) * t} ${py + Math.sin(r - 0.7) * t}`;
  });
  const d = [...arms, ...twigs].join(' ');
  return (
    <g>
      <path d={d} fill="none" stroke="#3E7FD6" strokeWidth={s * 0.2 + 5} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={s * 0.2} strokeLinecap="round" />
    </g>
  );
}

export function Planet() {
  return (
    <g>
      <path d="M-82 6 A82 22 0 0 1 82 -6" transform="rotate(-14)" fill="none" stroke={INK} strokeWidth={17} />
      <path d="M-82 6 A82 22 0 0 1 82 -6" transform="rotate(-14)" fill="none" stroke="#FFD54A" strokeWidth={9} />
      <circle r={48} fill="#9B7BFF" stroke={INK} strokeWidth={5} />
      <path d="M-40 -14 Q0 -4 42 -18" fill="none" stroke="#7E5CF0" strokeWidth={9} strokeLinecap="round" />
      <path d="M-36 16 Q4 26 38 12" fill="none" stroke="#7E5CF0" strokeWidth={8} strokeLinecap="round" />
      <circle cx={-18} cy={-26} r={9} fill="#C9B8FF" />
      <path d="M-82 6 A82 22 0 0 0 82 -6" transform="rotate(-14)" fill="none" stroke={INK} strokeWidth={17} />
      <path d="M-82 6 A82 22 0 0 0 82 -6" transform="rotate(-14)" fill="none" stroke="#FFD54A" strokeWidth={9} />
    </g>
  );
}
export function Moon() {
  return (
    <g>
      <path d="M14 -50 A52 52 0 1 0 14 50 A40 40 0 1 1 14 -50 Z" fill="#FFE27A" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <circle cx={-18} cy={-8} r={6} fill="#F5C842" />
      <circle cx={-12} cy={18} r={4} fill="#F5C842" />
    </g>
  );
}

export function FlowerStem() {
  return (
    <g>
      <path d="M0 0 Q-6 50 4 92" fill="none" stroke="#5DAE45" strokeWidth={7} strokeLinecap="round" />
      <path d="M2 60 Q28 44 40 58 Q26 74 2 60 Z" fill="#7CCB5B" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
}

const petalsOf = (petal: string) =>
  [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180;
    return <ellipse key={a} cx={Math.cos(r) * 26} cy={Math.sin(r) * 26} rx={22} ry={22} fill={petal} stroke={INK} strokeWidth={4.5} />;
  });

export function FlowerBlossom({ petal, inner }: { petal: string; inner: string }) {
  return (
    <g>
      {petalsOf(petal)}
      <circle r={17} fill={inner} stroke={INK} strokeWidth={4.5} />
      <circle cx={-5} cy={-5} r={5} fill="#FFF3B0" />
    </g>
  );
}

function Flower({ petal, inner, animate, delay }: { petal: string; inner: string; animate: boolean; delay: number }) {
  const petals = petalsOf(petal);
  return (
    <g>
      <FlowerStem />
      {/* it opens: its petals grow out of the bud, stay open, and close again */}
      <g>
        {petals}
        {animate && (
          <animateTransform attributeName="transform" type="scale" values="0.15;1;1;0.15" keyTimes="0;0.3;0.8;1" dur="4s" begin={`${-delay}s`} repeatCount="indefinite" />
        )}
      </g>
      <circle r={17} fill={inner} stroke={INK} strokeWidth={4.5} />
      <circle cx={-5} cy={-5} r={5} fill="#FFF3B0" />
    </g>
  );
}

/* ------------------------------------------------------------------ round her */
/**
 * A thing going round her: along the ellipse, smaller on the far side, and (for a bird)
 * facing the way it flies.
 */
function Orbiter({ dur, at, animate, flip = false, children }: { dur: number; at: number; animate: boolean; flip?: boolean; children: ReactNode }) {
  if (!animate) {
    const [x, y] = orbitAt(at);
    const k = 0.95 + 0.2 * Math.sin(Math.PI + Math.PI * 2 * at);
    const facing = flip && at % 1 > 0.5 ? -1 : 1;
    return <g transform={`translate(${x} ${y}) scale(${facing * k} ${k})`}>{children}</g>;
  }
  const begin = `${-at * dur}s`;
  return (
    <g>
      <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite" path={ORBIT} />
      <g>
        <animateTransform attributeName="transform" type="scale" values="0.95;0.75;0.95;1.15;0.95" keyTimes="0;0.25;0.5;0.75;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
        <g>
          {flip && <animateTransform attributeName="transform" type="scale" values="1 1;-1 1" keyTimes="0;0.5" calcMode="discrete" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />}
          {children}
        </g>
      </g>
    </g>
  );
}

export const BIRDS = [
  { body: '#6EC6FF', wing: '#3E9EE6', at: 0.05 },
  { body: '#FFD95A', wing: '#F2B52E', at: 0.38 },
  { body: '#FF9EC4', wing: '#F06FA2', at: 0.7 },
];

function Animals({ animate }: { animate: boolean }) {
  const birds = BIRDS;
  return (
    <>
      {birds.map((b) => (
        <Orbiter key={b.at} dur={9} at={b.at} animate={animate} flip>
          <g transform="scale(1.8)">
            <Bird body={b.body} wing={b.wing} animate={animate} />
          </g>
        </Orbiter>
      ))}
    </>
  );
}

/** Snow: flakes [x, size, delay] falling round her, and sparkles [x, y, size] winking. */
export const FLAKES = [
  [60, 26, 0], [170, 20, 2.3], [880, 24, 1.1], [980, 18, 3.4], [110, 16, 4.6],
  [930, 28, 5.2], [250, 18, 3.9], [790, 18, 0.8], [30, 22, 6.1], [1000, 20, 2.9],
];
export const SNOW_SPARKLES = [
  [150, 360, 20], [880, 300, 24], [70, 760, 18], [960, 820, 22], [210, 1180, 20], [840, 1240, 18], [512, 120, 22], [330, 940, 14], [700, 980, 14],
];
export const SNOW_DUR = 7;

function Snow({ animate }: { animate: boolean }) {
  // flakes falling all round her, each turning as it falls, and sparkles winking
  const flakes = FLAKES;
  const sparkles = SNOW_SPARKLES;
  const dur = SNOW_DUR;
  return (
    <>
      {flakes.map(([x, s, d]) => (
        <g key={x} transform={animate ? undefined : `translate(${x} ${200 + ((d * 211) % 1100)})`}>
          {animate && <animateMotion dur={`${dur}s`} begin={`${-d}s`} repeatCount="indefinite" path={`M${x} 60 C${x + 40} 400 ${x - 40} 900 ${x} 1480`} />}
          <g>
            {animate && <animateTransform attributeName="transform" type="rotate" values="0;360" dur="5s" repeatCount="indefinite" />}
            <Snowflake s={s * 1.6} />
          </g>
        </g>
      ))}
      {sparkles.map(([x, y, s], k) => (
        <g key={k} transform={`translate(${x} ${y})`}>
          <Sparkle s={s * 1.5} colour="#E8F6FF" animate={animate} delay={k * 0.37} />
        </g>
      ))}
    </>
  );
}

/** Space: little stars [x, y, size] twinkling all round her, and sparkles going round with the planet. */
export const SPACE_STARS = [[90, 300, 16], [940, 380, 20], [40, 700, 14], [990, 760, 16], [160, 1140, 18], [870, 1160, 14], [300, 120, 14], [740, 110, 18]];
export const SPACE_ORBITERS = [0.27, 0.43, 0.77, 0.93];

function Space({ animate }: { animate: boolean }) {
  return (
    <>
      <Orbiter dur={12} at={0.1} animate={animate}>
        <g transform="scale(1.35)">
          <Planet />
        </g>
      </Orbiter>
      <Orbiter dur={12} at={0.6} animate={animate}>
        <g transform="scale(1.35)">
          <Moon />
        </g>
      </Orbiter>
      {/* and little stars twinkling all round her */}
      {SPACE_STARS.map(([x, y, r], k) => (
        <g key={`t${k}`} transform={`translate(${x} ${y})`}>
          <Sparkle s={r} animate={animate} delay={k * 0.29} />
        </g>
      ))}
      {SPACE_ORBITERS.map((at, k) => (
        <Orbiter key={at} dur={12} at={at} animate={animate}>
          <Sparkle s={k % 2 ? 34 : 44} animate={animate} delay={k * 0.4} />
        </Orbiter>
      ))}
    </>
  );
}

/** Flowers: [x, y, petal, middle] round her. */
export const FLOWERS: [number, number, string, string][] = [
  [80, 560, '#FF9EC4', '#FFD54A'],
  [950, 520, '#FFD95A', '#FF8A5C'],
  [40, 900, '#B79CFF', '#FFD54A'],
  [990, 880, '#FF9EC4', '#FFD54A'],
  [150, 1260, '#FFB0C8', '#FFD54A'],
  [880, 1280, '#B79CFF', '#FFE27A'],
  [300, 1420, '#FFD95A', '#FF8A5C'],
  [730, 1430, '#FF9EC4', '#FFD54A'],
  [140, 240, '#B79CFF', '#FFD54A'],
  [890, 230, '#FFB0C8', '#FFD54A'],
];

function Flowers({ animate }: { animate: boolean }) {
  const flowers = FLOWERS;
  return (
    <>
      {flowers.map(([x, y, p, c], k) => (
        <g key={k} transform={`translate(${x} ${y}) scale(1.4)`}>
          <Flower petal={p} inner={c} animate={animate} delay={k * 0.45} />
        </g>
      ))}
    </>
  );
}

const DRAW: Record<string, (p: { animate: boolean }) => ReactNode> = { kitten: Animals, wand: Snow, scepter: Space, book: Flowers };

/**
 * Her ability round her, as one layer of the sheet: `side` 'back' is all of it, drawn behind
 * her; 'front' is the near half, drawn in front of her.
 */
export function AbilityLayer({ id, side, animate }: { id: string; side: 'back' | 'front'; animate: boolean }) {
  const Draw = DRAW[id];
  if (!Draw) return null;
  const clip = `ability-${side}-${id}`;
  return (
    <svg viewBox="0 0 1024 1536" overflow="visible" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
      {side === 'front' && (
        <defs>
          <clipPath id={clip}>
            <rect x={-400} y={CY} width={1824} height={1400} />
          </clipPath>
        </defs>
      )}
      <g clipPath={side === 'front' ? `url(#${clip})` : undefined}>
        <Draw animate={animate} />
      </g>
    </svg>
  );
}

/** The card of an ability: its things together, close up, still. */
export function abilityCard(id: string) {
  return function AbilityCard() {
    let body: ReactNode = null;
    if (id === 'kitten')
      body = (
        <>
          <g transform="translate(70 80) scale(1.15)"><Bird body="#6EC6FF" wing="#3E9EE6" animate={false} /></g>
          <g transform="translate(140 140) scale(-0.95 0.95)"><Bird body="#FFD95A" wing="#F2B52E" animate={false} /></g>
          <g transform="translate(150 50) scale(0.7)"><Bird body="#FF9EC4" wing="#F06FA2" animate={false} /></g>
        </>
      );
    if (id === 'wand')
      body = (
        <>
          <g transform="translate(70 75)"><Snowflake s={42} /></g>
          <g transform="translate(145 135)"><Snowflake s={30} /></g>
          <g transform="translate(150 50)"><Sparkle s={20} colour="#E8F6FF" animate={false} /></g>
          <g transform="translate(55 150)"><Sparkle s={16} colour="#E8F6FF" animate={false} /></g>
        </>
      );
    if (id === 'scepter')
      body = (
        <>
          <g transform="translate(85 95) scale(0.95)"><Planet /></g>
          <g transform="translate(160 150) scale(0.6)"><Moon /></g>
          <g transform="translate(160 40)"><Sparkle s={20} animate={false} /></g>
          <g transform="translate(35 165)"><Sparkle s={14} animate={false} /></g>
        </>
      );
    if (id === 'book')
      body = (
        <>
          <g transform="translate(60 70) scale(0.9)"><Flower petal="#FF9EC4" inner="#FFD54A" animate={false} delay={0} /></g>
          <g transform="translate(140 60) scale(0.75)"><Flower petal="#FFD95A" inner="#FF8A5C" animate={false} delay={0} /></g>
          <g transform="translate(110 120) scale(0.8)"><Flower petal="#B79CFF" inner="#FFD54A" animate={false} delay={0} /></g>
        </>
      );
    return (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
        {body}
      </svg>
    );
  };
}

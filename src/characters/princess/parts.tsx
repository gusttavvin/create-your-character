/**
 * Vector parts for the princess. Same chunky cartoon style as the monster kit.
 *
 * Two coordinate systems, each a 512x512 box:
 *
 * HEAD box  — the face is a circle r=170 at (256,256). Hair, eyes, mouth and the
 *             crown are drawn here.
 * DRESS box — the body. Landmarks, so every dress fits the same girl:
 *               y =  50  the chin (where the head's outline crosses the neck)
 *               y =  96  the shoulders
 *               y = 136  the middle of the puff sleeves
 *               y = 196  the waist
 *               y = 286  the hands
 *               y = 396  the floor (the bottom of her shoes)
 *             Everything is mirror-symmetric about x = 256, so a shape and its
 *             reflection `matrix(-1 0 0 1 512 0)` always meet in the middle.
 */
import type { ReactNode } from 'react';
import type { ColorMap, PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 14;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Landmarks of the DRESS box, shared by the dresses, the neck and the feet. */
export const BODY = {
  chin: 50,
  shoulder: 96,
  waist: 196,
  hand: { x: 400, y: 286 },
  floor: 396,
};

export const PRINCESS_DEFAULTS = {
  skin: '#FCE1C8',
  dress: { gown: '#FF6EC7', aline: '#4FC3FF', mermaid: '#2ED8C3', star: '#A77BFF' } as Record<string, string>,
  hair: { long: '#FFC93C', braids: '#8B4513', bun: '#2B1B12', curly: '#D2461F' } as Record<string, string>,
};

/** Which dresses let her shoes show. A mermaid dress ends in a tail, so it does not. */
export const DRESS_SHOWS_FEET: Record<string, boolean> = { gown: true, aline: true, mermaid: false, star: true };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
    >
      {children}
    </svg>
  );
}

/** One shape and its exact reflection, so every pair is a true mirror. */
function Pair({ children }: { children: ReactNode }) {
  return (
    <g>
      {children}
      <g transform="matrix(-1 0 0 1 512 0)">{children}</g>
    </g>
  );
}

/* ------------------------------------------------------------------ HEAD */

export function Head({ colors, className }: PartSvgProps) {
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <circle cx="78" cy="292" r="34" fill={skin} {...O} />
      <circle cx="434" cy="292" r="34" fill={skin} {...O} />
      <circle cx="256" cy="256" r="170" fill={skin} {...O} />
      <ellipse cx="150" cy="332" rx="30" ry="17" fill="#FF9AA2" opacity="0.75" />
      <ellipse cx="362" cy="332" rx="30" ry="17" fill="#FF9AA2" opacity="0.75" />
    </Svg>
  );
}

/**
 * Her neck, drawn in the DRESS box on its own layer between the dress and the
 * head: the chin covers the top of it and the bodice's neckline covers the
 * bottom, so what is left is a clear column of skin under her jaw.
 */
export function Neck({ colors, className }: PartSvgProps) {
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      {/* the sides run down past the shoulder line, so the bodice always closes over them */}
      <path d="M212,2 L212,96 C212,118 230,130 256,130 C282,130 300,118 300,96 L300,2 Z" fill={skin} {...O} strokeWidth={12} />
    </Svg>
  );
}

/* ----------------------------------------------------------------- DRESS */

function Arms({ skin }: { skin: string }) {
  const d = 'M154,156 C132,188 116,226 112,272';
  return (
    <Pair>
      <g>
        <path d={d} fill="none" stroke={INK} strokeWidth="46" strokeLinecap="round" />
        <path d={d} fill="none" stroke={skin} strokeWidth="30" strokeLinecap="round" />
        <circle cx="112" cy="286" r="26" fill={skin} {...O} strokeWidth={12} />
      </g>
    </Pair>
  );
}

/** Shoulders, chest and waist. The same for every dress, so only the skirt changes. */
function Bodice({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M162,150 C168,112 196,92 232,90 C240,118 272,118 280,90 C316,92 344,112 350,150 C356,172 344,188 336,200 L176,200 C168,188 156,172 162,150 Z"
        fill={shade(color, -0.12)}
        {...O}
      />
      <path d="M232,96 C242,122 270,122 280,96" fill="none" stroke={shade(color, 0.4)} strokeWidth="9" strokeLinecap="round" />
    </g>
  );
}

function PuffSleeves({ color, r = 40 }: { color: string; r?: number }) {
  return (
    <Pair>
      <circle cx={150} cy={130} r={r} fill={color} {...O} />
    </Pair>
  );
}

function Sash({ color }: { color: string }) {
  return <rect x="170" y="180" width="172" height="26" rx="13" fill={shade(color, -0.3)} {...O} strokeWidth={10} />;
}

/** 1 — BALL GOWN: the widest one. A huge round bell with a scalloped hem. */
export function DressGown({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.gown;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <path
        d="M186,184 C118,220 48,268 32,326 Q70,364 108,330 Q146,366 184,332 Q220,366 256,332 Q292,366 328,332 Q366,366 404,330 Q442,364 480,326 C464,268 394,220 326,184 Z"
        fill={c}
        {...O}
      />
      <path
        d="M50,318 Q86,350 120,324 Q158,356 194,326 Q224,350 256,326 Q288,350 318,326 Q354,356 392,324 Q426,350 462,318"
        fill="none"
        stroke={shade(c, 0.45)}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M210,206 C186,254 150,290 108,314 M256,208 L256,326 M302,206 C326,254 362,290 404,314"
        fill="none"
        stroke={shade(c, -0.16)}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <Arms skin={skin} />
      <Bodice color={c} />
      <PuffSleeves color={c} r={42} />
      <Sash color={c} />
    </Svg>
  );
}

/** 2 — SHORT DRESS: the only one that stops at her knees, so her legs show. */
export function DressAline({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.aline;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <path d="M182,186 C158,206 132,230 118,262 Q186,292 256,292 Q326,292 394,262 C380,230 354,206 330,186 Z" fill={c} {...O} />
      <path
        d="M196,198 L164,256 M226,200 L214,282 M256,200 L256,290 M286,200 L298,282 M316,198 L348,256"
        fill="none"
        stroke={shade(c, -0.16)}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <Arms skin={skin} />
      <Bodice color={c} />
      <PuffSleeves color={c} r={34} />
      <Sash color={c} />
      {/* the bow at her waist: one loop and one tail, plus their reflection */}
      <Pair>
        <g>
          <path d="M250,196 L206,250 L240,242 Z" fill={shade('#FFD93D', -0.18)} {...O} strokeWidth={9} />
          <path d="M252,188 C218,152 174,164 184,196 C192,222 230,214 252,188 Z" fill="#FFD93D" {...O} strokeWidth={10} />
        </g>
      </Pair>
      <circle cx="256" cy="192" r="18" fill="#FFB800" {...O} strokeWidth={10} />
    </Svg>
  );
}

/** 3 — MERMAID: narrow all the way down her legs, then a wide tail. No feet. */
export function DressMermaid({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.mermaid;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  const scale = shade(c, 0.35);
  const deep = shade(c, -0.2);
  return (
    <Svg className={className}>
      {/* a real fish tail: it narrows past her knees and ends in a spread fluke */}
      <path
        d="M116,392 C170,398 220,376 256,344 C292,376 342,398 396,392 C372,436 320,468 256,470 C192,468 140,436 116,392 Z"
        fill={deep}
        {...O}
      />
      <path
        d="M186,186 C176,240 186,298 214,352 C230,372 242,384 256,392 C270,384 282,372 298,352 C326,298 336,240 326,186 Z"
        fill={c}
        {...O}
      />
      {/* rows of scales down the whole tail */}
      <g fill="none" stroke={scale} strokeWidth="9" strokeLinecap="round">
        <path d="M196,220 Q216,244 236,220 Q256,244 276,220 Q296,244 316,220" />
        <path d="M192,262 Q214,286 236,262 Q256,286 278,262 Q300,286 322,262" />
        <path d="M200,304 Q220,328 240,304 Q256,328 274,304 Q294,328 314,304" />
        <path d="M214,344 Q234,366 254,344 Q256,366 258,344 Q278,366 298,344" />
      </g>
      {/* the ridge of the fluke */}
      <path d="M256,352 L256,462" fill="none" stroke={shade(c, -0.3)} strokeWidth="9" strokeLinecap="round" />
      <path d="M168,404 Q210,428 248,446 M344,404 Q302,428 264,446" fill="none" stroke={shade(c, 0.22)} strokeWidth="8" strokeLinecap="round" />
      <Arms skin={skin} />
      <Bodice color={c} />
      <PuffSleeves color={c} r={30} />
      <Sash color={c} />
    </Svg>
  );
}

function star(cx: number, cy: number, rOut: number, rIn: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 4 — STAR: three skirts stacked like steps, each wider than the one above. */
export function DressStar({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.star;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <path d="M138,266 L374,266 L404,332 Q256,354 108,332 Z" fill={shade(c, -0.16)} {...O} />
      <path d="M160,214 L352,214 L378,278 Q256,300 134,278 Z" fill={shade(c, -0.07)} {...O} />
      <path d="M182,184 L330,184 L352,230 Q256,250 160,230 Z" fill={c} {...O} />
      <g fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <polygon points={star(190, 300, 20, 9)} />
        <polygon points={star(256, 312, 22, 10)} />
        <polygon points={star(322, 300, 20, 9)} />
        <polygon points={star(212, 246, 16, 7)} />
        <polygon points={star(300, 246, 16, 7)} />
        <polygon points={star(256, 214, 14, 6)} />
      </g>
      <Arms skin={skin} />
      <Bodice color={c} />
      <PuffSleeves color={c} r={38} />
      <Sash color={c} />
      <polygon points={star(256, 144, 18, 8)} fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ FEET */

/**
 * Her legs and shoes, drawn in the DRESS box on a layer behind the skirt so they
 * only peek out below the hem. The short dress shows whole legs; the mermaid
 * dress ends in a tail and shows nothing at all.
 */
export function Feet({ colors, kind, className }: { colors: ColorMap; kind: string | null; className?: string }) {
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  const c = shade(colors.dress || PRINCESS_DEFAULTS.dress.gown, -0.32);
  if (!kind || !DRESS_SHOWS_FEET[kind]) return null;
  return (
    <Svg className={className}>
      {kind === 'aline' && (
        <Pair>
          <g>
            <path d="M206,250 L206,366" fill="none" stroke={INK} strokeWidth="50" strokeLinecap="round" />
            <path d="M206,250 L206,366" fill="none" stroke={skin} strokeWidth="30" strokeLinecap="round" />
          </g>
        </Pair>
      )}
      <Pair>
        <g>
          <rect x="182" y="338" width="48" height="28" rx="13" fill={shade(c, 0.3)} {...O} strokeWidth={10} />
          <rect x="164" y="358" width="84" height="38" rx="18" fill={c} {...O} strokeWidth={12} />
        </g>
      </Pair>
    </Svg>
  );
}

/* ------------------------------------------------------------------ HAIR */
/* Each style has a Back layer (behind the head) and a Front layer (bangs, in front). */

/**
 * Long hair: one mass behind her head and shoulders that splits into two locks
 * falling past the skirt all the way down to her shoes. It is drawn far below
 * the 512 box on purpose — the layer's svg is `overflow: visible` and the tips
 * land at y≈986, which is the floor of the picture.
 */
export function HairLongBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.long;
  return (
    <Svg className={className}>
      <path
        d="M256,44 C124,44 60,148 66,268 C70,340 52,420 58,520 C62,640 70,780 84,900 C92,962 130,996 176,986 C214,978 220,930 206,860 C190,776 186,690 196,520 C200,460 196,424 192,400 L320,400 C316,424 312,460 316,520 C326,690 322,776 306,860 C292,930 298,978 336,986 C382,996 420,962 428,900 C442,780 450,640 454,520 C460,420 442,340 446,268 C452,148 388,44 256,44 Z"
        fill={c}
        {...O}
      />
      <Pair>
        <path
          d="M112,300 C100,420 104,560 116,700 C124,800 132,890 142,948"
          fill="none"
          stroke={shade(c, -0.25)}
          strokeWidth="10"
          strokeLinecap="round"
        />
      </Pair>
    </Svg>
  );
}

export function HairLongFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.long;
  return (
    <Svg className={className}>
      <path
        d="M78,290 C66,150 140,56 256,56 C372,56 446,150 434,290 C420,220 392,176 350,180 C330,140 300,130 256,168 C220,132 170,146 154,190 C116,186 92,230 78,290 Z"
        fill={c}
        {...O}
      />
      <path d="M256,70 C280,100 300,120 320,130" fill="none" stroke={shade(c, 0.4)} strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

/** The card preview: shrunk so the whole floor-length fall fits inside the box. */
export function HairLong(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <g transform="translate(128 4) scale(0.49)">
        <HairLongBack {...props} />
        <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
        <HairLongFront {...props} />
      </g>
    </Svg>
  );
}

function Braid({ x, color, ribbon }: { x: number; color: string; ribbon: string }) {
  const beads = [300, 352, 404, 456, 508];
  return (
    <g>
      {beads.map((y, i) => (
        <circle key={y} cx={x + (i % 2 === 0 ? -8 : 8)} cy={y} r="30" fill={color} {...O} strokeWidth={12} />
      ))}
      <path d={`M${x - 26},552 L${x + 26},552 L${x},526 Z M${x - 26},552 L${x + 26},552 L${x},578 Z`} fill={ribbon} {...O} strokeWidth={9} />
    </g>
  );
}

export function HairBraidsBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.braids;
  return (
    <Svg className={className}>
      <path d="M256,50 C130,50 66,150 66,270 C66,330 80,360 100,380 L412,380 C432,360 446,330 446,270 C446,150 382,50 256,50 Z" fill={c} {...O} />
      {/* the right braid is the left one reflected, so the pair matches like a mirror */}
      <Pair>
        <Braid x={96} color={c} ribbon="#FF6B78" />
      </Pair>
    </Svg>
  );
}

export function HairBraidsFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.braids;
  return (
    <Svg className={className}>
      <path d="M80,270 C70,150 140,56 256,56 C372,56 442,150 432,270 C420,200 380,160 320,176 C300,150 260,150 236,178 C200,160 150,170 130,210 C104,220 90,246 80,270 Z" fill={c} {...O} />
      <path d="M256,74 L256,150" fill="none" stroke={shade(c, -0.3)} strokeWidth="8" strokeLinecap="round" />
    </Svg>
  );
}

export function HairBraids(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <g transform="translate(64 16) scale(0.75)">
        <HairBraidsBack {...props} />
        <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
        <HairBraidsFront {...props} />
      </g>
    </Svg>
  );
}

export function HairBunBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.bun;
  return (
    <Svg className={className}>
      <circle cx="256" cy="56" r="70" fill={c} {...O} />
      <circle cx="232" cy="36" r="16" fill={shade(c, 0.45)} />
      <path d="M256,60 C130,60 66,160 66,280 C66,330 76,350 92,366 L420,366 C436,350 446,330 446,280 C446,160 382,60 256,60 Z" fill={c} {...O} />
    </Svg>
  );
}

export function HairBunFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.bun;
  return (
    <Svg className={className}>
      <path d="M82,250 C74,150 140,66 256,66 C372,66 438,150 430,250 C400,180 330,166 256,200 C182,166 112,180 82,250 Z" fill={c} {...O} />
      <path d="M150,110 C180,90 220,84 256,86" fill="none" stroke={shade(c, 0.45)} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}

export function HairBun(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HairBunBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
      <HairBunFront {...props} />
    </Svg>
  );
}

const CURLS: [number, number, number][] = [
  [110, 120, 54], [170, 70, 54], [256, 46, 58], [342, 70, 54], [402, 120, 54],
  [70, 200, 50], [442, 200, 50], [60, 290, 48], [452, 290, 48], [70, 380, 48], [442, 380, 48],
  [100, 456, 46], [412, 456, 46], [150, 500, 40], [362, 500, 40],
];

export function HairCurlyBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.curly;
  return (
    <Svg className={className}>
      {CURLS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} {...O} strokeWidth={12} />
      ))}
      {CURLS.map(([x, y, r], i) => (
        <circle key={`i${i}`} cx={x} cy={y} r={r - 2} fill={c} />
      ))}
      <path d="M256,90 C140,90 90,190 90,300 L422,300 C422,190 372,90 256,90 Z" fill={c} />
    </Svg>
  );
}

export function HairCurlyFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.curly;
  const front: [number, number, number][] = [
    [120, 170, 40], [170, 130, 42], [226, 112, 44], [286, 112, 44], [342, 130, 42], [392, 170, 40],
  ];
  return (
    <Svg className={className}>
      {front.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} {...O} strokeWidth={12} />
      ))}
      {front.map(([x, y, r], i) => (
        <circle key={`i${i}`} cx={x} cy={y} r={r - 2} fill={c} />
      ))}
      <circle cx="210" cy="118" r="10" fill={shade(c, 0.45)} />
    </Svg>
  );
}

export function HairCurly(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HairCurlyBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
      <HairCurlyFront {...props} />
    </Svg>
  );
}

export const HAIR_LAYERS: Record<string, { Back: (p: PartSvgProps) => ReactNode; Front: (p: PartSvgProps) => ReactNode }> = {
  long: { Back: HairLongBack, Front: HairLongFront },
  braids: { Back: HairBraidsBack, Front: HairBraidsFront },
  bun: { Back: HairBunBack, Front: HairBunFront },
  curly: { Back: HairCurlyBack, Front: HairCurlyFront },
};

/* ----------------------------------------------------------------- CROWN */
/* Crown art sits with its base at y=430 so it can rest on top of the head. */

export function CrownTiara({ className }: PartSvgProps) {
  const d = 'M96,430 Q256,330 416,430';
  return (
    <Svg className={className}>
      <path d={d} fill="none" stroke={INK} strokeWidth="52" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#E4E9F7" strokeWidth="28" strokeLinecap="round" />
      <polygon points="256,300 296,360 256,420 216,360" fill="#FF6EC7" {...O} strokeWidth={10} />
      <circle cx="170" cy="392" r="16" fill="#4FC3FF" {...O} strokeWidth={8} />
      <circle cx="342" cy="392" r="16" fill="#4FC3FF" {...O} strokeWidth={8} />
      <circle cx="246" cy="340" r="8" fill="#fff" />
    </Svg>
  );
}

export function CrownGold({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M100,430 L92,250 L176,326 L256,206 L336,326 L420,250 L412,430 Z" fill="#FFD93D" {...O} />
      <rect x="100" y="386" width="312" height="44" fill="#FFB800" {...O} strokeWidth={10} />
      <circle cx="256" cy="212" r="18" fill="#FF6B78" {...O} strokeWidth={8} />
      <circle cx="92" cy="254" r="16" fill="#4FC3FF" {...O} strokeWidth={8} />
      <circle cx="420" cy="254" r="16" fill="#4FC3FF" {...O} strokeWidth={8} />
      <circle cx="256" cy="408" r="16" fill="#7ED957" {...O} strokeWidth={8} />
    </Svg>
  );
}

function Flower({ x, y, petal, r = 20 }: { x: number; y: number; petal: string; r?: number }) {
  const pts = [0, 72, 144, 216, 288].map((a) => [x + r * 1.05 * Math.cos((a * Math.PI) / 180), y + r * 1.05 * Math.sin((a * Math.PI) / 180)]);
  return (
    <g>
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={r * 0.85} fill={petal} {...O} strokeWidth={8} />
      ))}
      <circle cx={x} cy={y} r={r * 0.7} fill="#FFD93D" {...O} strokeWidth={8} />
    </g>
  );
}

export function CrownFlowers({ className }: PartSvgProps) {
  const d = 'M90,430 Q256,300 422,430';
  return (
    <Svg className={className}>
      <path d={d} fill="none" stroke={INK} strokeWidth="44" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#7ED957" strokeWidth="22" strokeLinecap="round" />
      <Flower x={130} y={412} petal="#FF6EC7" />
      <Flower x={196} y={366} petal="#fff" />
      <Flower x={256} y={350} petal="#FF6B78" r={24} />
      <Flower x={316} y={366} petal="#fff" />
      <Flower x={382} y={412} petal="#A77BFF" />
    </Svg>
  );
}

export function CrownBow({ className }: PartSvgProps) {
  const c = '#FF6B78';
  return (
    <Svg className={className}>
      <g transform="translate(330 340) rotate(-18)">
        <path d="M0,0 C-80,-90 -150,-40 -110,20 C-80,60 -30,30 0,0 Z" fill={c} {...O} />
        <path d="M0,0 C80,-90 150,-40 110,20 C80,60 30,30 0,0 Z" fill={c} {...O} />
        <path d="M-10,10 L-50,100 L-10,90 Z M10,10 L50,100 L10,90 Z" fill={shade(c, -0.15)} {...O} strokeWidth={10} />
        <circle cx="0" cy="0" r="24" fill={shade(c, -0.2)} {...O} strokeWidth={10} />
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ EYES */

function SparkleEye({ cx, cy, r = 62, iris = '#3AA0FF' }: { cx: number; cy: number; r?: number; iris?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" {...O} />
      <circle cx={cx} cy={cy + 4} r={r * 0.7} fill={iris} />
      <circle cx={cx} cy={cy + 6} r={r * 0.42} fill={INK} />
      <circle cx={cx + r * 0.28} cy={cy - r * 0.28} r={r * 0.2} fill="#fff" />
      <circle cx={cx - r * 0.2} cy={cy + r * 0.25} r={r * 0.1} fill="#fff" />
      <path d={`M${cx - r * 0.9},${cy - r * 0.9} L${cx - r * 1.15},${cy - r * 1.3} M${cx},${cy - r * 1.05} L${cx},${cy - r * 1.5}`} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
    </g>
  );
}

function ClosedHappy({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="18" strokeLinecap="round">
      <path d={`M${cx - 56},${cy + 18} Q${cx},${cy - 60} ${cx + 56},${cy + 18}`} />
      <path d={`M${cx - 50},${cy - 26} L${cx - 66},${cy - 48} M${cx + 50},${cy - 26} L${cx + 66},${cy - 48}`} strokeWidth="10" />
    </g>
  );
}

export function EyesSparkly({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <SparkleEye cx={150} cy={262} />
      <SparkleEye cx={362} cy={262} />
    </Svg>
  );
}

export function EyesHappy({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <ClosedHappy cx={150} cy={262} />
      <ClosedHappy cx={362} cy={262} />
    </Svg>
  );
}

export function EyesWink({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <SparkleEye cx={150} cy={262} />
      <ClosedHappy cx={362} cy={262} />
    </Svg>
  );
}

export function EyesSleepy({ colors, className }: PartSvgProps) {
  const lid = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <defs>
        <clipPath id="pr-sleepy-l">
          <circle cx="150" cy="262" r="62" />
        </clipPath>
        <clipPath id="pr-sleepy-r">
          <circle cx="362" cy="262" r="62" />
        </clipPath>
      </defs>
      <SparkleEye cx={150} cy={262} iris="#A77BFF" />
      <SparkleEye cx={362} cy={262} iris="#A77BFF" />
      <g clipPath="url(#pr-sleepy-l)">
        <rect x="70" y="180" width="160" height="72" fill={lid} />
      </g>
      <g clipPath="url(#pr-sleepy-r)">
        <rect x="282" y="180" width="160" height="72" fill={lid} />
      </g>
      <path d="M92,252 L210,252 M304,252 L422,252" fill="none" stroke={INK} strokeWidth="14" strokeLinecap="round" />
    </Svg>
  );
}

/** Her cheeks on their own, in the eye layer's box, so the 3D head can wear them too. */
export function FaceBlush({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <ellipse cx="69" cy="366" rx="53" ry="30" fill="#FF9AA2" opacity="0.7" />
      <ellipse cx="443" cy="366" rx="53" ry="30" fill="#FF9AA2" opacity="0.7" />
    </Svg>
  );
}

/* ----------------------------------------------------------------- MOUTH */

export function MouthSmile({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M150,226 Q256,326 362,226" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

/** A friendly open laugh: a wide grin, her top teeth showing and a little tongue. */
export function MouthLaugh({ className }: PartSvgProps) {
  const d = 'M146,222 Q256,200 366,222 C360,312 316,352 256,352 C196,352 152,312 146,222 Z';
  return (
    <Svg className={className}>
      <path d={d} fill="#7C1A34" {...O} />
      <path d="M156,228 Q256,208 356,228 L350,256 Q256,240 162,256 Z" fill="#fff" />
      <path d="M204,308 C204,282 308,282 308,308 C308,336 284,350 256,350 C228,350 204,336 204,308 Z" fill="#FF6B78" />
      <path d={d} fill="none" {...O} />
      <path d="M132,208 Q146,226 152,238 M380,208 Q366,226 360,238" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

export function MouthOh({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <ellipse cx="256" cy="262" rx="42" ry="54" fill={INK} {...O} strokeWidth={12} />
      <ellipse cx="256" cy="284" rx="24" ry="18" fill="#FF6B78" />
    </Svg>
  );
}

export function MouthTongue({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M226,282 C226,346 300,346 300,282 Z" fill="#FF6B78" {...O} strokeWidth={12} />
      <path d="M263,292 L263,326" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M150,226 Q256,326 362,226" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------- ACCESSORY */
/* Art is drawn so the "grip" point is at (256, 440), where the hand holds it. */

function Stick({ color, from = 440, to = 180 }: { color: string; from?: number; to?: number }) {
  return (
    <g>
      <path d={`M256,${from} L256,${to}`} fill="none" stroke={INK} strokeWidth="36" strokeLinecap="round" />
      <path d={`M256,${from} L256,${to}`} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
    </g>
  );
}

export function AccessoryWand({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#FFE066" />
      <polygon points={star(256, 150, 84, 40)} fill="#FFD93D" {...O} />
      <circle cx="240" cy="132" r="10" fill="#fff" />
      <path d="M350,80 L370,60 M360,100 L390,100 M140,110 L120,90 M150,150 L120,150" fill="none" stroke="#FFB800" strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

export function AccessoryBook({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <g transform="rotate(-10 256 340)">
        <rect x="150" y="220" width="212" height="230" rx="16" fill="#A77BFF" {...O} />
        <rect x="170" y="240" width="172" height="190" rx="10" fill="#fff" />
        <rect x="150" y="220" width="40" height="230" rx="12" fill="#8A5CFF" {...O} strokeWidth={10} />
        <path d="M290,300 C270,270 236,290 256,320 C276,290 242,270 222,300" fill="#FF6B78" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
        <path d="M256,330 L256,360" fill="none" stroke="#FF6B78" strokeWidth="8" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

export function AccessoryScepter({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#FFD93D" to={200} />
      <path d="M206,214 L306,214 L286,254 L226,254 Z" fill="#FFB800" {...O} strokeWidth={10} />
      <circle cx="256" cy="150" r="58" fill="#4FC3FF" {...O} />
      <circle cx="236" cy="130" r="14" fill="#fff" />
      <circle cx="270" cy="170" r="8" fill="#fff" opacity="0.7" />
    </Svg>
  );
}

export function AccessoryKitten({ className }: PartSvgProps) {
  const c = '#FF9E4A';
  return (
    <Svg className={className}>
      <ellipse cx="256" cy="400" rx="74" ry="56" fill={c} {...O} />
      <path d="M196,300 L176,224 L240,266 Z M316,300 L336,224 L272,266 Z" fill={c} {...O} />
      <circle cx="256" cy="316" r="76" fill={c} {...O} />
      <circle cx="226" cy="306" r="10" fill={INK} />
      <circle cx="286" cy="306" r="10" fill={INK} />
      <path d="M248,334 L264,334 L256,344 Z" fill="#FF6B78" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M256,344 Q246,358 236,352 M256,344 Q266,358 276,352" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M180,330 L140,320 M180,344 L140,352 M332,330 L372,320 M332,344 L372,352" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M320,420 C360,410 380,380 360,350" fill="none" stroke={INK} strokeWidth="32" strokeLinecap="round" />
      <path d="M320,420 C360,410 380,380 360,350" fill="none" stroke={c} strokeWidth="16" strokeLinecap="round" />
    </Svg>
  );
}

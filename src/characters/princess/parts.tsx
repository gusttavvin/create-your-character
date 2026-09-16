/**
 * Vector parts for the princess. Same chunky cartoon style as the monster kit.
 * All head-related parts (head, hair, eyes, mouth, crown) share the head's
 * coordinate system: a 512x512 box where the face is a circle r=170 at (256,256).
 */
import type { ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 14;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const PRINCESS_DEFAULTS = {
  skin: '#FCE1C8',
  dress: { gown: '#FF6EC7', aline: '#4FC3FF', mermaid: '#2ED8C3', star: '#A77BFF' } as Record<string, string>,
  hair: { long: '#FFC93C', braids: '#8B4513', bun: '#2B1B12', curly: '#D2461F' } as Record<string, string>,
};

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

/* ----------------------------------------------------------------- DRESS */

function Arms({ skin }: { skin: string }) {
  const l = 'M164,104 C118,160 100,222 108,290';
  const r = 'M348,104 C394,160 412,222 404,290';
  return (
    <g>
      <path d={`${l} ${r}`} fill="none" stroke={INK} strokeWidth="46" strokeLinecap="round" />
      <path d={`${l} ${r}`} fill="none" stroke={skin} strokeWidth="26" strokeLinecap="round" />
      <circle cx="108" cy="298" r="26" fill={skin} {...O} strokeWidth={12} />
      <circle cx="404" cy="298" r="26" fill={skin} {...O} strokeWidth={12} />
    </g>
  );
}

function Neck({ skin }: { skin: string }) {
  return <rect x="228" y="30" width="56" height="60" fill={skin} {...O} strokeWidth={10} />;
}

function Bodice({ color }: { color: string }) {
  return <path d="M182,66 C182,120 184,166 168,192 L344,192 C328,166 330,120 330,66 Z" fill={shade(color, -0.12)} {...O} />;
}

function PuffSleeves({ color, r = 36 }: { color: string; r?: number }) {
  return (
    <g>
      <circle cx="172" cy="94" r={r} fill={color} {...O} />
      <circle cx="340" cy="94" r={r} fill={color} {...O} />
    </g>
  );
}

export function DressGown({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.gown;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M168,192 C168,300 66,380 56,470 L456,470 C446,380 344,300 344,192 Z" fill={c} {...O} />
      <path d="M56,470 Q86,436 116,470 Q146,436 176,470 Q206,436 236,470 Q266,436 296,470 Q326,436 356,470 Q386,436 416,470 Q436,440 456,470" fill="none" stroke={shade(c, 0.45)} strokeWidth="12" strokeLinecap="round" />
      <path d="M256,200 L256,440" fill="none" stroke={shade(c, -0.18)} strokeWidth="8" strokeLinecap="round" />
      <Bodice color={c} />
      <PuffSleeves color={c} />
      <ellipse cx="256" cy="150" rx="26" ry="12" fill={shade(c, 0.5)} />
    </Svg>
  );
}

export function DressAline({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.aline;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M176,192 C150,300 118,400 112,470 L400,470 C394,400 362,300 336,192 Z" fill={c} {...O} />
      <path d="M124,430 L388,430" fill="none" stroke={shade(c, 0.45)} strokeWidth="14" strokeLinecap="round" />
      <Bodice color={c} />
      <PuffSleeves color={c} r={30} />
      <path d="M256,192 L200,160 L206,224 Z M256,192 L312,160 L306,224 Z" fill="#FFD93D" {...O} strokeWidth={10} />
      <circle cx="256" cy="192" r="16" fill="#FFD93D" {...O} strokeWidth={10} />
    </Svg>
  );
}

export function DressMermaid({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.mermaid;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  const scale = shade(c, 0.35);
  return (
    <Svg className={className}>
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M178,192 C184,300 196,360 236,404 C176,430 126,440 92,470 L420,470 C386,440 336,430 276,404 C316,360 328,300 334,192 Z" fill={c} {...O} />
      <g fill="none" stroke={scale} strokeWidth="9" strokeLinecap="round">
        <path d="M200,260 Q220,286 240,260 Q260,286 280,260 Q300,286 320,260" />
        <path d="M206,310 Q226,336 246,310 Q266,336 286,310 Q306,336 316,310" />
        <path d="M222,360 Q242,386 262,360 Q282,386 296,360" />
      </g>
      <Bodice color={c} />
      <PuffSleeves color={c} r={28} />
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

export function DressStar({ colors, className }: PartSvgProps) {
  const c = colors.dress || PRINCESS_DEFAULTS.dress.star;
  const skin = colors.skin || PRINCESS_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M172,192 C150,290 96,380 80,470 L432,470 C416,380 362,290 340,192 Z" fill={c} {...O} />
      <g fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <polygon points={star(180, 400, 26, 12)} />
        <polygon points={star(256, 330, 22, 10)} />
        <polygon points={star(330, 410, 26, 12)} />
        <polygon points={star(230, 440, 14, 6)} />
        <polygon points={star(300, 250, 14, 6)} />
      </g>
      <Bodice color={c} />
      <PuffSleeves color={c} r={42} />
      <polygon points={star(256, 150, 20, 9)} fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ HAIR */
/* Each style has a Back layer (behind the head) and a Front layer (bangs, in front). */

export function HairLongBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.long;
  return (
    <Svg className={className}>
      <path
        d="M256,50 C120,50 62,150 66,270 C70,380 40,500 86,600 C160,600 190,560 200,470 L312,470 C322,560 352,600 426,600 C472,500 442,380 446,270 C450,150 392,50 256,50 Z"
        fill={c}
        {...O}
      />
      <path d="M110,300 C100,400 96,470 108,550 M402,300 C412,400 416,470 404,550" fill="none" stroke={shade(c, -0.25)} strokeWidth="10" strokeLinecap="round" />
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

export function HairLong(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HairLongBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
      <HairLongFront {...props} />
    </Svg>
  );
}

function Braid({ x, color, ribbon }: { x: number; color: string; ribbon: string }) {
  const beads = [300, 350, 400, 450, 500];
  return (
    <g>
      {beads.map((y, i) => (
        <circle key={y} cx={x + (i % 2 === 0 ? -8 : 8)} cy={y} r="30" fill={color} {...O} strokeWidth={12} />
      ))}
      <path d={`M${x - 26},545 L${x + 26},545 L${x},520 Z M${x - 26},545 L${x + 26},545 L${x},570 Z`} fill={ribbon} {...O} strokeWidth={9} />
    </g>
  );
}

export function HairBraidsBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || PRINCESS_DEFAULTS.hair.braids;
  return (
    <Svg className={className}>
      <path d="M256,50 C130,50 66,150 66,270 C66,330 80,360 100,380 L412,380 C432,360 446,330 446,270 C446,150 382,50 256,50 Z" fill={c} {...O} />
      {/* the right braid is the left one reflected, so the pair matches like a mirror */}
      <Braid x={96} color={c} ribbon="#FF6B78" />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Braid x={96} color={c} ribbon="#FF6B78" />
      </g>
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
      <HairBraidsBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || PRINCESS_DEFAULTS.skin} {...O} />
      <HairBraidsFront {...props} />
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

/* ----------------------------------------------------------------- MOUTH */

export function MouthSmile({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M150,226 Q256,326 362,226" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

export function MouthLaugh({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M126,214 Q256,196 386,214 Q256,372 126,214 Z" fill={INK} {...O} strokeWidth={12} />
      <path d="M170,236 Q256,246 342,236 Q256,262 170,236 Z" fill="#fff" />
      <ellipse cx="256" cy="316" rx="56" ry="26" fill="#FF6B78" />
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

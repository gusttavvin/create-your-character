/**
 * Vector parts for the dragon, drawn in the same chunky-outline cartoon style
 * as the monster kit (thick ink outlines, flat fills, light highlights).
 * Every part lives in a 512x512 box so it can be positioned like the kit PNGs.
 */
import type { ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 14;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const DRAGON_DEFAULTS = {
  body: { chubby: '#7ED957', tall: '#4FC3FF', spiky: '#FF6B78', round: '#A77BFF' } as Record<string, string>,
  wings: { bat: '#FF8A2A', feather: '#FFD93D', tiny: '#FF6EC7', butterfly: '#4FC3FF' } as Record<string, string>,
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

function Feet({ color }: { color: string }) {
  return (
    <g>
      <rect x="140" y="418" width="82" height="54" rx="24" fill={shade(color, -0.12)} {...O} />
      <rect x="290" y="418" width="82" height="54" rx="24" fill={shade(color, -0.12)} {...O} />
    </g>
  );
}

function Belly({ cx, cy, rx, ry, color }: { cx: number; cy: number; rx: number; ry: number; color: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={shade(color, 0.45)} />;
}

function Spots({ color, pts }: { color: string; pts: [number, number, number][] }) {
  return (
    <g fill={shade(color, -0.18)} opacity="0.7">
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

function Shine({ x, y, w = 60, h = 26, rot = -30 }: { x: number; y: number; w?: number; h?: number; rot?: number }) {
  return <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="#fff" opacity="0.55" transform={`rotate(${rot} ${x} ${y})`} />;
}

/* ------------------------------------------------------------------ BODY */

export function BodyChubby({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.chubby;
  return (
    <Svg className={className}>
      <Feet color={c} />
      <path
        d="M256,54 C344,54 398,116 398,194 C398,232 386,262 366,288 C424,318 456,372 456,414 C456,452 400,470 256,470 C112,470 56,452 56,414 C56,372 88,318 146,288 C126,262 114,232 114,194 C114,116 168,54 256,54 Z"
        fill={c}
        {...O}
      />
      <Belly cx={256} cy={392} rx={118} ry={58} color={c} />
      <Spots color={c} pts={[[150, 350, 14], [372, 340, 12], [120, 420, 9]]} />
      <Shine x={190} y={110} />
    </Svg>
  );
}

export function BodyTall({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.tall;
  return (
    <Svg className={className}>
      <Feet color={c} />
      <rect x="112" y="46" width="288" height="424" rx="140" fill={c} {...O} />
      <Belly cx={256} cy={352} rx={92} ry={92} color={c} />
      <Spots color={c} pts={[[150, 160, 12], [360, 200, 10], [345, 420, 12]]} />
      <Shine x={180} y={100} />
    </Svg>
  );
}

function spikePath(cx: number, cy: number, rIn: number, rOut: number, angles: number[]) {
  return angles
    .map((a) => {
      const a1 = ((a - 10) * Math.PI) / 180;
      const a2 = ((a + 10) * Math.PI) / 180;
      const am = (a * Math.PI) / 180;
      return `M${cx + rIn * Math.cos(a1)},${cy + rIn * Math.sin(a1)} L${cx + rOut * Math.cos(am)},${cy + rOut * Math.sin(am)} L${cx + rIn * Math.cos(a2)},${cy + rIn * Math.sin(a2)} Z`;
    })
    .join(' ');
}

export function BodySpiky({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.spiky;
  return (
    <Svg className={className}>
      <Feet color={c} />
      <path d={spikePath(256, 268, 170, 236, [-160, -135, -110, -90, -70, -45, -20])} fill={shade(c, -0.2)} {...O} />
      <circle cx="256" cy="268" r="192" fill={c} {...O} />
      <Belly cx={256} cy={340} rx={112} ry={84} color={c} />
      <Spots color={c} pts={[[140, 250, 12], [380, 240, 10], [150, 380, 8]]} />
      <Shine x={190} y={130} />
    </Svg>
  );
}

export function BodyRound({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.round;
  return (
    <Svg className={className}>
      <Feet color={c} />
      <circle cx="256" cy="262" r="204" fill={c} {...O} />
      <Belly cx={256} cy={340} rx={120} ry={90} color={c} />
      <Spots color={c} pts={[[130, 230, 14], [392, 210, 11], [160, 400, 9], [370, 400, 12]]} />
      <Shine x={180} y={120} />
    </Svg>
  );
}

/* ----------------------------------------------------------------- WINGS */

function Mirror({ children }: { children: ReactNode }) {
  return (
    <g>
      {children}
      <g transform="matrix(-1 0 0 1 512 0)">{children}</g>
    </g>
  );
}

export function WingsBat({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.bat;
  return (
    <Svg className={className}>
      <Mirror>
        <path d="M290,250 C330,190 420,130 488,92 Q422,180 482,226 Q404,268 452,322 Q362,348 290,332 Z" fill={c} {...O} />
        <path d="M300,262 L470,110 M300,262 L470,232 M300,262 L440,318" fill="none" stroke={shade(c, -0.35)} strokeWidth="8" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function WingsFeather({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.feather;
  return (
    <Svg className={className}>
      <Mirror>
        <path
          d="M290,250 C330,186 420,124 488,96 C494,140 476,172 452,190 C482,212 478,254 446,268 C468,300 446,332 404,326 C394,352 350,352 290,334 Z"
          fill={c}
          {...O}
        />
        <path d="M304,268 L450,178 M304,276 L428,258 M304,290 L396,318" fill="none" stroke={shade(c, -0.3)} strokeWidth="8" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function WingsTiny({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.tiny;
  return (
    <Svg className={className}>
      <Mirror>
        <path d="M292,246 C318,208 356,190 392,186 Q380,224 372,254 Q352,290 292,300 Z" fill={c} {...O} />
        <path d="M300,262 L372,214 M300,268 L352,268" fill="none" stroke={shade(c, -0.3)} strokeWidth="7" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function WingsButterfly({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.butterfly;
  const c2 = shade(c, 0.35);
  return (
    <Svg className={className}>
      <Mirror>
        <path d="M290,252 C334,140 468,116 482,192 C492,246 424,288 290,292 Z" fill={c} {...O} />
        <path d="M290,292 C382,282 456,300 448,352 C440,398 350,384 290,342 Z" fill={c2} {...O} />
        <circle cx="410" cy="204" r="22" fill={c2} />
        <circle cx="370" cy="336" r="14" fill={c} />
      </Mirror>
    </Svg>
  );
}

/* ----------------------------------------------------------------- HORNS */

export function HornsPointy({ className }: PartSvgProps) {
  const c = '#FFE066';
  return (
    <Svg className={className}>
      <Mirror>
        <path d="M262,430 C262,320 288,220 322,150 C346,220 366,320 366,430 Z" fill={c} {...O} />
        <path d="M282,330 L352,330 M292,270 L342,270" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function HornsCurly({ className }: PartSvgProps) {
  const c = '#F2B266';
  const d = 'M296,420 C296,300 470,300 462,196 C458,126 356,132 352,204';
  return (
    <Svg className={className}>
      <Mirror>
        <path d={d} fill="none" stroke={INK} strokeWidth="60" strokeLinecap="round" />
        <path d={d} fill="none" stroke={c} strokeWidth="34" strokeLinecap="round" />
        <path d="M334,320 L372,344 M396,250 L430,262" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function HornsAntlers({ className }: PartSvgProps) {
  const c = '#D9A066';
  const d = 'M300,430 L322,300 L360,190 M322,300 L400,270 M344,240 L312,170 M360,190 L392,150';
  return (
    <Svg className={className}>
      <Mirror>
        <path d={d} fill="none" stroke={INK} strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={c} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      </Mirror>
    </Svg>
  );
}

export function HornsUnicorn({ className }: PartSvgProps) {
  const c = '#FFD93D';
  return (
    <Svg className={className}>
      <path d="M216,430 L256,96 L296,430 Z" fill={c} {...O} />
      <path d="M232,360 L286,340 M236,300 L280,282 M242,240 L272,228 M248,180 L266,172" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M300,130 L328,100 M310,180 L340,168" fill="none" stroke="#FFB800" strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ EYES */

function Eye({ cx, cy, r, iris = '#3AA0FF', pupil = 0.55, shine = true }: { cx: number; cy: number; r: number; iris?: string; pupil?: number; shine?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" {...O} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={iris} />
      <circle cx={cx} cy={cy} r={r * pupil * 0.62} fill={INK} />
      {shine && <circle cx={cx + r * 0.22} cy={cy - r * 0.24} r={r * 0.16} fill="#fff" />}
      {shine && <circle cx={cx - r * 0.12} cy={cy + r * 0.2} r={r * 0.08} fill="#fff" />}
    </g>
  );
}

export function EyesCute({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Eye cx={166} cy={256} r={74} iris="#7ED957" />
      <Eye cx={346} cy={256} r={74} iris="#7ED957" />
    </Svg>
  );
}

export function EyesFierce({ colors, className }: PartSvgProps) {
  const lid = colors.body || '#7ED957';
  return (
    <Svg className={className}>
      <defs>
        <clipPath id="fierce-l">
          <circle cx="166" cy="262" r="74" />
        </clipPath>
        <clipPath id="fierce-r">
          <circle cx="346" cy="262" r="74" />
        </clipPath>
      </defs>
      <Eye cx={166} cy={262} r={74} iris="#FFB800" pupil={0.5} />
      <Eye cx={346} cy={262} r={74} iris="#FFB800" pupil={0.5} />
      <g clipPath="url(#fierce-l)">
        <path d="M80,170 L260,170 L260,250 L80,196 Z" fill={lid} />
      </g>
      <g clipPath="url(#fierce-r)">
        <path d="M432,170 L252,170 L252,250 L432,196 Z" fill={lid} />
      </g>
      <path d="M86,192 L256,250 M426,192 L256,250" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
    </Svg>
  );
}

export function EyesBig({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Eye cx={160} cy={262} r={96} iris="#A77BFF" pupil={0.5} />
      <Eye cx={352} cy={262} r={96} iris="#A77BFF" pupil={0.5} />
      <path d="M96,178 L76,150 M150,160 L146,124 M204,176 L226,148 M308,176 L286,148 M362,160 L366,124 M416,178 L436,150" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
    </Svg>
  );
}

function starPoints(cx: number, cy: number, rOut: number, rIn: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function EyesStar({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <circle cx="166" cy="256" r="74" fill="#fff" {...O} />
      <circle cx="346" cy="256" r="74" fill="#fff" {...O} />
      <polygon points={starPoints(166, 258, 46, 20)} fill="#FFB800" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      <polygon points={starPoints(346, 258, 46, 20)} fill="#FFB800" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      <circle cx="182" cy="236" r="9" fill="#fff" />
      <circle cx="362" cy="236" r="9" fill="#fff" />
    </Svg>
  );
}

/* ----------------------------------------------------------------- MOUTH */

export function MouthSmile({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M116,222 Q256,352 396,222" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
      <circle cx="96" cy="260" r="18" fill="#FF9AA2" opacity="0.8" />
      <circle cx="416" cy="260" r="18" fill="#FF9AA2" opacity="0.8" />
    </Svg>
  );
}

export function MouthTeeth({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M104,232 Q256,344 408,232" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
      <path d="M160,264 L182,326 L206,276 Z" fill="#fff" {...O} strokeWidth={10} />
      <path d="M306,276 L330,326 L352,264 Z" fill="#fff" {...O} strokeWidth={10} />
    </Svg>
  );
}

export function MouthTongue({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M216,278 C216,350 296,350 296,278 Z" fill="#FF6B78" {...O} strokeWidth={12} />
      <path d="M256,290 L256,330" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M116,222 Q256,352 396,222" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

export function MouthFire({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      {/* flame shooting out to the right */}
      <path d="M250,222 C340,168 450,166 512,256 C450,346 340,344 250,290 Z" fill="#FF8A2A" {...O} strokeWidth={12} />
      <path d="M276,240 C340,210 420,214 458,256 C420,298 340,302 276,272 Z" fill="#FFD93D" />
      <path d="M300,250 C336,238 380,240 400,256 C380,272 336,274 300,262 Z" fill="#fff" opacity="0.8" />
      {/* open mouth */}
      <ellipse cx="190" cy="256" rx="78" ry="62" fill={INK} {...O} strokeWidth={12} />
      <ellipse cx="190" cy="282" rx="50" ry="26" fill="#FF4757" />
      <path d="M150,206 L164,236 L178,206 Z M202,206 L216,236 L230,206 Z" fill="#fff" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ TAIL */

const TAIL_D = 'M56,300 C160,332 250,330 300,250 C350,170 420,150 466,140';

function TailBase({ color }: { color: string }) {
  return (
    <g>
      <path d={TAIL_D} fill="none" stroke={INK} strokeWidth="62" strokeLinecap="round" />
      <path d={TAIL_D} fill="none" stroke={color} strokeWidth="38" strokeLinecap="round" />
    </g>
  );
}

export function TailArrow({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.chubby;
  return (
    <Svg className={className}>
      <TailBase color={c} />
      <path d="M430,92 L512,112 L488,194 Z" fill={shade(c, -0.2)} {...O} />
    </Svg>
  );
}

export function TailHeart({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.chubby;
  return (
    <Svg className={className}>
      <TailBase color={c} />
      <path d="M472,206 C420,166 412,100 462,110 C472,112 480,124 484,134 C488,124 496,112 506,110 C556,100 536,166 472,206 Z" fill="#FF6B78" {...O} />
    </Svg>
  );
}

export function TailSpiky({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.chubby;
  const spike = shade(c, -0.22);
  return (
    <Svg className={className}>
      <path d="M150,300 L168,246 L196,304 Z M230,286 L262,226 L280,276 Z M320,222 L364,176 L370,236 Z" fill={spike} {...O} strokeWidth={10} />
      <TailBase color={c} />
      <path d="M430,92 L512,112 L488,194 Z" fill={spike} {...O} />
    </Svg>
  );
}

export function TailFluffy({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.chubby;
  const puff = '#FFF3C4';
  const circles: [number, number, number][] = [
    [466, 140, 44],
    [426, 116, 30],
    [500, 108, 30],
    [508, 160, 28],
    [446, 186, 30],
    [488, 190, 26],
    [432, 154, 26],
  ];
  return (
    <Svg className={className}>
      <TailBase color={c} />
      <g>
        {circles.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={puff} {...O} strokeWidth={12} />
        ))}
        {circles.map(([x, y, r], i) => (
          <circle key={`i${i}`} cx={x} cy={y} r={r - 1} fill={puff} />
        ))}
      </g>
    </Svg>
  );
}

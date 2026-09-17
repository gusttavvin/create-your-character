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
  body: { classic: '#7ED957', chubby: '#7ED957', tall: '#4FC3FF', spiky: '#FF6B78' } as Record<string, string>,
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

/** One drawn shape plus its exact reflection, so every pair is a true mirror. */
function Mirror({ children }: { children: ReactNode }) {
  return (
    <g>
      {children}
      <g transform="matrix(-1 0 0 1 512 0)">{children}</g>
    </g>
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

/* ------------------------------------------------------------------ fire */

/*
 * The flame's flicker keyframes (dgFlame, dgSpark and the .dg-* classes) live in
 * the global stylesheet. An inline <style> inside the drawing would be repeated
 * once per copy of the art, and its text leaks into the option card's text.
 */

/* ------------------------------------------------------------------ BODY */

/** The dragon proper: spiked crest, snout, neck, chest, clawed feet, tail root. */
export function BodyClassic({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.classic;
  const mid = shade(c, -0.12);
  const dark = shade(c, -0.18);
  const snout = shade(c, 0.12);
  const leg = (
    <g>
      <path d="M300,352 C352,352 382,390 382,424 L382,436 C382,452 362,460 342,456 C306,448 292,410 300,352 Z" fill={mid} {...O} />
      <path d="M336,418 C378,416 408,428 420,446 C428,458 416,470 398,470 L346,470 C330,470 320,458 322,444 Z" fill={mid} {...O} />
      <path d="M360,468 L360,446 M390,464 L386,442" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    </g>
  );
  return (
    <Svg className={className}>
      {/* the tail grows out of this root, low on the right hip */}
      <path d="M300,364 C356,364 410,396 438,442 C404,464 336,460 296,438 Z" fill={dark} {...O} />
      <Mirror>{leg}</Mirror>
      {/* neck */}
      <Mirror>
        <path d="M318,262 L356,268 L316,286 Z M312,310 L348,318 L310,334 Z" fill={dark} {...O} strokeWidth={12} />
      </Mirror>
      <path d="M212,166 C202,226 198,282 194,344 L318,344 C314,282 310,226 300,166 Z" fill={mid} {...O} />
      {/* chest */}
      <path d="M256,312 C338,312 390,352 390,396 C390,438 330,458 256,458 C182,458 122,438 122,396 C122,352 174,312 256,312 Z" fill={c} {...O} />
      <path d="M256,346 C302,346 334,368 334,398 C334,426 300,444 256,444 C212,444 178,426 178,398 C178,368 210,346 256,346 Z" fill={shade(c, 0.45)} />
      <path d="M196,376 L316,376 M182,402 L330,402 M198,428 L314,428" fill="none" stroke={shade(c, 0.1)} strokeWidth="10" strokeLinecap="round" />
      {/* crest of spikes over the skull */}
      <path d="M228,54 L256,-6 L284,54 Z" fill={dark} {...O} />
      <Mirror>
        <path d="M286,50 L330,6 L328,72 Z M330,92 L386,62 L352,122 Z" fill={dark} {...O} />
      </Mirror>
      {/* cheek frills */}
      <Mirror>
        <path d="M330,176 L392,186 L336,208 Z" fill={mid} {...O} strokeWidth={13} />
      </Mirror>
      {/* head */}
      <path d="M256,44 C322,44 358,84 358,132 C358,158 348,180 330,196 C314,216 290,226 256,226 C222,226 198,216 182,196 C164,180 154,158 154,132 C154,84 190,44 256,44 Z" fill={c} {...O} />
      {/* snout */}
      <path d="M200,156 C200,138 222,126 256,126 C290,126 312,138 312,156 C312,214 302,258 282,274 C268,286 244,286 230,274 C210,258 200,214 200,156 Z" fill={snout} {...O} />
      <path d="M218,152 C238,142 274,142 294,152" fill="none" stroke={mid} strokeWidth="9" strokeLinecap="round" />
      <Mirror>
        <ellipse cx="284" cy="170" rx="13" ry="9" fill={INK} transform="rotate(-22 284 170)" />
      </Mirror>
      <Shine x={198} y={88} w={56} h={24} />
    </Svg>
  );
}

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

/** A ring of triangles around a circle, so the whole silhouette bristles. */
function spikeRing(cx: number, cy: number, rIn: number, outs: [number, number], n: number) {
  const step = 360 / n;
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * step - 90;
    const rOut = outs[i % 2];
    const a1 = ((a - step * 0.48) * Math.PI) / 180;
    const a2 = ((a + step * 0.48) * Math.PI) / 180;
    const am = (a * Math.PI) / 180;
    d.push(
      `M${(cx + rIn * Math.cos(a1)).toFixed(1)},${(cy + rIn * Math.sin(a1)).toFixed(1)} ` +
        `L${(cx + rOut * Math.cos(am)).toFixed(1)},${(cy + rOut * Math.sin(am)).toFixed(1)} ` +
        `L${(cx + rIn * Math.cos(a2)).toFixed(1)},${(cy + rIn * Math.sin(a2)).toFixed(1)} Z`,
    );
  }
  return d.join(' ');
}

export function BodySpiky({ colors, className }: PartSvgProps) {
  const c = colors.body || DRAGON_DEFAULTS.body.spiky;
  return (
    <Svg className={className}>
      {/* spikes all the way round, not just along the back */}
      <path d={spikeRing(256, 258, 150, [202, 222], 16)} fill={shade(c, -0.12)} {...O} />
      <circle cx="256" cy="258" r="158" fill={c} {...O} />
      <Belly cx={256} cy={332} rx={102} ry={70} color={c} />
      <path d="M188,296 L324,296 M176,326 L336,326" fill="none" stroke={shade(c, 0.28)} strokeWidth="10" strokeLinecap="round" opacity="0.8" />
      <Spots color={c} pts={[[152, 232, 13], [366, 222, 11], [162, 356, 9]]} />
      <Shine x={196} y={140} />
      <Feet color={c} />
    </Svg>
  );
}

/* ----------------------------------------------------------------- WINGS */

export function WingsBat({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.bat;
  return (
    <Svg className={className}>
      <Mirror>
        {/* leathery membrane: thumb claw, four finger bones, scalloped edge */}
        <path
          d="M288,246 C316,204 364,152 428,106 L450,72 L476,84 L462,114 L506,144 Q440,178 498,214 Q432,240 476,288 Q412,300 434,348 C382,340 328,322 288,302 Z"
          fill={c}
          {...O}
        />
        <path
          d="M296,264 L444,110 M444,110 L502,146 M444,110 L492,216 M444,110 L468,290 M444,110 L430,346 M296,270 L432,346"
          fill="none"
          stroke={shade(c, -0.25)}
          strokeWidth="8"
          strokeLinecap="round"
        />
      </Mirror>
    </Svg>
  );
}

export function WingsFeather({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.feather;
  return (
    <Svg className={className}>
      <Mirror>
        {/* five long blades hang off the bone arm */}
        <path
          d="M436,102 C474,130 498,168 506,206 C470,206 434,178 412,138 Z
             M398,136 C438,168 462,210 468,250 C432,248 398,216 378,174 Z
             M358,172 C398,208 420,252 424,292 C388,288 356,254 338,210 Z
             M318,208 C356,248 376,292 378,332 C344,326 314,290 298,246 Z
             M282,248 C314,286 330,326 330,362 C300,354 276,322 264,284 Z"
          fill={shade(c, 0.35)}
          {...O}
          strokeWidth={13}
        />
        <path
          d="M288,240 C316,196 366,148 428,106 L450,72 L476,84 L462,114 C476,146 466,184 444,220 C412,206 340,232 292,268 Z"
          fill={c}
          {...O}
        />
        <path d="M296,258 L444,110" fill="none" stroke={shade(c, -0.25)} strokeWidth="10" strokeLinecap="round" />
        <path d="M424,122 L452,156 M390,156 L418,190 M354,192 L378,226" fill="none" stroke={shade(c, -0.25)} strokeWidth="8" strokeLinecap="round" />
      </Mirror>
    </Svg>
  );
}

export function WingsTiny({ colors, className }: PartSvgProps) {
  const c = colors.wings || DRAGON_DEFAULTS.wings.tiny;
  return (
    <Svg className={className}>
      <Mirror>
        {/* the same leathery build, only small: three fingers */}
        <path
          d="M292,252 C310,220 338,192 370,170 L382,146 L402,156 L392,180 L424,204 Q392,222 418,250 Q388,268 402,298 C364,300 320,288 292,276 Z"
          fill={c}
          {...O}
        />
        <path d="M298,268 L378,178 M378,178 L420,206 M378,178 L412,252 M378,178 L398,296" fill="none" stroke={shade(c, -0.25)} strokeWidth="8" strokeLinecap="round" />
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
        {/* two leathery lobes with eye spots */}
        <path
          d="M290,240 C316,182 372,126 436,94 L450,64 L476,76 L462,106 C492,148 486,198 456,236 Q420,242 408,216 C372,240 322,254 290,258 Z"
          fill={c}
          {...O}
        />
        <path
          d="M292,268 C344,262 404,272 438,296 C470,320 464,362 428,376 Q406,354 388,362 C356,360 314,326 290,300 Z"
          fill={c2}
          {...O}
        />
        <path d="M298,256 L452,104 M452,104 L474,172 M452,104 L428,206 M298,286 L434,300 M434,300 L424,364" fill="none" stroke={shade(c, -0.35)} strokeWidth="8" strokeLinecap="round" />
        <circle cx="404" cy="158" r="23" fill={c2} stroke={INK} strokeWidth="10" />
        <circle cx="390" cy="318" r="15" fill={c} stroke={INK} strokeWidth="9" />
      </Mirror>
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

/** A jaw thrown open on a row of teeth, with a jet of fire roaring out of it. */
export function MouthFire({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      {/* the gaping jaw */}
      <path d="M110,228 C126,196 156,182 192,182 C230,182 260,198 272,228 C280,272 250,336 190,336 C130,336 104,272 110,228 Z" fill="#4A1020" {...O} />
      <path d="M190,296 C216,296 236,310 240,330 C226,334 208,336 190,336 C172,336 156,334 142,330 C146,310 164,296 190,296 Z" fill="#FF4757" />
      <path d="M124,218 L136,254 L152,212 Z M162,208 L176,250 L192,206 Z M204,206 L218,250 L232,210 Z M242,214 L252,248 L262,222 Z" fill="#fff" {...O} strokeWidth={9} />
      <path d="M136,312 L150,278 L166,314 Z M180,320 L194,282 L210,318 Z M222,312 L234,282 L246,304 Z" fill="#fff" {...O} strokeWidth={9} />
      {/* the fire: three nested tongues that flicker, plus flying sparks */}
      <g transform="translate(232,256)">
        <path
          className="dg-fl"
          d="M2,-62 C58,-108 132,-118 196,-96 C182,-76 184,-66 200,-58 C228,-72 260,-70 284,-54
             C252,-44 246,-32 262,-22 C288,-24 300,-14 300,2 C276,18 254,22 236,18
             C248,34 242,50 224,58 C196,50 178,38 170,24 C150,58 108,74 56,70
             C10,66 -14,34 2,-62 Z"
          fill="#FF7A1A"
          {...O}
          strokeWidth={12}
        />
        <path
          className="dg-fl2"
          d="M10,-40 C58,-76 118,-82 168,-66 C160,-50 162,-42 174,-38 C198,-48 222,-44 238,-32
             C216,-24 212,-16 222,-8 C204,6 182,10 168,6 C176,18 172,30 158,34
             C136,28 124,18 118,8 C100,32 68,44 36,40 C6,36 -4,16 10,-40 Z"
          fill="#FFC400"
        />
        <path
          className="dg-fl2"
          d="M24,-18 C54,-38 92,-42 122,-32 C116,-22 118,-16 126,-14 C110,-4 98,0 88,-2
             C90,6 84,12 74,12 C56,8 44,2 38,-6 C28,4 16,6 10,2 C4,-4 12,-10 24,-18 Z"
          fill="#FFF3C4"
        />
        <circle className="dg-sp" cx="250" cy="-70" r="10" fill="#FF7A1A" />
        <circle className="dg-sp dg-sp2" cx="230" cy="52" r="8" fill="#FFC400" />
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ TAIL */

/** A jagged bolt from root to tip. */
export function TailLightning({ className }: PartSvgProps) {
  const bolt = 'M52,318 L158,286 L110,238 L246,224 L194,170 L340,166 L294,116 L430,96';
  const zig = { fill: 'none', strokeLinejoin: 'miter' as const, strokeLinecap: 'round' as const, strokeMiterlimit: 3 };
  return (
    <Svg className={className}>
      <path d={bolt} stroke={INK} strokeWidth="58" {...zig} />
      <path d="M418,66 L508,58 L438,134 Z" fill="#FFD93D" {...O} />
      <path d={bolt} stroke="#FFD93D" strokeWidth="34" {...zig} />
      <path d="M74,314 L150,290 L120,246 L240,234 L204,180 L330,176" stroke="#FFF3C4" strokeWidth="11" {...zig} />
      <path d="M470,150 L498,154 M392,44 L400,16 M336,72 L318,52" fill="none" stroke="#FFD93D" strokeWidth="12" strokeLinecap="round" />
    </Svg>
  );
}

/** Burning the whole way: three nested tongues of flame with sparks flying off. */
export function TailFire({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path
        className="dg-fl"
        d="M46,318 C110,344 176,338 222,300 C236,318 254,316 262,296 C296,306 320,286 318,254 C346,272 372,258 376,228 C404,244 432,226 430,190 C462,206 490,180 484,138 C500,156 512,150 506,124 C470,80 402,74 356,110 C346,88 324,84 310,100 C280,82 250,100 246,132 C216,112 186,124 178,154 C146,138 116,154 114,190 C82,182 56,206 52,242 C36,258 34,292 46,318 Z"
        fill="#FF7A1A"
        {...O}
      />
      <path
        className="dg-fl2"
        d="M78,308 C130,322 180,314 214,282 C230,296 246,290 250,272 C280,278 296,258 294,232 C318,244 338,230 342,204 C366,214 388,198 386,168 C412,180 436,158 430,124 C398,94 348,94 316,126 C306,110 288,110 278,124 C254,112 232,128 230,154 C204,140 182,152 176,178 C150,168 128,182 126,210 C100,206 80,226 78,254 C66,268 68,292 78,308 Z"
        fill="#FFC400"
      />
      <path
        className="dg-fl2"
        d="M104,296 C150,304 190,294 216,266 C238,278 256,258 256,234 C288,244 306,220 302,192 C332,200 352,178 348,148 C324,132 292,138 274,158 C262,142 242,146 236,164 C214,156 196,170 194,192 C172,186 154,200 152,222 C128,222 112,240 110,262 C102,272 100,286 104,296 Z"
        fill="#FFF3C4"
        opacity="0.9"
      />
      <circle className="dg-sp" cx="470" cy="92" r="11" fill="#FF7A1A" />
      <circle className="dg-sp dg-sp2" cx="410" cy="60" r="8" fill="#FFC400" />
    </Svg>
  );
}

/** A chain of crystal shards, growing colder and sharper toward the tip. */
export function TailIce({ className }: PartSvgProps) {
  const a = '#7FE3FF';
  const b = '#A7EEFF';
  return (
    <Svg className={className}>
      <path d="M41,319 L112,333 L151,273 L80,259 Z" fill={a} {...O} />
      <path d="M121,295 L204,299 L259,237 L176,233 Z" fill={b} {...O} />
      <path d="M209,260 L292,259 L351,200 L268,201 Z" fill={a} {...O} />
      <path d="M285,223 L368,216 L431,161 L348,168 Z" fill={b} {...O} />
      <path d="M355,183 L432,172 L491,125 L416,136 Z" fill={a} {...O} />
      <path d="M414,140 L471,131 L512,96 L461,105 Z" fill="#CFF6FF" {...O} />
      <path d="M80,259 L112,333 M176,233 L204,299 M268,201 L292,259 M348,168 L368,216 M416,136 L432,172" fill="none" stroke="#49B6DA" strokeWidth="8" strokeLinecap="round" />
      <path d="M146,232 L122,186 L182,224 Z M300,184 L286,132 L336,178 Z M262,268 L272,316 L216,278 Z" fill="#CFF6FF" {...O} strokeWidth={12} />
      <path d="M470,72 L478,50 M500,146 L522,148" fill="none" stroke={a} strokeWidth="11" strokeLinecap="round" />
    </Svg>
  );
}

/** A climbing vine: leaves the whole way up and a curl at the tip. */
export function TailLeaf({ className }: PartSvgProps) {
  const vine = '#5FA83F';
  const leaf = '#7ED957';
  const d = 'M56,300 C160,332 250,330 300,250 C350,170 420,150 466,140';
  const curl = 'M470,142 C504,140 516,118 504,100 C494,86 474,92 476,110';
  const Leaf = ({ x, y, s, rot }: { x: number; y: number; s: number; rot: number }) => (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0,46 C-54,8 -44,-52 0,-72 C44,-52 54,8 0,46 Z" fill={leaf} {...O} strokeWidth={SW / s} />
      <path d="M0,40 L0,-62 M0,-8 L-26,-28 M0,-8 L26,-28 M0,18 L-22,2 M0,18 L22,2" fill="none" stroke={shade(leaf, -0.35)} strokeWidth={8 / s} strokeLinecap="round" />
    </g>
  );
  return (
    <Svg className={className}>
      <path d={d} fill="none" stroke={INK} strokeWidth="56" strokeLinecap="round" />
      <path d={d} fill="none" stroke={vine} strokeWidth="32" strokeLinecap="round" />
      <path d={curl} fill="none" stroke={INK} strokeWidth="30" strokeLinecap="round" />
      <path d={curl} fill="none" stroke={vine} strokeWidth="14" strokeLinecap="round" />
      <Leaf x={112} y={326} s={0.46} rot={205} />
      <Leaf x={178} y={336} s={0.56} rot={18} />
      <Leaf x={244} y={314} s={0.64} rot={198} />
      <Leaf x={296} y={256} s={0.74} rot={32} />
      <Leaf x={352} y={196} s={0.84} rot={212} />
      <Leaf x={414} y={160} s={0.95} rot={26} />
    </Svg>
  );
}

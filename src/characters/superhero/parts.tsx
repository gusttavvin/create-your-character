/**
 * Vector parts for the superhero. Same chunky cartoon style as the princess kit.
 *
 * There are two 512x512 coordinate systems and every part sticks to one of them,
 * so the pieces line up by construction:
 *
 *  - HEAD box: face circle r=160 at (256,256); ears at (86,268); eyes at
 *    (162,246) / (350,246); smile under them. Head + masks live here.
 *  - BODY box: neck at y=20..90, shoulders at y=96, torso down to y=304,
 *    hands at (92,272) / (420,272), legs at x=172..238 (mirrored), feet at
 *    y=466. Body, suits, capes, boots and powers live here.
 *
 * Anything that comes in a pair (arms, legs, boots, hands, goggle lenses...) is
 * drawn once for the left side and reflected with <Mirror>, so the two halves
 * are exact mirrors instead of two hand-placed near-copies.
 */
import type { ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 14;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const SUPERHERO_DEFAULTS = {
  skin: '#FCE1C8',
  suit: { classic: '#FF6B78', armour: '#4FC3FF', stripes: '#A77BFF', hoodie: '#2ED8C3' } as Record<string, string>,
  cape: { long: '#A77BFF', short: '#FF8A2A', torn: '#2ED8C3', star: '#4FC3FF' } as Record<string, string>,
};

const suitOf = (colors: Record<string, string>) => colors.suit || SUPERHERO_DEFAULTS.suit.classic;
const capeOf = (colors: Record<string, string>) => colors.cape || SUPERHERO_DEFAULTS.cape.long;
const skinOf = (colors: Record<string, string>) => colors.skin || SUPERHERO_DEFAULTS.skin;

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

/** Draws the child once, then again reflected across the vertical centre line. */
function Mirror({ children }: { children: ReactNode }) {
  return (
    <g>
      {children}
      <g transform="matrix(-1 0 0 1 512 0)">{children}</g>
    </g>
  );
}

/** 5-point star as a polygon "points" string. */
function star(cx: number, cy: number, rOut: number, rIn: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Ellipse as a path, so it can be used as a hole in an evenodd shape. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
}

/* ------------------------------------------------------------------ FACE */
/* Kept apart from the head so the 3D head can project them as decals and the
   2D head can blink the eyes on their own layer. */

export function FaceEyes({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <circle cx="162" cy="246" r="52" fill="#fff" {...O} strokeWidth={12} />
          <circle cx="168" cy="252" r="26" fill={INK} />
          <circle cx="180" cy="238" r="10" fill="#fff" />
          <circle cx="156" cy="264" r="5" fill="#fff" />
        </g>
      </Mirror>
    </Svg>
  );
}

export function FaceMouth({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M164,326 Q256,400 348,326" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

/** Head without the eyes (the 2D stage blinks those on their own layer). */
export function HeadBase({ colors, className }: PartSvgProps) {
  const skin = skinOf(colors);
  return (
    <Svg className={className}>
      <Mirror>
        <circle cx="86" cy="268" r="30" fill={skin} {...O} strokeWidth={12} />
      </Mirror>
      <circle cx="256" cy="256" r="160" fill={skin} {...O} />
      <path
        d="M108,206 C104,112 168,60 256,60 C344,60 408,112 404,206 C368,150 318,132 262,148 C212,164 148,174 108,206 Z"
        fill="#2B1B12"
        {...O}
        strokeWidth={12}
      />
      <path d="M180,110 C214,88 258,84 296,96" fill="none" stroke="#5A4034" strokeWidth="12" strokeLinecap="round" />
      <Mirror>
        <ellipse cx="134" cy="304" rx="30" ry="16" fill="#FF9AA2" opacity="0.75" />
      </Mirror>
      <FaceMouth colors={colors} />
    </Svg>
  );
}

/** The whole friendly head, eyes included, so he is never faceless. */
export function Head(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HeadBase {...props} />
      <FaceEyes {...props} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ BODY */

const ARM_PATH = 'M172,116 C124,146 92,202 92,248';
const LEG_PATH = 'M172,296 L172,442 C172,458 186,466 205,466 C224,466 238,458 238,442 L238,296 Z';
const TORSO_PATH =
  'M256,70 C198,70 160,82 152,98 C142,178 158,252 168,304 L344,304 C354,252 370,178 360,98 C352,82 314,70 256,70 Z';

/** Bare hero: neck, arms, hands and legs. Always drawn, under whatever suit is on. */
export function Body({ colors, className }: PartSvgProps) {
  const skin = skinOf(colors);
  return (
    <Svg className={className}>
      <rect x="226" y="20" width="60" height="76" fill={skin} {...O} strokeWidth={12} />
      <Mirror>
        <g>
          <path d={LEG_PATH} fill={skin} {...O} />
          <path d={ARM_PATH} fill="none" stroke={INK} strokeWidth="48" strokeLinecap="round" />
          <path d={ARM_PATH} fill="none" stroke={skin} strokeWidth="30" strokeLinecap="round" />
          <circle cx="92" cy="272" r="32" fill={skin} {...O} strokeWidth={12} />
        </g>
      </Mirror>
      <path d={TORSO_PATH} fill={skin} {...O} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ SUIT */

/** Leggings, sleeves, gloves and torso, all in the suit colour. */
function SuitBase({ c }: { c: string }) {
  return (
    <g>
      <Mirror>
        <g>
          <path d={LEG_PATH} fill={c} {...O} />
          <path d={ARM_PATH} fill="none" stroke={INK} strokeWidth="48" strokeLinecap="round" />
          <path d={ARM_PATH} fill="none" stroke={c} strokeWidth="30" strokeLinecap="round" />
          <circle cx="92" cy="272" r="32" fill={shade(c, -0.22)} {...O} strokeWidth={12} />
        </g>
      </Mirror>
      <path d={TORSO_PATH} fill={c} {...O} />
    </g>
  );
}

function Belt({ c }: { c: string }) {
  return (
    <g>
      <rect x="158" y="276" width="196" height="42" rx="12" fill={shade(c, -0.32)} {...O} strokeWidth={12} />
      <circle cx="256" cy="297" r="17" fill="#FFD93D" {...O} strokeWidth={9} />
    </g>
  );
}

function Gloss() {
  return <ellipse cx="204" cy="140" rx="26" ry="13" fill="#fff" opacity="0.4" transform="rotate(-22 204 140)" />;
}

export function SuitClassic({ colors, className }: PartSvgProps) {
  const c = suitOf(colors);
  return (
    <Svg className={className}>
      <SuitBase c={c} />
      <path d="M200,74 L256,138 L312,74" fill="none" stroke={shade(c, 0.42)} strokeWidth="16" strokeLinecap="round" />
      <Belt c={c} />
      <Gloss />
    </Svg>
  );
}

export function SuitArmour({ colors, className }: PartSvgProps) {
  const c = suitOf(colors);
  return (
    <Svg className={className}>
      <SuitBase c={c} />
      <path
        d="M170,96 C162,172 174,238 184,288 L328,288 C338,238 350,172 342,96 C318,84 194,84 170,96 Z"
        fill={shade(c, 0.32)}
        {...O}
        strokeWidth={12}
      />
      <path d="M180,178 L332,178 M186,232 L326,232" fill="none" stroke={shade(c, -0.22)} strokeWidth="10" strokeLinecap="round" />
      <Mirror>
        <g>
          <circle cx="166" cy="106" r="46" fill={shade(c, -0.16)} {...O} />
          <circle cx="150" cy="92" r="10" fill="#E4E9F7" />
        </g>
      </Mirror>
      <Belt c={c} />
      <Gloss />
    </Svg>
  );
}

export function SuitStripes({ colors, className }: PartSvgProps) {
  const c = suitOf(colors);
  const s = shade(c, 0.45);
  return (
    <Svg className={className}>
      <SuitBase c={c} />
      <Mirror>
        <path d="M186,80 C176,168 190,250 200,304 L236,304 C226,250 214,168 220,78 Z" fill={s} />
      </Mirror>
      <rect x="240" y="74" width="32" height="230" fill={s} />
      <path d={TORSO_PATH} fill="none" {...O} />
      <Belt c={c} />
      <Gloss />
    </Svg>
  );
}

export function SuitHoodie({ colors, className }: PartSvgProps) {
  const c = suitOf(colors);
  const h = shade(c, -0.14);
  return (
    <Svg className={className}>
      <path d="M120,124 C108,22 178,-46 256,-46 C334,-46 404,22 392,124 C352,70 314,46 256,46 C198,46 160,70 120,124 Z" fill={h} {...O} />
      <SuitBase c={c} />
      <path d="M186,220 L326,220 L312,282 L200,282 Z" fill={h} {...O} strokeWidth={12} />
      <Mirror>
        <g>
          <path d="M214,100 C206,144 208,172 214,192" fill="none" stroke="#F4F6FF" strokeWidth="11" strokeLinecap="round" />
          <circle cx="214" cy="200" r="11" fill="#F4F6FF" {...O} strokeWidth={6} />
        </g>
      </Mirror>
      <path d="M150,84 C190,130 322,130 362,84 C370,116 352,150 318,156 L194,156 C160,150 142,116 150,84 Z" fill={h} {...O} />
      <Belt c={c} />
      <Gloss />
    </Svg>
  );
}

/* ------------------------------------------------------------------ MASK */
/* Head box: the mask sits over the eyes at (162,246) / (350,246). */

export function MaskEye({ colors, className }: PartSvgProps) {
  const c = shade(suitOf(colors), -0.28);
  const band =
    'M84,212 C140,166 372,166 428,212 C424,282 396,308 356,304 C318,300 300,286 256,286 C212,286 194,300 156,304 C116,308 88,282 84,212 Z';
  const holes = `${ellipsePath(162, 246, 58, 44)} ${ellipsePath(512 - 162, 246, 58, 44)}`;
  return (
    <Svg className={className}>
      <path d={`${band} ${holes}`} fillRule="evenodd" fill={c} {...O} strokeWidth={12} />
      <path d="M150,196 C200,178 312,178 362,196" fill="none" stroke={shade(c, 0.35)} strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

export function MaskVisor({ colors, className }: PartSvgProps) {
  const c = shade(suitOf(colors), -0.45);
  return (
    <Svg className={className}>
      <path d="M78,206 C140,158 372,158 434,206 L434,250 C372,304 140,304 78,250 Z" fill={c} {...O} />
      <path d="M118,214 C176,188 336,188 394,214" fill="none" stroke="#8FB8FF" strokeWidth="16" strokeLinecap="round" />
      <ellipse cx="156" cy="238" rx="36" ry="13" fill="#fff" opacity="0.55" transform="rotate(-12 156 238)" />
    </Svg>
  );
}

export function MaskHelmet({ colors, className }: PartSvgProps) {
  const c = shade(suitOf(colors), -0.2);
  return (
    <Svg className={className}>
      <Mirror>
        <circle cx="104" cy="252" r="46" fill={shade(c, -0.18)} {...O} strokeWidth={12} />
      </Mirror>
      <path
        d="M92,272 C84,142 160,60 256,60 C352,60 428,142 420,272 C396,248 372,228 372,196 C340,176 172,176 140,196 C140,228 116,248 92,272 Z"
        fill={c}
        {...O}
      />
      <path d="M228,66 C232,20 244,-12 256,-26 C268,-12 280,20 284,66 Z" fill="#FFD93D" {...O} strokeWidth={12} />
      <path d="M150,118 C186,88 240,80 282,90" fill="none" stroke={shade(c, 0.4)} strokeWidth="12" strokeLinecap="round" />
    </Svg>
  );
}

export function MaskGoggles({ colors, className }: PartSvgProps) {
  const c = shade(suitOf(colors), -0.3);
  const strap = 'M74,244 C120,206 392,206 438,244';
  return (
    <Svg className={className}>
      <path d={strap} fill="none" stroke={INK} strokeWidth="36" strokeLinecap="round" />
      <path d={strap} fill="none" stroke={c} strokeWidth="22" strokeLinecap="round" />
      <Mirror>
        <g>
          <circle cx="162" cy="246" r="76" fill={c} {...O} />
          <circle cx="162" cy="246" r="54" fill="#9BE7FF" {...O} strokeWidth={10} />
          <ellipse cx="144" cy="228" rx="22" ry="10" fill="#fff" opacity="0.75" transform="rotate(-24 144 228)" />
        </g>
      </Mirror>
    </Svg>
  );
}

/* ------------------------------------------------------------------ CAPE */
/* Body box, drawn behind everything; it hangs off the shoulders at y=74. */

function CapeCollar({ c }: { c: string }) {
  return <path d="M150,66 C190,36 322,36 362,66 L372,124 C330,94 182,94 140,124 Z" fill={shade(c, -0.22)} {...O} />;
}

export function CapeLong({ colors, className }: PartSvgProps) {
  const c = capeOf(colors);
  return (
    <Svg className={className}>
      <path d="M172,74 C120,190 96,340 84,480 L428,480 C416,340 392,190 340,74 Z" fill={c} {...O} />
      <path d="M256,96 L256,466" fill="none" stroke={shade(c, -0.22)} strokeWidth="10" strokeLinecap="round" />
      <Mirror>
        <path d="M186,112 C152,240 134,360 126,470" fill="none" stroke={shade(c, -0.14)} strokeWidth="9" strokeLinecap="round" />
      </Mirror>
      <CapeCollar c={c} />
    </Svg>
  );
}

export function CapeShort({ colors, className }: PartSvgProps) {
  const c = capeOf(colors);
  return (
    <Svg className={className}>
      <path d="M172,74 C140,150 122,232 112,300 L400,300 C390,232 372,150 340,74 Z" fill={c} {...O} />
      <path d="M118,286 Q160,254 202,286 Q244,254 286,286 Q328,254 370,286 Q388,268 396,286" fill="none" stroke={shade(c, 0.42)} strokeWidth="11" strokeLinecap="round" />
      <CapeCollar c={c} />
    </Svg>
  );
}

export function CapeTorn({ colors, className }: PartSvgProps) {
  const c = capeOf(colors);
  return (
    <Svg className={className}>
      <path
        d="M172,74 C120,192 98,332 88,466 L128,402 L164,474 L204,398 L248,470 L288,396 L328,468 L362,400 L398,466 C392,330 390,190 340,74 Z"
        fill={c}
        {...O}
      />
      <path d="M244,110 L236,392 M312,120 L324,398" fill="none" stroke={shade(c, -0.2)} strokeWidth="9" strokeLinecap="round" />
      <CapeCollar c={c} />
    </Svg>
  );
}

export function CapeStar({ colors, className }: PartSvgProps) {
  const c = capeOf(colors);
  return (
    <Svg className={className}>
      <path d="M172,74 C122,190 100,340 90,478 L422,478 C412,340 390,190 340,74 Z" fill={c} {...O} />
      <g fill="#FFD93D" stroke={INK} strokeWidth="7" strokeLinejoin="round">
        <polygon points={star(256, 200, 34, 15)} />
        <Mirror>
          <g>
            <polygon points={star(166, 300, 28, 12)} />
            <polygon points={star(140, 420, 22, 10)} />
            <polygon points={star(216, 400, 17, 8)} />
          </g>
        </Mirror>
      </g>
      <CapeCollar c={c} />
    </Svg>
  );
}

/* ---------------------------------------------------------------- EMBLEM */
/* Own 512 box, centred on the chest. */

function EmblemPlate({ c, children }: { c: string; children: ReactNode }) {
  return (
    <g>
      <circle cx="256" cy="256" r="182" fill={shade(c, 0.55)} {...O} />
      {children}
      <ellipse cx="170" cy="144" rx="44" ry="20" fill="#fff" opacity="0.5" transform="rotate(-26 170 144)" />
    </g>
  );
}

export function EmblemStar({ colors, className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <EmblemPlate c={suitOf(colors)}>
        <polygon points={star(256, 268, 150, 68)} fill="#FFD93D" {...O} />
      </EmblemPlate>
    </Svg>
  );
}

export function EmblemBolt({ colors, className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <EmblemPlate c={suitOf(colors)}>
        <path d="M300,92 L166,280 L240,280 L208,420 L344,224 L266,224 Z" fill="#FFD93D" {...O} />
      </EmblemPlate>
    </Svg>
  );
}

export function EmblemHeart({ colors, className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <EmblemPlate c={suitOf(colors)}>
        <path
          d="M256,414 C142,332 98,264 98,204 C98,150 142,114 192,114 C224,114 244,130 256,154 C268,130 288,114 320,114 C370,114 414,150 414,204 C414,264 370,332 256,414 Z"
          fill="#FF6B78"
          {...O}
        />
      </EmblemPlate>
    </Svg>
  );
}

export function EmblemShield({ colors, className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <EmblemPlate c={suitOf(colors)}>
        <path d="M256,96 L406,152 C406,292 340,388 256,424 C172,388 106,292 106,152 Z" fill="#7ED957" {...O} />
        <path d="M256,150 L256,392" fill="none" stroke={shade('#7ED957', -0.3)} strokeWidth="12" strokeLinecap="round" />
      </EmblemPlate>
    </Svg>
  );
}

/* ----------------------------------------------------------------- POWER */
/* Body box: drawn at the left hand (92,272) and mirrored to the right one. */

export function PowerFire({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M92,232 C50,286 20,320 34,368 C48,412 100,420 126,388 C154,354 142,298 92,232 Z" fill="#FF8A2A" {...O} />
          <path d="M92,294 C70,322 54,340 62,364 C72,388 104,388 114,368 C124,346 114,324 92,294 Z" fill="#FFD93D" {...O} strokeWidth={9} />
          <circle cx="146" cy="308" r="13" fill="#FF8A2A" {...O} strokeWidth={7} />
          <circle cx="30" cy="266" r="10" fill="#FFD93D" {...O} strokeWidth={7} />
        </g>
      </Mirror>
    </Svg>
  );
}

export function PowerIce({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M92,236 L44,318 L92,400 L140,318 Z" fill="#9BE7FF" {...O} />
          <path d="M92,252 L92,384 M58,318 L126,318" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
          <path d="M26,382 L44,352 L62,382 L44,412 Z" fill="#E6FAFF" {...O} strokeWidth={9} />
          <path d="M132,378 L146,354 L160,378 L146,402 Z" fill="#E6FAFF" {...O} strokeWidth={9} />
        </g>
      </Mirror>
    </Svg>
  );
}

export function PowerBolt({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M124,230 L32,334 L86,334 L54,418 L150,308 L96,308 Z" fill="#FFD93D" {...O} />
          <path d="M22,262 L2,242 M162,262 L182,242" fill="none" stroke="#FFD93D" strokeWidth="12" strokeLinecap="round" />
        </g>
      </Mirror>
    </Svg>
  );
}

export function PowerStars({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g fill="#FFD93D" stroke={INK} strokeWidth="9" strokeLinejoin="round">
          <polygon points={star(56, 330, 46, 21)} />
          <polygon points={star(132, 372, 30, 14)} />
          <polygon points={star(74, 418, 22, 10)} />
          <polygon points={star(26, 254, 16, 7)} />
        </g>
      </Mirror>
    </Svg>
  );
}

/* ----------------------------------------------------------------- BOOTS */
/* Body box: drawn on the left leg (x 172..238, foot at y=466) and mirrored.
   The toe points outwards, so the mirrored pair never collides in the middle. */

const bootColor = (colors: Record<string, string>) => shade(suitOf(colors), -0.3);

export function BootsTall({ colors, className }: PartSvgProps) {
  const c = bootColor(colors);
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M244,396 L244,448 C244,464 232,472 214,472 L114,472 C98,472 90,462 90,450 C90,434 108,426 136,416 L186,394 Z" fill={c} {...O} />
          <rect x="168" y="340" width="76" height="112" rx="16" fill={c} {...O} />
          <rect x="158" y="322" width="94" height="40" rx="14" fill={shade(c, 0.42)} {...O} strokeWidth={12} />
          <path d="M96,456 L242,456" fill="none" stroke={shade(c, -0.3)} strokeWidth="12" strokeLinecap="round" />
        </g>
      </Mirror>
    </Svg>
  );
}

export function BootsRocket({ colors, className }: PartSvgProps) {
  const c = bootColor(colors);
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M244,404 L244,448 C244,462 232,470 214,470 L122,470 C106,470 98,460 98,448 C98,434 114,426 142,418 L188,402 Z" fill={c} {...O} />
          <rect x="168" y="352" width="76" height="100" rx="16" fill={c} {...O} />
          <path d="M180,470 L230,470 L220,504 L190,504 Z" fill="#B9C6E4" {...O} strokeWidth={12} />
          <path d="M184,504 C184,522 196,532 205,538 C214,532 226,522 226,504 Z" fill="#FF8A2A" {...O} strokeWidth={10} />
          <path d="M194,508 C194,520 202,528 205,532 C208,528 216,520 216,508 Z" fill="#FFD93D" />
          <circle cx="206" cy="392" r="16" fill="#FFD93D" {...O} strokeWidth={9} />
        </g>
      </Mirror>
    </Svg>
  );
}

export function BootsSneakers({ colors, className }: PartSvgProps) {
  const c = bootColor(colors);
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M244,398 L244,442 C244,456 234,464 218,464 L112,464 C98,464 90,456 90,446 C90,430 108,422 136,412 L188,394 Z" fill="#F4F6FF" {...O} />
          <path d="M92,448 L244,448 L244,462 C244,470 236,474 222,474 L112,474 C98,474 90,468 90,458 Z" fill={c} {...O} strokeWidth={12} />
          <path d="M148,412 L188,424 M166,398 L206,410" fill="none" stroke={c} strokeWidth="11" strokeLinecap="round" />
          <path d="M210,400 C222,414 228,428 228,444" fill="none" stroke={c} strokeWidth="12" strokeLinecap="round" />
        </g>
      </Mirror>
    </Svg>
  );
}

export function BootsArmour({ colors, className }: PartSvgProps) {
  const c = bootColor(colors);
  const p = shade(c, 0.34);
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M244,394 L244,448 C244,464 232,472 214,472 L110,472 C94,472 86,462 86,450 C86,434 106,426 134,414 L186,392 Z" fill={c} {...O} />
          <rect x="168" y="336" width="76" height="116" rx="12" fill={c} {...O} />
          <path d="M162,342 L250,342 L250,374 L162,374 Z M160,382 L250,382 L250,412 L160,412 Z" fill={p} {...O} strokeWidth={11} />
          <path d="M100,448 L244,448" fill="none" stroke={p} strokeWidth="14" strokeLinecap="round" />
          <circle cx="206" cy="322" r="30" fill={p} {...O} strokeWidth={12} />
        </g>
      </Mirror>
    </Svg>
  );
}

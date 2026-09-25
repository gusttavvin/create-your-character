/**
 * Vector parts for the fairy. Same chunky cartoon style as the dragon / princess
 * kits: thick ink outlines, flat fills, soft white highlights.
 *
 * Every part lives in a 512x512 box. Head-related parts (head, hair, eyes, crown)
 * share the head's coordinate system: the face is a circle r=170 at (256,256).
 * Body parts (dress) share the princess' body system, so the hands sit at
 * (108,298) and (404,298), and a held item is drawn with its grip at (256,440).
 */
import type { ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 14;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const FAIRY_DEFAULTS = {
  skin: '#FCE1C8',
  dress: { petal: '#7ED957', leaf: '#4FAF3C', star: '#A77BFF', bubble: '#4FC3FF' } as Record<string, string>,
  wings: { butterfly: '#E7C9FF', dragonfly: '#CFE9FF', leaf: '#7ED957', star: '#FFD93D' } as Record<string, string>,
  hair: { long: '#FFC93C', buns: '#F8C63C', curly: '#D2461F', braid: '#8B4513' } as Record<string, string>,
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

/** Draws the child once, then again reflected about x=256, so a pair always matches. */
function Mirror({ children }: { children: ReactNode }) {
  return (
    <g>
      {children}
      <g transform="matrix(-1 0 0 1 512 0)">{children}</g>
    </g>
  );
}

/** Points of a 5-point star. */
function star(cx: number, cy: number, rOut: number, rIn: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** A four-point twinkle, the little sparkle that follows the fairy around. */
function sparkPath(x: number, y: number, r: number) {
  const k = r * 0.22;
  return `M${x},${y - r} Q${x + k},${y - k} ${x + r},${y} Q${x + k},${y + k} ${x},${y + r} Q${x - k},${y + k} ${x - r},${y} Q${x - k},${y - k} ${x},${y - r} Z`;
}

function Sparkles({ pts, color = '#FFF3C4' }: { pts: [number, number, number][]; color?: string }) {
  return (
    <g fill={color} stroke={INK} strokeWidth="6" strokeLinejoin="round">
      {pts.map(([x, y, r], i) => (
        <path key={i} d={sparkPath(x, y, r)} />
      ))}
    </g>
  );
}

function Flower({ x, y, petal, r = 20, heart = '#FFD93D' }: { x: number; y: number; petal: string; r?: number; heart?: string }) {
  const pts = [0, 72, 144, 216, 288].map((a) => [x + r * 1.05 * Math.cos((a * Math.PI) / 180), y + r * 1.05 * Math.sin((a * Math.PI) / 180)]);
  return (
    <g>
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={r * 0.85} fill={petal} {...O} strokeWidth={8} />
      ))}
      <circle cx={x} cy={y} r={r * 0.7} fill={heart} {...O} strokeWidth={8} />
    </g>
  );
}

/* ------------------------------------------------------------------ HEAD */

export function Head({ colors, className }: PartSvgProps) {
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  return (
    <Svg className={className}>
      {/* pointed fairy ears — one drawn, the other is its true mirror */}
      <Mirror>
        <g>
          <path d="M396,212 C442,192 472,162 486,138 C488,214 466,282 412,312 Z" fill={skin} {...O} />
          <path d="M424,236 C444,224 458,208 466,194" fill="none" stroke={shade(skin, -0.28)} strokeWidth="8" strokeLinecap="round" />
        </g>
      </Mirror>
      <circle cx="256" cy="256" r="170" fill={skin} {...O} />
      <ellipse cx="150" cy="336" rx="30" ry="17" fill="#FF9AA2" opacity="0.75" />
      <ellipse cx="362" cy="336" rx="30" ry="17" fill="#FF9AA2" opacity="0.75" />
      {/* the fairy always smiles; she has no mouth category of her own */}
      <path d="M214,322 Q256,362 298,322" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
    </Svg>
  );
}

/* ----------------------------------------------------------------- DRESS */

function Neck({ skin }: { skin: string }) {
  return <rect x="228" y="30" width="56" height="60" fill={skin} {...O} strokeWidth={10} />;
}

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

function Bodice({ color }: { color: string }) {
  return <path d="M182,66 C182,120 184,166 168,192 L344,192 C328,166 330,120 330,66 Z" fill={shade(color, -0.12)} {...O} />;
}

function PuffSleeves({ color, r = 34 }: { color: string; r?: number }) {
  return (
    <Mirror>
      <circle cx="340" cy="94" r={r} fill={color} {...O} />
    </Mirror>
  );
}

/** Little slippers peeking out under the hem — one shoe, mirrored. */
function Slippers({ color, skin, y = 442 }: { color: string; skin: string; y?: number }) {
  return (
    <Mirror>
      <g>
        <path d={`M306,${y} L306,${y + 28}`} fill="none" stroke={INK} strokeWidth="34" strokeLinecap="round" />
        <path d={`M306,${y} L306,${y + 28}`} fill="none" stroke={skin} strokeWidth="20" strokeLinecap="round" />
        <ellipse cx="308" cy={y + 36} rx="38" ry="20" fill={color} {...O} strokeWidth={11} />
        <circle cx="330" cy={y + 28} r="8" fill="#fff" opacity="0.8" />
      </g>
    </Mirror>
  );
}

export function DressPetal({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.petal;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Slippers color={shade(c, -0.28)} skin={skin} />
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M176,192 C168,286 116,368 104,444 L408,444 C396,368 344,286 336,192 Z" fill={shade(c, -0.14)} {...O} />
      <Mirror>
        <ellipse cx="338" cy="348" rx="88" ry="110" transform="rotate(14 338 348)" fill={c} {...O} />
      </Mirror>
      <ellipse cx="256" cy="342" rx="92" ry="114" fill={shade(c, 0.16)} {...O} />
      <ellipse cx="228" cy="292" rx="20" ry="34" fill="#fff" opacity="0.45" transform="rotate(-18 228 292)" />
      <Bodice color={c} />
      <PuffSleeves color={c} />
      <Flower x={256} y={150} petal="#FFF3C4" r={17} heart="#FF8A2A" />
    </Svg>
  );
}

export function DressLeaf({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.leaf;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const vein = shade(c, -0.26);
  return (
    <Svg className={className}>
      <Slippers color={shade(c, -0.3)} skin={skin} y={430} />
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path
        d="M178,192 C166,290 116,372 100,448 L148,412 L186,456 L224,410 L256,452 L288,410 L326,456 L364,412 L412,448 C396,372 346,290 334,192 Z"
        fill={c}
        {...O}
      />
      <g fill="none" stroke={vein} strokeWidth="9" strokeLinecap="round">
        <path d="M256,206 L256,428" />
        <path d="M256,290 L186,376 M256,290 L326,376 M256,354 L204,420 M256,354 L308,420" />
      </g>
      <Bodice color={c} />
      <PuffSleeves color={c} r={32} />
      <Mirror>
        <path d="M292,148 C330,120 366,124 382,132 C356,166 318,174 292,160 Z" fill={shade(c, 0.28)} {...O} strokeWidth={9} />
      </Mirror>
      <ellipse cx="232" cy="300" rx="18" ry="30" fill="#fff" opacity="0.35" transform="rotate(-20 232 300)" />
    </Svg>
  );
}

export function DressStar({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.star;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Slippers color="#FFD93D" skin={skin} />
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M172,192 C152,286 100,368 84,444 L428,444 C412,368 360,286 340,192 Z" fill={c} {...O} />
      <path d="M84,444 Q114,414 144,444 Q174,414 204,444 Q234,414 264,444 Q294,414 324,444 Q354,414 384,444 Q408,418 428,444" fill="none" stroke={shade(c, 0.45)} strokeWidth="12" strokeLinecap="round" />
      <g fill="#FFD93D" stroke={INK} strokeWidth="7" strokeLinejoin="round">
        <polygon points={star(256, 320, 26, 12)} />
        <polygon points={star(172, 392, 22, 10)} />
        <polygon points={star(340, 392, 22, 10)} />
        <polygon points={star(214, 252, 14, 6)} />
        <polygon points={star(298, 252, 14, 6)} />
      </g>
      <Bodice color={c} />
      <PuffSleeves color={c} r={38} />
      <polygon points={star(256, 148, 20, 9)} fill="#FFD93D" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
    </Svg>
  );
}

export function DressBubble({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.bubble;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  return (
    <Svg className={className}>
      <Slippers color={shade(c, -0.28)} skin={skin} y={436} />
      <Neck skin={skin} />
      <Arms skin={skin} />
      <path d="M180,192 C120,240 92,330 128,402 C170,468 342,468 384,402 C420,330 392,240 332,192 Z" fill={c} {...O} />
      <Mirror>
        <g>
          <circle cx="330" cy="336" r="40" fill={shade(c, 0.32)} {...O} strokeWidth={9} />
          <circle cx="318" cy="322" r="11" fill="#fff" opacity="0.9" />
          <circle cx="374" cy="252" r="22" fill={shade(c, 0.32)} {...O} strokeWidth={8} />
        </g>
      </Mirror>
      <circle cx="256" cy="400" r="30" fill={shade(c, 0.32)} {...O} strokeWidth={9} />
      <circle cx="246" cy="388" r="9" fill="#fff" opacity="0.9" />
      <Bodice color={c} />
      <PuffSleeves color={c} r={36} />
      <Sparkles pts={[[256, 150, 18]]} color="#FFF3C4" />
    </Svg>
  );
}

/* ----------------------------------------------------------------- WINGS */
/* Wings are drawn as one right-hand wing and reflected, so the pair is a true mirror. */

export function WingsButterfly({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.butterfly;
  const c2 = shade(c, 0.34);
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M268,262 C300,116 446,84 486,164 C518,240 408,296 268,300 Z" fill={c} {...O} />
          <path d="M268,300 C386,294 468,318 458,378 C448,438 342,418 268,358 Z" fill={c2} {...O} />
          <circle cx="404" cy="196" r="24" fill={c2} {...O} strokeWidth={8} />
          <circle cx="374" cy="356" r="15" fill={c} {...O} strokeWidth={8} />
          <path d="M300,268 C352,208 418,182 466,178" fill="none" stroke={shade(c, -0.3)} strokeWidth="8" strokeLinecap="round" />
        </g>
      </Mirror>
      <Sparkles pts={[[486, 96, 20], [430, 428, 16], [500, 300, 13]]} />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Sparkles pts={[[486, 96, 20], [430, 428, 16], [500, 300, 13]]} />
      </g>
    </Svg>
  );
}

export function WingsDragonfly({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.dragonfly;
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <g transform="rotate(-20 384 208)">
            <ellipse cx="384" cy="208" rx="134" ry="48" fill={c} {...O} />
            <path d="M266,208 L500,208 M290,182 L470,190 M290,234 L470,226" fill="none" stroke={shade(c, -0.32)} strokeWidth="7" strokeLinecap="round" />
          </g>
          <g transform="rotate(14 372 328)">
            <ellipse cx="372" cy="328" rx="116" ry="40" fill={shade(c, 0.26)} {...O} />
            <path d="M268,328 L478,328 M290,308 L456,312 M290,348 L456,344" fill="none" stroke={shade(c, -0.24)} strokeWidth="7" strokeLinecap="round" />
          </g>
        </g>
      </Mirror>
      <Sparkles pts={[[496, 120, 18], [478, 404, 14]]} />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Sparkles pts={[[496, 120, 18], [478, 404, 14]]} />
      </g>
    </Svg>
  );
}

export function WingsLeaf({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.leaf;
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M272,332 C276,214 344,110 468,72 C482,196 416,314 272,346 Z" fill={c} {...O} />
          <path d="M282,340 C346,272 410,196 456,92" fill="none" stroke={shade(c, -0.32)} strokeWidth="11" strokeLinecap="round" />
          <path d="M320,268 L316,180 M366,208 L372,126 M300,304 L280,236 M404,158 L420,104" fill="none" stroke={shade(c, -0.24)} strokeWidth="8" strokeLinecap="round" />
          <path d="M340,246 C384,244 418,222 440,190" fill="none" stroke={shade(c, 0.4)} strokeWidth="9" strokeLinecap="round" />
        </g>
      </Mirror>
      <Sparkles pts={[[490, 180, 18], [420, 60, 14]]} />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Sparkles pts={[[490, 180, 18], [420, 60, 14]]} />
      </g>
    </Svg>
  );
}

export function WingsStar({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.star;
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M268,318 L316,176 L344,254 L400,112 L424,236 L500,186 L468,288 L502,330 L268,348 Z" fill={c} {...O} />
          <path d="M292,312 L440,256 M292,326 L470,310" fill="none" stroke={shade(c, -0.3)} strokeWidth="8" strokeLinecap="round" />
          <polygon points={star(378, 258, 24, 11)} fill={shade(c, 0.45)} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        </g>
      </Mirror>
      <Sparkles pts={[[478, 120, 20], [446, 380, 15], [508, 244, 12]]} />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Sparkles pts={[[478, 120, 20], [446, 380, 15], [508, 244, 12]]} />
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ HAIR */
/* Each style has a Back layer (behind the head) and a Front layer (bangs, in front). */

export function HairLongBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.long;
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
  const c = colors.hair || FAIRY_DEFAULTS.hair.long;
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
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || FAIRY_DEFAULTS.skin} {...O} />
      <HairLongFront {...props} />
    </Svg>
  );
}

export function HairBunsBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.buns;
  return (
    <Svg className={className}>
      {/* one bun drawn, the other is its true mirror */}
      <Mirror>
        <g>
          <circle cx="368" cy="82" r="66" fill={c} {...O} />
          <circle cx="392" cy="58" r="15" fill={shade(c, 0.45)} />
          <path d="M330,122 C352,112 376,112 398,124" fill="none" stroke={shade(c, -0.28)} strokeWidth="9" strokeLinecap="round" />
        </g>
      </Mirror>
      <path d="M256,66 C130,66 66,164 66,282 C66,332 76,352 92,368 L420,368 C436,352 446,332 446,282 C446,164 382,66 256,66 Z" fill={c} {...O} />
    </Svg>
  );
}

export function HairBunsFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.buns;
  return (
    <Svg className={className}>
      <path d="M82,250 C74,150 140,66 256,66 C372,66 438,150 430,250 C400,180 330,166 256,200 C182,166 112,180 82,250 Z" fill={c} {...O} />
      <path d="M150,112 C182,92 220,86 256,88" fill="none" stroke={shade(c, 0.45)} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}

export function HairBuns(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HairBunsBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || FAIRY_DEFAULTS.skin} {...O} />
      <HairBunsFront {...props} />
    </Svg>
  );
}

const CURLS: [number, number, number][] = [
  [110, 120, 54], [170, 70, 54], [256, 46, 58], [342, 70, 54], [402, 120, 54],
  [70, 200, 50], [442, 200, 50], [60, 290, 48], [452, 290, 48], [70, 380, 48], [442, 380, 48],
  [100, 456, 46], [412, 456, 46], [150, 500, 40], [362, 500, 40],
];

export function HairCurlyBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.curly;
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

const FRONT_CURLS: [number, number, number][] = [
  [120, 170, 40], [170, 130, 42], [226, 112, 44], [286, 112, 44], [342, 130, 42], [392, 170, 40],
];

export function HairCurlyFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.curly;
  return (
    <Svg className={className}>
      {FRONT_CURLS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} {...O} strokeWidth={12} />
      ))}
      {FRONT_CURLS.map(([x, y, r], i) => (
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
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || FAIRY_DEFAULTS.skin} {...O} />
      <HairCurlyFront {...props} />
    </Svg>
  );
}

/** One braid, draped over her shoulder (it is a single braid, so it is not mirrored). */
function BraidRope({ x, color, ribbon }: { x: number; color: string; ribbon: string }) {
  const beads = [300, 352, 404, 456, 508];
  return (
    <g>
      {beads.map((y, i) => (
        <circle key={y} cx={x + (i % 2 === 0 ? -9 : 9)} cy={y} r="32" fill={color} {...O} strokeWidth={12} />
      ))}
      <path d={`M${x - 28},${beads[0] - 34} L${x + 28},${beads[0] - 34} L${x},${beads[0] - 62} Z M${x - 28},${beads[0] - 34} L${x + 28},${beads[0] - 34} L${x},${beads[0] - 6} Z`} fill={ribbon} {...O} strokeWidth={9} />
    </g>
  );
}

export function HairBraidBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.braid;
  return (
    <Svg className={className}>
      <path d="M256,50 C130,50 66,154 66,274 C66,338 82,372 104,392 L408,392 C430,372 446,338 446,274 C446,154 382,50 256,50 Z" fill={c} {...O} />
      <BraidRope x={402} color={c} ribbon="#FF6EC7" />
    </Svg>
  );
}

export function HairBraidFront({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.braid;
  return (
    <Svg className={className}>
      <path d="M80,272 C70,152 140,56 256,56 C372,56 442,152 432,272 C418,202 372,162 312,178 C280,146 226,146 188,182 C140,178 96,214 80,272 Z" fill={c} {...O} />
      <path d="M236,78 C268,104 300,126 336,140" fill="none" stroke={shade(c, 0.42)} strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
}

export function HairBraid(props: PartSvgProps) {
  return (
    <Svg className={props.className}>
      <HairBraidBack {...props} />
      <circle cx="256" cy="256" r="170" fill={props.colors.skin || FAIRY_DEFAULTS.skin} {...O} />
      <HairBraidFront {...props} />
    </Svg>
  );
}

export const HAIR_LAYERS: Record<string, { Back: (p: PartSvgProps) => ReactNode; Front: (p: PartSvgProps) => ReactNode }> = {
  long: { Back: HairLongBack, Front: HairLongFront },
  buns: { Back: HairBunsBack, Front: HairBunsFront },
  curly: { Back: HairCurlyBack, Front: HairCurlyFront },
  braid: { Back: HairBraidBack, Front: HairBraidFront },
};

/* ----------------------------------------------------------------- CROWN */
/* Crown art sits with its base at y=430 so it can rest on top of the head. */

const VINE = 'M90,430 Q256,300 422,430';

function Vine({ color = '#7ED957' }: { color?: string }) {
  return (
    <g>
      <path d={VINE} fill="none" stroke={INK} strokeWidth="44" strokeLinecap="round" />
      <path d={VINE} fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" />
    </g>
  );
}

export function CrownFlower({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Vine />
      <Mirror>
        <g>
          <Flower x={382} y={412} petal="#FF6EC7" />
          <Flower x={316} y={366} petal="#FFF3C4" />
        </g>
      </Mirror>
      <Flower x={256} y={348} petal="#FF6B78" r={25} />
      <Sparkles pts={[[256, 286, 16]]} />
    </Svg>
  );
}

export function CrownLeaf({ className }: PartSvgProps) {
  const c = '#7ED957';
  return (
    <Svg className={className}>
      <Vine color="#4FAE4A" />
      <Mirror>
        <g>
          <path d="M320,364 C356,330 400,326 424,334 C396,382 346,392 318,378 Z" fill={c} {...O} strokeWidth={10} />
          <path d="M326,372 C356,354 388,346 414,344" fill="none" stroke={shade(c, -0.32)} strokeWidth="7" strokeLinecap="round" />
          <path d="M386,410 C412,386 446,382 464,388 C444,424 406,432 384,420 Z" fill={shade(c, 0.22)} {...O} strokeWidth={10} />
        </g>
      </Mirror>
      <path d="M256,332 C226,300 226,258 242,232 C278,254 288,300 274,332 Z" fill={c} {...O} strokeWidth={10} />
      <path d="M260,330 C250,296 248,266 246,242" fill="none" stroke={shade(c, -0.32)} strokeWidth="7" strokeLinecap="round" />
    </Svg>
  );
}

export function CrownStar({ className }: PartSvgProps) {
  const d = 'M96,430 Q256,334 416,430';
  return (
    <Svg className={className}>
      <path d={d} fill="none" stroke={INK} strokeWidth="50" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#FFD93D" strokeWidth="26" strokeLinecap="round" />
      <Mirror>
        <g>
          <polygon points={star(344, 344, 34, 15)} fill="#FFF3C4" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
          <polygon points={star(420, 392, 24, 11)} fill="#FFD93D" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
        </g>
      </Mirror>
      <polygon points={star(256, 300, 48, 21)} fill="#FFD93D" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
      <circle cx="240" cy="288" r="10" fill="#fff" />
    </Svg>
  );
}

export function CrownBerry({ className }: PartSvgProps) {
  const berry = '#FF6B78';
  return (
    <Svg className={className}>
      <Vine color="#5FA84F" />
      <Mirror>
        <g>
          <circle cx="392" cy="404" r="21" fill={berry} {...O} strokeWidth={9} />
          <circle cx="360" cy="378" r="19" fill={shade(berry, -0.18)} {...O} strokeWidth={9} />
          <circle cx="322" cy="362" r="22" fill={berry} {...O} strokeWidth={9} />
          <circle cx="386" cy="396" r="7" fill="#fff" opacity="0.85" />
          <path d="M288,352 C306,330 336,326 350,332 C332,360 304,364 288,352 Z" fill="#7ED957" {...O} strokeWidth={9} />
        </g>
      </Mirror>
      <circle cx="256" cy="344" r="26" fill={berry} {...O} strokeWidth={9} />
      <circle cx="246" cy="332" r="8" fill="#fff" opacity="0.85" />
      <path d="M256,318 L256,296 M256,300 C244,286 250,272 262,276" fill="none" stroke="#5FA84F" strokeWidth="10" strokeLinecap="round" />
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
      <Mirror>
        <SparkleEye cx={362} cy={262} iris="#7ED957" />
      </Mirror>
      <Sparkles pts={[[256, 196, 14]]} />
    </Svg>
  );
}

export function EyesHappy({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <ClosedHappy cx={362} cy={262} />
      </Mirror>
    </Svg>
  );
}

export function EyesWink({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <SparkleEye cx={150} cy={262} iris="#7ED957" />
      <ClosedHappy cx={362} cy={262} />
      <Sparkles pts={[[420, 196, 16]]} />
    </Svg>
  );
}

export function EyesBig({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <SparkleEye cx={356} cy={264} r={86} iris="#A77BFF" />
          <path d="M296,182 L282,152 M356,164 L356,130 M416,182 L432,154" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
        </g>
      </Mirror>
    </Svg>
  );
}

/** The fairy has no mouth category; this smile is baked into the 2D head and
 *  projected onto the 3D head as a decal. */
export function Smile({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <path d="M150,226 Q256,326 362,226" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ WAND */
/* Art is drawn so the "grip" point is at (256, 440), where the hand holds it. */

function Stick({ color, from = 440, to = 200 }: { color: string; from?: number; to?: number }) {
  return (
    <g>
      <path d={`M256,${from} L256,${to}`} fill="none" stroke={INK} strokeWidth="36" strokeLinecap="round" />
      <path d={`M256,${from} L256,${to}`} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
    </g>
  );
}

export function WandStar({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#FFE066" to={190} />
      <polygon points={star(256, 152, 82, 38)} fill="#FFD93D" {...O} />
      <circle cx="240" cy="134" r="11" fill="#fff" />
      <Sparkles pts={[[368, 88, 22], [146, 108, 18], [352, 200, 14], [156, 210, 13]]} />
    </Svg>
  );
}

export function WandFlower({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#7ED957" to={200} />
      <Mirror>
        <path d="M262,300 C300,278 336,282 352,292 C324,326 286,330 262,314 Z" fill="#7ED957" {...O} strokeWidth={10} />
      </Mirror>
      <Flower x={256} y={158} petal="#FF6EC7" r={48} heart="#FFD93D" />
      <Sparkles pts={[[368, 96, 20], [148, 116, 16]]} />
    </Svg>
  );
}

export function WandMoon({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#A77BFF" to={210} />
      <path d="M256,84 A78,78 0 1,0 256,240 A62,62 0 1,1 256,84 Z" fill="#FFD93D" {...O} />
      <circle cx="230" cy="122" r="10" fill="#fff" />
      <Sparkles pts={[[360, 116, 20], [146, 140, 16], [332, 206, 13]]} />
    </Svg>
  );
}

export function WandBubble({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#4FC3FF" to={230} />
      <circle cx="256" cy="166" r="66" fill="none" stroke={INK} strokeWidth="38" />
      <circle cx="256" cy="166" r="66" fill="none" stroke="#4FC3FF" strokeWidth="20" />
      <Mirror>
        <g>
          <circle cx="366" cy="96" r="34" fill="#BFE9FF" opacity="0.85" stroke={INK} strokeWidth="9" />
          <circle cx="354" cy="82" r="10" fill="#fff" />
          <circle cx="344" cy="206" r="20" fill="#BFE9FF" opacity="0.85" stroke={INK} strokeWidth="8" />
        </g>
      </Mirror>
      <circle cx="256" cy="54" r="24" fill="#BFE9FF" opacity="0.85" stroke={INK} strokeWidth="9" />
      <circle cx="248" cy="46" r="8" fill="#fff" />
    </Svg>
  );
}

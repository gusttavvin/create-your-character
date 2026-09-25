/**
 * Vector parts for the fairy, drawn to match the modelled fairy in 3D
 * (`public/models/fadinha.glb`): a big round head with huge green eyes, golden hair
 * with a swept fringe and two buns, a green sweetheart top with a dark belt, a skirt of
 * pointed petals, slim arms and legs, pink ballet flats and see-through lilac wings.
 *
 * The line is thinner than the other kits and the fills are shaded, so the drawing reads
 * as the same doll as the model rather than a flat sticker of her.
 *
 * Every part lives in a 512x512 box. Head-related parts (head, hair, eyes, crown)
 * share the head's coordinate system: the face is a circle r=170 at (256,256).
 * Body parts (dress) share one body system: the hands hang at (150,258) and (362,258),
 * and a held item is drawn with its grip at (256,440).
 */
import { useId, type ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import { INK, shade } from '../../lib/color';

const SW = 10;
const O = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const FAIRY_DEFAULTS = {
  skin: '#FCE1C8',
  dress: { petal: '#7ED957', leaf: '#4FAF3C', star: '#A77BFF', bubble: '#4FC3FF' } as Record<string, string>,
  wings: { butterfly: '#E7C9FF', dragonfly: '#CFE9FF', leaf: '#7ED957', star: '#FFD93D' } as Record<string, string>,
  hair: { long: '#FFC93C', buns: '#F8C63C', curly: '#D2461F', braid: '#8B4513' } as Record<string, string>,
};

/** Her ballet flats, the pink of the model's. */
const FLATS = '#E2408A';
/** Her brows and lashes are brown, not ink, as on the model. */
const BROW = '#7A4A2A';

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

/**
 * Ids for this drawing's gradients. The same part is on the page many times (the sheet
 * and every card in the palette), so each copy needs ids of its own.
 */
function useIds<const K extends string>(...names: K[]): Record<K, string> {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return Object.fromEntries(names.map((n) => [n, `fairy${base}${n}`])) as Record<K, string>;
}

const url = (id: string) => `url(#${id})`;

/** A soft top-to-bottom shading, light where the light falls on her. */
function Down({ id, color, y1, y2, lift = 0.28, drop = -0.1 }: { id: string; color: string; y1: number; y2: number; lift?: number; drop?: number }) {
  return (
    <linearGradient id={id} x1="0" y1={y1} x2="0" y2={y2} gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor={shade(color, lift)} />
      <stop offset="0.55" stopColor={color} />
      <stop offset="1" stopColor={shade(color, drop)} />
    </linearGradient>
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

function Flower({ x, y, petal, r = 20, heart = '#FFD93D', line = 8 }: { x: number; y: number; petal: string; r?: number; heart?: string; line?: number }) {
  const pts = [0, 72, 144, 216, 288].map((a) => [x + r * 1.05 * Math.cos(((a - 90) * Math.PI) / 180), y + r * 1.05 * Math.sin(((a - 90) * Math.PI) / 180)]);
  return (
    <g>
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={r * 0.85} fill={petal} {...O} strokeWidth={line} />
      ))}
      <circle cx={x} cy={y} r={r * 0.62} fill={heart} {...O} strokeWidth={line} />
    </g>
  );
}

/**
 * A pointed leaf from `b` to `t`, `hw` wide at its fullest: the shape of one petal of
 * her skirt, one leaf of the leaf dress and the panes of the leaf wings.
 */
function leaf(b: [number, number], t: [number, number], hw: number) {
  const [bx, by] = b;
  const [tx, ty] = t;
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * hw * 2;
  const ny = (dx / len) * hw * 2;
  const mx = bx + dx * 0.5;
  const my = by + dy * 0.5;
  const f = (n: number) => n.toFixed(1);
  return `M${bx},${by} Q${f(mx + nx)},${f(my + ny)} ${tx},${ty} Q${f(mx - nx)},${f(my - ny)} ${bx},${by} Z`;
}

/* ------------------------------------------------------------------ HEAD */

export function Head({ colors, className }: PartSvgProps) {
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const id = useIds('face', 'blush');
  return (
    <Svg className={className}>
      <defs>
        <radialGradient id={id.face} cx="42%" cy="34%" r="72%">
          <stop offset="0" stopColor={shade(skin, 0.4)} />
          <stop offset="0.6" stopColor={skin} />
          <stop offset="1" stopColor={shade(skin, -0.1)} />
        </radialGradient>
        <radialGradient id={id.blush}>
          <stop offset="0" stopColor="#FF8FA3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FF8FA3" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* little pointed fairy ears — one drawn, the other is its true mirror */}
      <Mirror>
        <g>
          <path d="M404,236 C438,222 466,196 484,164 C490,228 470,284 418,306 Z" fill={skin} {...O} />
          <path d="M428,250 C446,238 460,220 470,200" fill="none" stroke={shade(skin, -0.25)} strokeWidth="7" strokeLinecap="round" />
        </g>
      </Mirror>
      <circle cx="256" cy="256" r="170" fill={url(id.face)} {...O} />
      <Mirror>
        <g>
          <ellipse cx="366" cy="338" rx="42" ry="26" fill={url(id.blush)} />
          {/* a thin brown brow, as on the model */}
          <path d="M296,196 Q338,176 382,190" fill="none" stroke={BROW} strokeWidth="9" strokeLinecap="round" />
        </g>
      </Mirror>
      {/* a button nose */}
      <path d="M248,326 Q256,334 264,326" fill="none" stroke={shade(skin, -0.35)} strokeWidth="7" strokeLinecap="round" />
      {/* the fairy always smiles; she has no mouth category of her own */}
      <path d="M224,352 Q256,390 288,352 Q256,364 224,352 Z" fill="#E0566E" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
    </Svg>
  );
}

/* ----------------------------------------------------------------- BODY */
/* One body under every dress: slim arms and legs, and the bare shoulders the
   sweetheart top leaves. Only the top, the belt and the skirt change with the dress. */

/** Her slim legs and ballet flats, under the skirt. */
function Legs({ skin }: { skin: string }) {
  const d = 'M238,296 L236,428 M274,296 L276,428';
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth="34" strokeLinecap="round" />
      <path d={d} fill="none" stroke={skin} strokeWidth="22" strokeLinecap="round" />
      <Mirror>
        <g>
          <path d="M254,438 C254,422 300,420 306,436 C310,452 294,460 280,460 C264,460 252,452 254,438 Z" fill={FLATS} {...O} strokeWidth={9} />
          <ellipse cx="279" cy="432" rx="13" ry="5" fill={shade(FLATS, -0.4)} />
          <circle cx="294" cy="446" r="4.5" fill="#fff" opacity="0.8" />
        </g>
      </Mirror>
    </g>
  );
}

/** Arms hanging easy at her sides, a small hand at the end of each. */
function Arms({ skin }: { skin: string }) {
  const d = 'M298,138 C328,164 350,208 360,244';
  return (
    <Mirror>
      <g>
        <path d={d} fill="none" stroke={INK} strokeWidth="34" strokeLinecap="round" />
        <path d={d} fill="none" stroke={skin} strokeWidth="22" strokeLinecap="round" />
        <circle cx="362" cy="258" r="17" fill={skin} {...O} strokeWidth={9} />
      </g>
    </Mirror>
  );
}

/** Neck and shoulders; the head sits over the top of them. */
function Torso({ skin }: { skin: string }) {
  return (
    <path
      d="M234,86 L278,86 L280,116 C302,118 316,128 318,146 L312,208 L200,208 L194,146 C196,128 210,118 232,116 Z"
      fill={skin}
      {...O}
    />
  );
}

/** The sweetheart top: two soft curves at the neckline, fitted to the waist. */
function Bodice({ color, fill }: { color: string; fill: string }) {
  return (
    <g>
      <path
        d="M198,152 C204,136 222,132 236,140 C246,146 252,152 256,160 C260,152 266,146 276,140 C290,132 308,136 314,152 L310,206 L202,206 Z"
        fill={fill}
        {...O}
      />
      <path d="M212,156 C218,148 228,146 236,150" fill="none" stroke={shade(color, 0.5)} strokeWidth="7" strokeLinecap="round" />
    </g>
  );
}

/** The belt at her waist, with its round buckle. */
function Belt({ color, buckle = '#FFD166' }: { color: string; buckle?: string }) {
  return (
    <g>
      <path d="M200,198 L312,198 L314,220 L198,220 Z" fill={color} {...O} strokeWidth={9} />
      <circle cx="256" cy="209" r="13" fill={buckle} {...O} strokeWidth={7} />
      <circle cx="252" cy="205" r="4" fill="#fff" opacity="0.8" />
    </g>
  );
}

/** Everything under the dress, in the order it stacks: legs, then the skirt, then arms and top. */
function Figure({ skin, skirt, top }: { skin: string; skirt: ReactNode; top: ReactNode }) {
  return (
    <>
      <Legs skin={skin} />
      {skirt}
      <Arms skin={skin} />
      <Torso skin={skin} />
      {top}
    </>
  );
}

/* ----------------------------------------------------------------- DRESS */

/** The petal skirt of the model: a back row of dark petals, a front row of light ones. */
const BACK_PETALS: [number, number, number, number][] = [
  [214, 204, 146, 298], [234, 204, 194, 326], [256, 204, 256, 336], [278, 204, 318, 326], [298, 204, 366, 298],
];
const FRONT_PETALS: [number, number, number, number][] = [
  [222, 206, 170, 316], [244, 206, 226, 332], [268, 206, 286, 332], [290, 206, 342, 316],
];

export function DressPetal({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.petal;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const id = useIds('top', 'front', 'back');
  const vein = shade(c, -0.28);
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.top} color={c} y1={134} y2={208} />
        <Down id={id.front} color={c} y1={206} y2={334} lift={0.3} drop={-0.06} />
        <Down id={id.back} color={shade(c, -0.2)} y1={206} y2={334} lift={0.12} />
      </defs>
      <Figure
        skin={skin}
        skirt={
          <g>
            {BACK_PETALS.map(([bx, by, tx, ty], i) => (
              <path key={i} d={leaf([bx, by], [tx, ty], 36)} fill={url(id.back)} {...O} />
            ))}
            {FRONT_PETALS.map(([bx, by, tx, ty], i) => (
              <g key={i}>
                <path d={leaf([bx, by], [tx, ty], 34)} fill={url(id.front)} {...O} />
                <path d={`M${bx},${by + 20} L${bx + (tx - bx) * 0.72},${by + (ty - by) * 0.72}`} fill="none" stroke={vein} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
              </g>
            ))}
          </g>
        }
        top={
          <>
            <Bodice color={c} fill={url(id.top)} />
            <Belt color={shade(c, -0.5)} />
          </>
        }
      />
    </Svg>
  );
}

/** Long leaves, the middle ones longest, hanging from a vine belt. */
const LEAVES: [number, number, number, number, number][] = [
  [216, 204, 150, 318, 30], [236, 204, 196, 346, 30], [256, 204, 256, 356, 30], [276, 204, 316, 346, 30], [296, 204, 362, 318, 30],
];

export function DressLeaf({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.leaf;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const id = useIds('top', 'a', 'b');
  const vein = shade(c, -0.32);
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.top} color={c} y1={134} y2={208} />
        <Down id={id.a} color={c} y1={206} y2={356} lift={0.3} />
        <Down id={id.b} color={shade(c, 0.22)} y1={206} y2={356} lift={0.3} />
      </defs>
      <Figure
        skin={skin}
        skirt={
          <g>
            {/* the outer leaves behind, the middle ones in front */}
            {[0, 4, 1, 3, 2].map((i) => {
              const [bx, by, tx, ty, hw] = LEAVES[i];
              const mx = (bx + tx) / 2;
              const my = (by + ty) / 2;
              return (
                <g key={i}>
                  <path d={leaf([bx, by], [tx, ty], hw)} fill={url(i % 2 ? id.b : id.a)} {...O} />
                  <path d={`M${bx},${by + 18} L${bx + (tx - bx) * 0.8},${by + (ty - by) * 0.8}`} fill="none" stroke={vein} strokeWidth="5" strokeLinecap="round" />
                  <path d={`M${mx},${my} l-14,-16 M${mx},${my} l14,-16`} fill="none" stroke={vein} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                </g>
              );
            })}
          </g>
        }
        top={
          <>
            <Bodice color={c} fill={url(id.top)} />
            <Belt color={shade(c, -0.45)} buckle={shade(c, 0.35)} />
            <path d="M256,209 C236,190 218,190 208,196 C222,214 240,216 256,209 Z" fill={shade(c, 0.3)} {...O} strokeWidth={7} />
          </>
        }
      />
    </Svg>
  );
}

export function DressStar({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.star;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const id = useIds('top', 'skirt');
  // a bell of a skirt with a scalloped hem, six rounded bumps across
  let hem = '';
  for (let i = 0; i < 6; i++) {
    const x0 = 136 + i * 40;
    hem += ` Q${x0 + 20},${344} ${x0 + 40},${318}`;
  }
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.top} color={c} y1={134} y2={208} />
        <Down id={id.skirt} color={c} y1={206} y2={340} lift={0.32} />
      </defs>
      <Figure
        skin={skin}
        skirt={
          <g>
            <path d={`M206,206 C188,244 152,282 136,318${hem} C360,282 324,244 306,206 Z`} fill={url(id.skirt)} {...O} />
            <path d="M150,312 Q256,290 362,312" fill="none" stroke={shade(c, 0.5)} strokeWidth="7" strokeLinecap="round" opacity="0.8" />
            <g fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round">
              <polygon points={star(256, 280, 20, 9)} />
              <polygon points={star(190, 300, 15, 7)} />
              <polygon points={star(322, 300, 15, 7)} />
              <polygon points={star(222, 244, 11, 5)} />
              <polygon points={star(290, 244, 11, 5)} />
            </g>
          </g>
        }
        top={
          <>
            <Bodice color={c} fill={url(id.top)} />
            <Belt color="#FFD93D" buckle="#FFF3C4" />
            <polygon points={star(256, 209, 15, 7)} fill="#FFD93D" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          </>
        }
      />
    </Svg>
  );
}

export function DressBubble({ colors, className }: PartSvgProps) {
  const c = colors.dress || FAIRY_DEFAULTS.dress.bubble;
  const skin = colors.skin || FAIRY_DEFAULTS.skin;
  const id = useIds('top', 'skirt');
  const light = shade(c, 0.4);
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.top} color={c} y1={134} y2={208} />
        <radialGradient id={id.skirt} cx="40%" cy="30%" r="75%">
          <stop offset="0" stopColor={shade(c, 0.45)} />
          <stop offset="0.6" stopColor={c} />
          <stop offset="1" stopColor={shade(c, -0.14)} />
        </radialGradient>
      </defs>
      <Figure
        skin={skin}
        skirt={
          <g>
            <path d="M206,204 C150,222 128,284 152,314 C184,346 328,346 360,314 C384,284 362,222 306,204 Z" fill={url(id.skirt)} {...O} />
            <path d="M166,318 Q256,342 346,318" fill="none" stroke={shade(c, -0.25)} strokeWidth="6" strokeLinecap="round" />
            <Mirror>
              <g>
                <circle cx="318" cy="276" r="22" fill={light} {...O} strokeWidth={7} opacity="0.9" />
                <circle cx="311" cy="268" r="6" fill="#fff" />
                <circle cx="340" cy="236" r="12" fill={light} {...O} strokeWidth={6} opacity="0.9" />
              </g>
            </Mirror>
            <circle cx="256" cy="298" r="18" fill={light} {...O} strokeWidth={7} opacity="0.9" />
            <circle cx="250" cy="291" r="5" fill="#fff" />
          </g>
        }
        top={
          <>
            <Bodice color={c} fill={url(id.top)} />
            <Belt color={shade(c, -0.35)} buckle={light} />
          </>
        }
      />
    </Svg>
  );
}

/* ----------------------------------------------------------------- WINGS */
/* Wings are drawn as one right-hand wing and reflected, so the pair is a true mirror.
   Like the model's, they are panes you can see through, pale at the root and deeper at
   the edge, with fine veins and a pearly shine along the top. */

function WingDefs({ id, c }: { id: string; c: string }) {
  return (
    <radialGradient id={id} cx="268" cy="252" r="250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor={shade(c, 0.7)} />
      <stop offset="0.55" stopColor={shade(c, 0.2)} />
      <stop offset="1" stopColor={shade(c, -0.12)} />
    </radialGradient>
  );
}

function Pane({ d, fill, c }: { d: string; fill: string; c: string }) {
  return <path d={d} fill={fill} fillOpacity="0.78" stroke={shade(c, -0.5)} strokeWidth="7" strokeLinejoin="round" />;
}

function Veins({ d, c, w = 4 }: { d: string; c: string; w?: number }) {
  return <path d={d} fill="none" stroke={shade(c, -0.32)} strokeWidth={w} strokeLinecap="round" opacity="0.75" />;
}

function Shine({ d }: { d: string }) {
  return <path d={d} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.7" />;
}

function WingSparkles({ pts }: { pts: [number, number, number][] }) {
  return (
    <>
      <Sparkles pts={pts} />
      <g transform="matrix(-1 0 0 1 512 0)">
        <Sparkles pts={pts} />
      </g>
    </>
  );
}

export function WingsButterfly({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.butterfly;
  const id = useIds('pane');
  return (
    <Svg className={className}>
      <defs>
        <WingDefs id={id.pane} c={c} />
      </defs>
      <Mirror>
        <g>
          {/* the long upper pane, reaching up and out */}
          <Pane c={c} fill={url(id.pane)} d="M266,250 C282,192 332,126 402,98 C452,78 492,94 486,134 C478,186 420,236 330,258 C306,264 284,264 266,258 Z" />
          <Veins c={c} d="M272,252 C330,212 400,154 462,112 M318,232 C356,216 404,196 452,168 M296,240 C318,190 348,148 388,112" />
          <Shine d="M300,196 C336,146 386,114 440,102" />
          {/* and the short lower one, towards her skirt */}
          <Pane c={c} fill={url(id.pane)} d="M268,262 C314,266 374,290 400,330 C422,366 406,398 372,392 C330,384 290,332 268,278 Z" />
          <Veins c={c} d="M274,270 C318,302 354,342 380,380 M300,286 C332,298 364,318 390,346" />
        </g>
      </Mirror>
      <WingSparkles pts={[[470, 420, 12]]} />
    </Svg>
  );
}

export function WingsDragonfly({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.dragonfly;
  const id = useIds('pane');
  return (
    <Svg className={className}>
      <defs>
        <WingDefs id={id.pane} c={c} />
      </defs>
      <Mirror>
        <g>
          <g transform="rotate(-22 384 206)">
            <Pane c={c} fill={url(id.pane)} d="M262,206 C300,170 440,160 508,196 C520,210 512,226 494,230 C430,248 300,240 262,206 Z" />
            <Veins c={c} d="M270,206 L500,206 M300,190 L480,194 M300,224 L470,220 M340,184 L352,232 M400,184 L410,236 M456,190 L462,228" />
            <Shine d="M300,186 C360,174 430,172 480,186" />
          </g>
          <g transform="rotate(16 372 330)">
            <Pane c={c} fill={url(id.pane)} d="M264,330 C300,300 420,294 478,322 C492,332 488,348 472,352 C410,366 300,360 264,330 Z" />
            <Veins c={c} d="M272,330 L472,332 M330,312 L338,356 M390,310 L398,360 M440,314 L446,354" />
          </g>
        </g>
      </Mirror>
      <WingSparkles pts={[[496, 110, 15], [470, 410, 12]]} />
    </Svg>
  );
}

export function WingsLeaf({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.leaf;
  const id = useIds('pane');
  return (
    <Svg className={className}>
      <defs>
        <WingDefs id={id.pane} c={c} />
      </defs>
      <Mirror>
        <g>
          <Pane c={c} fill={url(id.pane)} d={leaf([268, 250], [476, 70], 62)} />
          <Veins c={c} w={6} d="M276,242 L466,80 M330,196 L316,140 M380,154 L380,100 M324,200 L380,208 M380,154 L436,160" />
          <Pane c={c} fill={url(id.pane)} d={leaf([268, 266], [410, 380], 38)} />
          <Veins c={c} d="M276,272 L400,372 M330,318 L310,340 M350,334 L380,330" />
        </g>
      </Mirror>
      <WingSparkles pts={[[496, 180, 15], [420, 52, 12]]} />
    </Svg>
  );
}

export function WingsStar({ colors, className }: PartSvgProps) {
  const c = colors.wings || FAIRY_DEFAULTS.wings.star;
  const id = useIds('pane');
  return (
    <Svg className={className}>
      <defs>
        <WingDefs id={id.pane} c={c} />
      </defs>
      <Mirror>
        <g>
          <Pane c={c} fill={url(id.pane)} d="M266,258 L316,150 L346,222 L404,100 L426,210 L500,168 L470,262 L266,280 Z" />
          <Veins c={c} d="M276,262 L396,120 M290,266 L470,190 M296,270 L456,252" />
          <Pane c={c} fill={url(id.pane)} d="M268,284 L420,296 L388,340 L412,390 L350,368 L296,336 Z" />
          <polygon points={star(372, 222, 20, 9)} fill={shade(c, 0.55)} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        </g>
      </Mirror>
      <WingSparkles pts={[[478, 110, 16], [446, 400, 13]]} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ HAIR */
/* Each style has a Back layer (behind the head) and a Front layer (fringe and the locks
   that frame her face, in front of it). The model's swept, parted fringe is the front of
   every straight style; the curls keep a fringe of their own. */

/** The fringe and the two locks in front of her ears, which end at `lockY`. */
function fringe(lockY: number) {
  return [
    // outside edge, from the left lock's tip over the top of her head to the right one's
    `M100,${lockY} C80,${lockY - 70} 68,270 78,200 C90,118 164,60 256,60 C348,60 422,118 434,200 C444,270 432,${lockY - 70} 412,${lockY}`,
    // up the inside of the right lock to her temple
    `C396,${lockY - 50} 384,300 382,250 C380,222 372,204 360,192`,
    // the fringe, strands swept from a parting over her left eye
    'C352,166 338,150 324,142 C326,160 318,178 302,190',
    'C296,166 284,148 268,138 C268,158 260,174 244,184',
    'C240,160 230,140 214,128 C206,146 196,164 180,176',
    'C176,160 168,148 156,140 C156,160 150,178 140,194',
    // and down the inside of the left lock
    `C132,220 128,300 130,${lockY - 60} C128,${lockY - 30} 118,${lockY - 8} 100,${lockY} Z`,
  ].join(' ');
}

function HairShine({ c }: { c: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      {/* the parting, and strands combed away from it */}
      <path d="M214,128 C222,104 236,82 256,68 M236,100 C290,94 350,116 392,168 M226,116 C270,116 314,134 338,152 M204,104 C168,100 132,122 110,168" stroke={shade(c, -0.22)} strokeWidth="6" />
      <path d="M148,100 C186,76 232,70 270,72" stroke={shade(c, 0.55)} strokeWidth="11" opacity="0.85" />
      <path d="M404,240 C410,280 410,320 402,352" stroke={shade(c, -0.2)} strokeWidth="5" />
      <path d="M108,240 C102,280 102,320 110,352" stroke={shade(c, -0.2)} strokeWidth="5" />
    </g>
  );
}

function HairFront({ c, lockY, className }: { c: string; lockY: number; className?: string }) {
  const id = useIds('hair');
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.hair} color={c} y1={50} y2={lockY} lift={0.32} drop={-0.14} />
      </defs>
      <path d={fringe(lockY)} fill={url(id.hair)} {...O} />
      <HairShine c={c} />
    </Svg>
  );
}

/** The short hair behind her head, seen only round her ears and jaw. */
const NAPE = 'M256,70 C130,70 70,160 72,270 C74,340 96,390 130,410 L382,410 C416,390 438,340 440,270 C442,160 382,70 256,70 Z';

export function HairLongBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.long;
  const id = useIds('hair');
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.hair} color={c} y1={50} y2={600} lift={0.2} drop={-0.18} />
      </defs>
      <path
        d="M256,50 C120,50 62,150 66,270 C70,380 40,500 86,600 C160,600 190,560 200,470 L312,470 C322,560 352,600 426,600 C472,500 442,380 446,270 C450,150 392,50 256,50 Z"
        fill={url(id.hair)}
        {...O}
      />
      <path d="M110,300 C100,400 96,470 108,550 M402,300 C412,400 416,470 404,550" fill="none" stroke={shade(c, -0.25)} strokeWidth="7" strokeLinecap="round" />
    </Svg>
  );
}

export function HairLongFront({ colors, className }: PartSvgProps) {
  return <HairFront c={colors.hair || FAIRY_DEFAULTS.hair.long} lockY={470} className={className} />;
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
  const id = useIds('hair', 'bun');
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.hair} color={c} y1={60} y2={410} lift={0.2} drop={-0.18} />
        <radialGradient id={id.bun} cx="40%" cy="30%" r="75%">
          <stop offset="0" stopColor={shade(c, 0.45)} />
          <stop offset="0.6" stopColor={c} />
          <stop offset="1" stopColor={shade(c, -0.15)} />
        </radialGradient>
      </defs>
      {/* two round buns high on her head — one drawn, the other is its true mirror */}
      <Mirror>
        <g>
          <circle cx="362" cy="88" r="70" fill={url(id.bun)} {...O} />
          <path d="M318,60 C344,34 392,36 412,66 M322,96 C348,72 392,74 414,100 M336,132 C360,116 392,118 410,132" fill="none" stroke={shade(c, -0.22)} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="344" cy="54" rx="18" ry="10" fill="#fff" opacity="0.45" transform="rotate(-24 344 54)" />
        </g>
      </Mirror>
      <path d={NAPE} fill={url(id.hair)} {...O} />
    </Svg>
  );
}

export function HairBunsFront({ colors, className }: PartSvgProps) {
  return <HairFront c={colors.hair || FAIRY_DEFAULTS.hair.buns} lockY={404} className={className} />;
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
        <circle key={i} cx={x} cy={y} r={r} fill={c} {...O} />
      ))}
      {CURLS.map(([x, y, r], i) => (
        <circle key={`i${i}`} cx={x} cy={y} r={r - 2} fill={c} />
      ))}
      {CURLS.map(([x, y, r], i) => (
        <circle key={`h${i}`} cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill={shade(c, 0.4)} opacity="0.55" />
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
        <circle key={i} cx={x} cy={y} r={r} fill={c} {...O} />
      ))}
      {FRONT_CURLS.map(([x, y, r], i) => (
        <circle key={`i${i}`} cx={x} cy={y} r={r - 2} fill={c} />
      ))}
      {FRONT_CURLS.map(([x, y, r], i) => (
        <circle key={`h${i}`} cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill={shade(c, 0.45)} opacity="0.6" />
      ))}
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
        <g key={y}>
          <circle cx={x + (i % 2 === 0 ? -9 : 9)} cy={y} r="32" fill={color} {...O} />
          <path d={`M${x - 20 + (i % 2 === 0 ? -9 : 9)},${y - 8} Q${x + (i % 2 === 0 ? -9 : 9)},${y + 14} ${x + 20 + (i % 2 === 0 ? -9 : 9)},${y - 8}`} fill="none" stroke={shade(color, -0.25)} strokeWidth="5" strokeLinecap="round" />
        </g>
      ))}
      <path d={`M${x - 28},${beads[0] - 34} L${x + 28},${beads[0] - 34} L${x},${beads[0] - 62} Z M${x - 28},${beads[0] - 34} L${x + 28},${beads[0] - 34} L${x},${beads[0] - 6} Z`} fill={ribbon} {...O} strokeWidth={8} />
    </g>
  );
}

export function HairBraidBack({ colors, className }: PartSvgProps) {
  const c = colors.hair || FAIRY_DEFAULTS.hair.braid;
  const id = useIds('hair');
  return (
    <Svg className={className}>
      <defs>
        <Down id={id.hair} color={c} y1={50} y2={410} lift={0.2} drop={-0.18} />
      </defs>
      <path d={NAPE} fill={url(id.hair)} {...O} />
      <BraidRope x={402} color={c} ribbon="#FF6EC7" />
    </Svg>
  );
}

export function HairBraidFront({ colors, className }: PartSvgProps) {
  return <HairFront c={colors.hair || FAIRY_DEFAULTS.hair.braid} lockY={330} className={className} />;
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

/**
 * The model's flowers: a little bunch of lilac blossoms pinned at the foot of each bun,
 * rather than a garland across the top of her head.
 */
export function CrownFlower({ className }: PartSvgProps) {
  const lilac = '#B98CFF';
  const pale = '#DCC6FF';
  return (
    <Svg className={className}>
      <Mirror>
        <g>
          <path d="M352,452 C370,430 398,424 414,430 C400,452 374,462 352,452 Z" fill="#7ED957" {...O} strokeWidth={8} />
          <Flower x={410} y={404} petal={pale} r={22} heart="#FFD93D" />
          <Flower x={366} y={430} petal={lilac} r={26} heart="#FFD93D" />
          <circle cx="358" cy="414" r="6" fill="#fff" opacity="0.7" />
        </g>
      </Mirror>
      <Sparkles pts={[[256, 360, 16]]} />
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
          <path d="M320,364 C356,330 400,326 424,334 C396,382 346,392 318,378 Z" fill={c} {...O} />
          <path d="M326,372 C356,354 388,346 414,344" fill="none" stroke={shade(c, -0.32)} strokeWidth="7" strokeLinecap="round" />
          <path d="M386,410 C412,386 446,382 464,388 C444,424 406,432 384,420 Z" fill={shade(c, 0.22)} {...O} />
        </g>
      </Mirror>
      <path d="M256,332 C226,300 226,258 242,232 C278,254 288,300 274,332 Z" fill={c} {...O} />
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
/* The eyes' box is smaller than the head's: here the face's centre line is x=256 and the
   eyes sit either side of it, big and a little low, as on the model. */

/**
 * One of the model's eyes: a tall white, a big green iris with a darker ring, a round
 * pupil, two catch-lights, a heavy upper lash line and two lashes flicked out at the side.
 * `side` is 1 for the eye on the right of the picture, -1 for the left one.
 */
function FairyEye({ cx, cy, r = 88, iris = '#43B047', side = 1 }: { cx: number; cy: number; r?: number; iris?: string; side?: 1 | -1 }) {
  const rx = r * 0.84;
  const ic = cy + r * 0.12;
  const f = (n: number) => n.toFixed(1);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={r} fill="#fff" stroke={INK} strokeWidth="7" />
      <circle cx={cx} cy={ic} r={r * 0.66} fill={iris} />
      <circle cx={cx} cy={ic + r * 0.14} r={r * 0.4} fill={shade(iris, 0.4)} opacity="0.7" />
      <circle cx={cx} cy={ic} r={r * 0.66} fill="none" stroke={shade(iris, -0.5)} strokeWidth={r * 0.09} />
      <circle cx={cx} cy={ic} r={r * 0.32} fill="#101522" />
      <ellipse cx={cx + r * 0.24} cy={cy - r * 0.18} rx={r * 0.2} ry={r * 0.24} fill="#fff" />
      <circle cx={cx - r * 0.22} cy={cy + r * 0.38} r={r * 0.09} fill="#fff" />
      {/* the upper lid follows the top of the white */}
      <path d={`M${f(cx - rx * 1.04)},${f(cy + r * 0.05)} A${f(rx * 1.04)},${f(r * 1.04)} 0 0 1 ${f(cx + rx * 1.04)},${f(cy + r * 0.05)}`} fill="none" stroke={INK} strokeWidth={r * 0.17} strokeLinecap="round" />
      <path
        d={`M${f(cx + side * rx * 0.92)},${f(cy - r * 0.36)} l${f(side * r * 0.34)},${f(-r * 0.2)} M${f(cx + side * rx * 0.68)},${f(cy - r * 0.72)} l${f(side * r * 0.26)},${f(-r * 0.3)}`}
        fill="none"
        stroke={INK}
        strokeWidth={r * 0.12}
        strokeLinecap="round"
      />
    </g>
  );
}

function ClosedHappy({ cx, cy, side = 1 }: { cx: number; cy: number; side?: 1 | -1 }) {
  return (
    <g fill="none" stroke={INK} strokeLinecap="round">
      <path d={`M${cx - 62},${cy + 20} Q${cx},${cy - 58} ${cx + 62},${cy + 20}`} strokeWidth="16" />
      <path d={`M${cx + side * 56},${cy - 4} l${side * 26},-16 M${cx + side * 36},${cy - 22} l${side * 18},-24`} strokeWidth="10" />
    </g>
  );
}

export function EyesSparkly({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <FairyEye cx={392} cy={262} />
      </Mirror>
    </Svg>
  );
}

export function EyesHappy({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <ClosedHappy cx={392} cy={270} />
      </Mirror>
    </Svg>
  );
}

export function EyesWink({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <FairyEye cx={120} cy={262} side={-1} />
      <ClosedHappy cx={392} cy={270} />
      <Sparkles pts={[[478, 170, 16]]} />
    </Svg>
  );
}

export function EyesBig({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Mirror>
        <FairyEye cx={388} cy={258} r={104} iris="#A77BFF" />
      </Mirror>
    </Svg>
  );
}

/** The fairy has no mouth category; this smile is the one drawn on her 2D head. */
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
      <polygon points={star(256, 152, 82, 38)} fill="#FFD93D" {...O} strokeWidth={14} />
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
        <path d="M262,300 C300,278 336,282 352,292 C324,326 286,330 262,314 Z" fill="#7ED957" {...O} />
      </Mirror>
      <Flower x={256} y={158} petal="#FF6EC7" r={48} heart="#FFD93D" line={10} />
      <Sparkles pts={[[368, 96, 20], [148, 116, 16]]} />
    </Svg>
  );
}

export function WandMoon({ className }: PartSvgProps) {
  return (
    <Svg className={className}>
      <Stick color="#A77BFF" to={210} />
      <path d="M256,84 A78,78 0 1,0 256,240 A62,62 0 1,1 256,84 Z" fill="#FFD93D" {...O} strokeWidth={14} />
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

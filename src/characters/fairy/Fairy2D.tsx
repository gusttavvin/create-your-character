import type { CSSProperties } from 'react';
import { FAIRY, resolveFairyColors } from './config';
import { HAIR_LAYERS, Head } from './parts';
import { findOption, type ColorMap, type PartMap, type PartOption, type SlotLayout } from '../types';

const VW = 600;
const VH = 720;

/** Head box: 300 virtual units centred at (300, 250). Face circle r=170 in 512 space. */
const HEAD = { cx: 300, cy: 250, size: 300 };
/** Body box: 460 virtual units centred at (300, 480). Hands are at (108,298) / (404,298) in 512 space. */
const BODY = { cx: 300, cy: 480, size: 460 };
/** Wings box: wide and high, so the pair spreads out behind her. */
const WINGS = { cx: 300, cy: 400, size: 540 };

function box(cx: number, cy: number, size: number, z: number): CSSProperties {
  return {
    position: 'absolute',
    left: `${((cx - size / 2) / VW) * 100}%`,
    top: `${((cy - size / 2) / VH) * 100}%`,
    width: `${(size / VW) * 100}%`,
    aspectRatio: '1 / 1',
    zIndex: z,
  };
}

/** Right hand in virtual units (body box → virtual). */
const bScale = BODY.size / 512;
const HAND_X = BODY.cx - BODY.size / 2 + 404 * bScale;
const HAND_Y = BODY.cy - BODY.size / 2 + 298 * bScale;
const HEAD_TOP = HEAD.cy - (170 / 512) * HEAD.size;

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function fairySlots(parts: PartMap): SlotLayout {
  // the braid hangs on one side only, so its drop zone follows it
  const braid = parts.hair === 'braid';
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'dress', cx: BODY.cx, cy: 540, w: 300, h: 290 },
      { id: 'wings', cx: WINGS.cx - 200, cy: 372, w: 190, h: 240 },
      { id: 'wings', cx: WINGS.cx + 200, cy: 372, w: 190, h: 240 },
      { id: 'hair', cx: HEAD.cx - 125, cy: HEAD.cy + (braid ? -10 : 20), w: 110, h: braid ? 190 : 250 },
      { id: 'hair', cx: HEAD.cx + 125, cy: HEAD.cy + 20, w: 110, h: 250 },
      { id: 'crown', cx: HEAD.cx, cy: HEAD_TOP - 34, w: 230, h: 110 },
      { id: 'eyes', cx: HEAD.cx, cy: 258, w: 165, h: 85 },
      { id: 'wand', cx: HAND_X + 6, cy: HAND_Y - 78, w: 150, h: 200 },
    ],
  };
}

/**
 * The selected option for a category. An empty id means the child erased that
 * part, so nothing is drawn; an unknown id falls back to the first option.
 */
function pick(categoryId: string, id: string | undefined): PartOption | null {
  if (id === '') return null;
  const cat = FAIRY.categories.find((c) => c.id === categoryId)!;
  return findOption(FAIRY, categoryId, id ?? '') ?? cat.options[0];
}

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

export default function Fairy2D({ parts, colors, animate = true, className }: Props) {
  const dress = pick('dress', parts.dress);
  const wings = pick('wings', parts.wings);
  const hair = pick('hair', parts.hair);
  const crown = pick('crown', parts.crown);
  const eyes = pick('eyes', parts.eyes);
  const wand = pick('wand', parts.wand);
  const eff = resolveFairyColors(parts, colors);

  const Dress = dress?.Svg;
  const Wings = wings?.Svg;
  const Crown = crown?.Svg;
  const Eyes = eyes?.Svg;
  const Wand = wand?.Svg;
  const layers = hair ? HAIR_LAYERS[hair.id] ?? HAIR_LAYERS.long : null;
  const HairBack = layers?.Back;
  const HairFront = layers?.Front;

  const WAND = 230;
  // the wand's grip point is at (256, 440) in its 512 box
  const wandCX = HAND_X;
  const wandCY = HAND_Y - ((440 - 256) / 512) * WAND;

  const CROWN = 230;
  const crownCY = HEAD_TOP + 14 - ((430 - 256) / 512) * CROWN;

  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d fairy2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {Wings && (
          <div data-part="wings" key={`wings-${wings!.id}`} className="part pop wing-flap" style={box(WINGS.cx, WINGS.cy, WINGS.size, 1)}>
            <Wings colors={eff} />
          </div>
        )}
        {Dress && (
          <div data-part="dress" key={`dress-${dress!.id}`} className="part pop dress-sway" style={{ ...box(BODY.cx, BODY.cy, BODY.size, 2), transformOrigin: '50% 20%' }}>
            <Dress colors={eff} />
          </div>
        )}
        {HairBack && (
          <div data-part="hair" key={`hairb-${hair!.id}`} className="part pop" style={box(HEAD.cx, HEAD.cy, HEAD.size, 3)}>
            <HairBack colors={eff} />
          </div>
        )}
        <div className="part" style={box(HEAD.cx, HEAD.cy, HEAD.size, 4)}>
          <Head colors={eff} />
        </div>
        {Eyes && (
          <div data-part="eyes" key={`eyes-${eyes!.id}`} className="part pop blink" style={box(HEAD.cx, 258, 170, 5)}>
            <Eyes colors={eff} />
          </div>
        )}
        {HairFront && (
          <div data-part="hair" key={`hairf-${hair!.id}`} className="part pop" style={box(HEAD.cx, HEAD.cy, HEAD.size, 6)}>
            <HairFront colors={eff} />
          </div>
        )}
        {Crown && (
          <div data-part="crown" key={`crown-${crown!.id}`} className="part pop" style={box(HEAD.cx, crownCY, CROWN, 7)}>
            <Crown colors={eff} />
          </div>
        )}
        {Wand && (
          <div data-part="wand" key={`wand-${wand!.id}`} className="part pop acc-wave" style={{ ...box(wandCX, wandCY, WAND, 8), transformOrigin: '50% 86%' }}>
            <Wand colors={eff} />
          </div>
        )}
      </div>
    </div>
  );
}

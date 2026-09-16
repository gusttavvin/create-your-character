import type { CSSProperties } from 'react';
import { PRINCESS, resolvePrincessColors } from './config';
import { HAIR_LAYERS, Head } from './parts';
import { findOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

const VW = 600;
const VH = 720;

/** Head box: 300 virtual units centred at (300, 250). Face circle r=170 in 512 space. */
const HEAD = { cx: 300, cy: 250, size: 300 };
/** Dress box: 460 virtual units centred at (300, 480). Hands are at (108,298) / (404,298) in 512 space. */
const DRESS = { cx: 300, cy: 480, size: 460 };

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

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function princessSlots(): SlotLayout {
  const headTop = HEAD.cy - (170 / 512) * HEAD.size;
  const dScale = DRESS.size / 512;
  const handX = DRESS.cx - DRESS.size / 2 + 404 * dScale;
  const handY = DRESS.cy - DRESS.size / 2 + 298 * dScale;
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'dress', cx: DRESS.cx, cy: 540, w: 300, h: 290 },
      { id: 'hair', cx: HEAD.cx - 125, cy: HEAD.cy + 20, w: 110, h: 250 },
      { id: 'hair', cx: HEAD.cx + 125, cy: HEAD.cy + 20, w: 110, h: 250 },
      { id: 'crown', cx: HEAD.cx, cy: headTop - 34, w: 230, h: 110 },
      { id: 'accessory', cx: handX + 6, cy: handY - 78, w: 150, h: 200 },
      { id: 'mouth', cx: 300, cy: 306, w: 110, h: 70 },
      { id: 'eyes', cx: 300, cy: 258, w: 165, h: 85 },
    ],
  };
}

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

export default function Princess2D({ parts, colors, animate = true, className }: Props) {
  const dress = findOption(PRINCESS, 'dress', parts.dress) ?? PRINCESS.categories[0].options[0];
  const hair = findOption(PRINCESS, 'hair', parts.hair) ?? PRINCESS.categories[1].options[0];
  const crown = findOption(PRINCESS, 'crown', parts.crown) ?? PRINCESS.categories[2].options[0];
  const eyes = findOption(PRINCESS, 'eyes', parts.eyes) ?? PRINCESS.categories[3].options[0];
  const mouth = findOption(PRINCESS, 'mouth', parts.mouth) ?? PRINCESS.categories[4].options[0];
  const accessory = findOption(PRINCESS, 'accessory', parts.accessory) ?? PRINCESS.categories[5].options[0];
  const eff = resolvePrincessColors(parts, colors);

  const Dress = dress.Svg!;
  const Crown = crown.Svg!;
  const Eyes = eyes.Svg!;
  const Mouth = mouth.Svg!;
  const Accessory = accessory.Svg!;
  const layers = HAIR_LAYERS[hair.id] ?? HAIR_LAYERS.long;
  const HairBack = layers.Back;
  const HairFront = layers.Front;

  // Right hand position in virtual units (dress box → virtual)
  const dScale = DRESS.size / 512;
  const handX = DRESS.cx - DRESS.size / 2 + 404 * dScale;
  const handY = DRESS.cy - DRESS.size / 2 + 298 * dScale;
  const ACC = 230;
  // accessory grip point is at (256, 440) in its 512 box
  const accCX = handX;
  const accCY = handY - ((440 - 256) / 512) * ACC;

  const headTop = HEAD.cy - (170 / 512) * HEAD.size;
  const CROWN = 230;
  const crownCY = headTop + 14 - ((430 - 256) / 512) * CROWN;
  const crownDX = crown.id === 'bow' ? 10 : 0;

  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d princess2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        <div key={`dress-${dress.id}`} className="part pop dress-sway" style={{ ...box(DRESS.cx, DRESS.cy, DRESS.size, 1), transformOrigin: '50% 20%' }}>
          <Dress colors={eff} />
        </div>
        <div key={`hairb-${hair.id}`} className="part pop" style={box(HEAD.cx, HEAD.cy, HEAD.size, 2)}>
          <HairBack colors={eff} />
        </div>
        <div className="part" style={box(HEAD.cx, HEAD.cy, HEAD.size, 3)}>
          <Head colors={eff} />
        </div>
        <div key={`mouth-${mouth.id}`} className="part pop" style={box(300, 306, 120, 4)}>
          <Mouth colors={eff} />
        </div>
        <div key={`eyes-${eyes.id}`} className="part pop blink" style={box(300, 258, 170, 5)}>
          <Eyes colors={eff} />
        </div>
        <div key={`hairf-${hair.id}`} className="part pop" style={box(HEAD.cx, HEAD.cy, HEAD.size, 6)}>
          <HairFront colors={eff} />
        </div>
        <div key={`crown-${crown.id}`} className="part pop" style={box(HEAD.cx + crownDX, crownCY, CROWN, 7)}>
          <Crown colors={eff} />
        </div>
        <div key={`acc-${accessory.id}`} className="part pop acc-wave" style={{ ...box(accCX, accCY, ACC, 8), transformOrigin: '50% 86%' }}>
          <Accessory colors={eff} />
        </div>
      </div>
    </div>
  );
}

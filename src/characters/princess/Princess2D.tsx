import type { CSSProperties, ReactNode } from 'react';
import PartArt from '../../components/PartArt';
import { PRINCESS, resolvePrincessColors } from './config';
import { HAIR_LAYERS, Head, Shoes } from './parts';
import { pickOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

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

/** A positioned layer. The pop animation owns the element's transform, so anything needing
 *  its own transform (mirroring, swaying) goes on a wrapper inside it. */
function Layer({ style, extra, children }: { style: CSSProperties; extra?: string; children: ReactNode }) {
  return <div className={`part pop${extra ? ` ${extra}` : ''}`} style={style}>{children}</div>;
}

export default function Princess2D({ parts, colors, animate = true, className }: Props) {
  const dress = pickOption(PRINCESS, 'dress', parts.dress);
  const hair = pickOption(PRINCESS, 'hair', parts.hair);
  const crown = pickOption(PRINCESS, 'crown', parts.crown);
  const eyes = pickOption(PRINCESS, 'eyes', parts.eyes);
  const mouth = pickOption(PRINCESS, 'mouth', parts.mouth);
  const accessory = pickOption(PRINCESS, 'accessory', parts.accessory);
  const eff = resolvePrincessColors(parts, colors);
  const layers = hair ? HAIR_LAYERS[hair.id] ?? HAIR_LAYERS.long : null;

  // Right hand position, mapped from the dress art into virtual units.
  const dScale = DRESS.size / 512;
  const handX = DRESS.cx - DRESS.size / 2 + 404 * dScale;
  const handY = DRESS.cy - DRESS.size / 2 + 298 * dScale;
  const ACC = 230;
  const accCY = handY - ((440 - 256) / 512) * ACC;

  const headTop = HEAD.cy - (170 / 512) * HEAD.size;
  const CROWN = 230;
  const crownCY = headTop + 14 - ((430 - 256) / 512) * CROWN;
  const crownDX = crown?.id === 'bow' ? 10 : 0;
  const anim = animate ? ' is-animated' : '';
  const full: CSSProperties = { width: '100%', height: '100%' };

  return (
    <div
      className={`char2d princess2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {/* shoes sit behind the skirt so they only peek out below the hem */}
        <div className="part" style={box(DRESS.cx, DRESS.cy, DRESS.size, 0)}>
          <Shoes colors={eff} />
        </div>
        {dress && (
          <Layer key={`dress-${dress.id}`} style={box(DRESS.cx, DRESS.cy, DRESS.size, 1)}>
            <div className="dress-sway" style={{ ...full, transformOrigin: '50% 20%' }}>
              <PartArt option={dress} colors={eff} />
            </div>
          </Layer>
        )}
        {layers && (
          <Layer key={`hairb-${hair!.id}`} style={box(HEAD.cx, HEAD.cy, HEAD.size, 2)}>
            <layers.Back colors={eff} />
          </Layer>
        )}
        <div className="part" style={box(HEAD.cx, HEAD.cy, HEAD.size, 3)}>
          <Head colors={eff} />
        </div>
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} style={box(300, 306, 120, 4)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} style={box(300, 258, 170, 5)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
        {layers && (
          <Layer key={`hairf-${hair!.id}`} style={box(HEAD.cx, HEAD.cy, HEAD.size, 6)}>
            <layers.Front colors={eff} />
          </Layer>
        )}
        {crown && (
          <Layer key={`crown-${crown.id}`} style={box(HEAD.cx + crownDX, crownCY, CROWN, 7)}>
            <PartArt option={crown} colors={eff} />
          </Layer>
        )}
        {accessory && (
          <Layer key={`acc-${accessory.id}`} style={box(handX, accCY, ACC, 8)}>
            <div className="acc-wave" style={{ ...full, transformOrigin: '50% 86%' }}>
              <PartArt option={accessory} colors={eff} />
            </div>
          </Layer>
        )}
      </div>
    </div>
  );
}

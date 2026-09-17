import type { CSSProperties, ReactNode } from 'react';
import PartArt from '../../components/PartArt';
import { PRINCESS, resolvePrincessColors } from './config';
import { BODY, Feet, HAIR_LAYERS, Head, Neck } from './parts';
import { pickOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

const VW = 600;
const VH = 720;

/** Head box: 300 virtual units centred at (300, 250). Face circle r=170 in 512 space. */
const HEAD = { cx: 300, cy: 250, size: 300 };
/**
 * Dress box: 520 virtual units. It starts just under the chin so her neck, her
 * shoulders and the floor all fall inside one 512 drawing. See parts.tsx for the
 * landmarks; the hands are at (408, 266) and the floor is at y = 396.
 */
const DRESS = { cx: 300, cy: 559, size: 520 };

const D_SCALE = DRESS.size / 512;
const D_LEFT = DRESS.cx - DRESS.size / 2;
const D_TOP = DRESS.cy - DRESS.size / 2;

/** Her right hand, mapped out of the dress art into virtual units. */
const HAND_X = D_LEFT + BODY.hand.x * D_SCALE;
const HAND_Y = D_TOP + BODY.hand.y * D_SCALE;

const HEAD_TOP = HEAD.cy - (170 / 512) * HEAD.size;

/** The held item is drawn with its grip at (256, 440), which lands on the hand. */
const ACC = 230;
const ACC_CY = HAND_Y - ((440 - 256) / 512) * ACC;

/** The crown is drawn with its base at y=430, which rests on the top of the head. */
const CROWN = 230;
const CROWN_CY = HEAD_TOP + 14 - ((430 - 256) / 512) * CROWN;

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
  return {
    vw: VW,
    vh: VH,
    slots: [
      // the skirt, from the shoulders down to the hem
      { id: 'dress', cx: DRESS.cx, cy: 545, w: 330, h: 300 },
      { id: 'hair', cx: HEAD.cx - 122, cy: HEAD.cy + 26, w: 108, h: 260 },
      { id: 'hair', cx: HEAD.cx + 122, cy: HEAD.cy + 26, w: 108, h: 260 },
      { id: 'crown', cx: HEAD.cx, cy: HEAD_TOP - 34, w: 230, h: 110 },
      { id: 'accessory', cx: HAND_X + 6, cy: ACC_CY, w: 150, h: 200 },
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

/**
 * A positioned layer. The pop animation owns the element's transform, so anything
 * needing its own transform (mirroring, swaying) goes on a wrapper inside it.
 * `part` is the category id, which the drag-and-drop editor looks the layer up by.
 */
function Layer({ part, style, extra, children }: { part: string; style: CSSProperties; extra?: string; children: ReactNode }) {
  return (
    <div className={`part pop${extra ? ` ${extra}` : ''}`} data-part={part} style={style}>
      {children}
    </div>
  );
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

  const crownDX = crown?.id === 'bow' ? 10 : 0;
  const anim = animate ? ' is-animated' : '';
  const full: CSSProperties = { width: '100%', height: '100%' };

  return (
    <div
      className={`char2d princess2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {/* legs and shoes sit behind the skirt, so they only peek out below the hem */}
        <div className="part" data-part="dress" style={box(DRESS.cx, DRESS.cy, DRESS.size, 0)}>
          <Feet colors={eff} kind={dress?.id ?? null} />
        </div>
        {/* the neck: under the dress, so the bodice's neckline closes it off */}
        <div className="part" style={box(DRESS.cx, DRESS.cy, DRESS.size, 1)}>
          <Neck colors={eff} />
        </div>
        {dress && (
          <Layer key={`dress-${dress.id}`} part="dress" style={box(DRESS.cx, DRESS.cy, DRESS.size, 2)}>
            <div className="dress-sway" style={{ ...full, transformOrigin: '50% 20%' }}>
              <PartArt option={dress} colors={eff} />
            </div>
          </Layer>
        )}
        {/* the back of her hair sits in front of the dress, so long hair falls over the skirt */}
        {layers && (
          <Layer key={`hairb-${hair!.id}`} part="hair" style={box(HEAD.cx, HEAD.cy, HEAD.size, 3)}>
            <layers.Back colors={eff} />
          </Layer>
        )}
        <div className="part" style={box(HEAD.cx, HEAD.cy, HEAD.size, 4)}>
          <Head colors={eff} />
        </div>
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} part="mouth" style={box(300, 306, 120, 5)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} part="eyes" style={box(300, 258, 170, 6)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
        {layers && (
          <Layer key={`hairf-${hair!.id}`} part="hair" style={box(HEAD.cx, HEAD.cy, HEAD.size, 7)}>
            <layers.Front colors={eff} />
          </Layer>
        )}
        {crown && (
          <Layer key={`crown-${crown.id}`} part="crown" style={box(HEAD.cx + crownDX, CROWN_CY, CROWN, 8)}>
            <PartArt option={crown} colors={eff} />
          </Layer>
        )}
        {accessory && (
          <Layer key={`acc-${accessory.id}`} part="accessory" style={box(HAND_X, ACC_CY, ACC, 9)}>
            <div className="acc-wave" style={{ ...full, transformOrigin: '50% 86%' }}>
              <PartArt option={accessory} colors={eff} />
            </div>
          </Layer>
        )}
      </div>
    </div>
  );
}

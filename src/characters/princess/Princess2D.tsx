import type { CSSProperties, ReactNode } from 'react';
import { PRINCESS, princessColors } from './config';
import { boxOf, CANVAS, filesOf, hairBack, hairFront, headFile, type SkinTone } from './pieces';
import { pickOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

/**
 * Lays the princess out on the sheet.
 *
 * Every piece is a picture cut from one of the four princesses Clara sent, on the same
 * 1024 by 1536 canvas and already lined up (see pieces.tsx), so here they are simply stacked,
 * back to front: the back of her hair, her head (with her neck), the dress (with her arms and
 * hands; its neckline covers her neck), eyes, mouth, the front of her hair (with the tiara and
 * the earrings) and her power round her.
 */
const VW = 600;
const VH = 720;
/** Where the canvas sits on the sheet. */
const S = 700 / CANVAS.h;
const OX = (VW - CANVAS.w * S) / 2;
const OY = 10;
const Z = { hairBack: 0, head: 1, dress: 2, eyes: 3, mouth: 4, hairFront: 5, power: 6 };

const WHOLE: CSSProperties = {
  position: 'absolute',
  left: `${(OX / VW) * 100}%`,
  top: `${(OY / VH) * 100}%`,
  width: `${((CANVAS.w * S) / VW) * 100}%`,
  height: `${((CANVAS.h * S) / VH) * 100}%`,
};
const IMG: CSSProperties = { width: '100%', height: '100%', display: 'block', pointerEvents: 'none' };

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function princessSlots(): SlotLayout {
  const slot = (id: string, row: string, pid: string) => {
    const [x, y, w, h] = boxOf(row, pid);
    return { id, cx: OX + (x + w / 2) * S, cy: OY + (y + h / 2) * S, w: w * S, h: h * S };
  };
  return {
    vw: VW,
    vh: VH,
    slots: [
      slot('dress', 'dress', 'gown'),
      slot('accessory', 'accessory', 'scepter'),
      slot('hair', 'hair', 'long'),
      slot('mouth', 'mouth', 'smile'),
      slot('eyes', 'eyes', 'sparkly'),
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
 * A layer over the whole canvas. The pop animation owns the element's transform, so anything
 * needing its own transform goes on a wrapper inside it. `part` is the category id, which
 * the drag-and-drop editor looks the layer up by.
 */
function Layer({ part, z, extra, children }: { part?: string; z: number; extra?: string; children: ReactNode }) {
  return (
    <div className={`part${part ? ' pop' : ''}${extra ? ` ${extra}` : ''}`} data-part={part} style={{ ...WHOLE, zIndex: z }}>
      {children}
    </div>
  );
}

export default function Princess2D({ parts, colors, animate = true, className }: Props) {
  const dress = pickOption(PRINCESS, 'dress', parts.dress);
  const hair = pickOption(PRINCESS, 'hair', parts.hair);
  const eyes = pickOption(PRINCESS, 'eyes', parts.eyes);
  const mouth = pickOption(PRINCESS, 'mouth', parts.mouth);
  const power = pickOption(PRINCESS, 'accessory', parts.accessory);
  // the skin the child picked; everything else keeps the colours it was drawn in
  const tone = princessColors(parts, colors).tone as SkinTone;
  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d princess2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {hair && (
          <Layer key={`hairb-${hair.id}`} part="hair" z={Z.hairBack}>
            <img src={hairBack(hair.id)} alt="" draggable={false} style={IMG} />
          </Layer>
        )}
        {dress && (
          <Layer key={`dress-${dress.id}`} part="dress" z={Z.dress}>
            <img src={filesOf('dress', dress.id, tone)[0]} alt="" draggable={false} style={IMG} />
          </Layer>
        )}
        <Layer z={Z.head}>
          <img src={headFile(tone)} alt="" draggable={false} style={IMG} />
        </Layer>
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} part="eyes" z={Z.eyes} extra="blink">
            <img src={filesOf('eyes', eyes.id, tone)[0]} alt="" draggable={false} style={IMG} />
          </Layer>
        )}
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} part="mouth" z={Z.mouth}>
            <img src={filesOf('mouth', mouth.id, tone)[0]} alt="" draggable={false} style={IMG} />
          </Layer>
        )}
        {hair && (
          <Layer key={`hairf-${hair.id}`} part="hair" z={Z.hairFront}>
            <img src={hairFront(hair.id)} alt="" draggable={false} style={IMG} />
          </Layer>
        )}
        {power && (
          <Layer key={`power-${power.id}`} part="accessory" z={Z.power}>
            <div className="power-float" style={{ width: '100%', height: '100%' }}>
              <img src={filesOf('accessory', power.id, tone)[0]} alt="" draggable={false} style={IMG} />
            </div>
          </Layer>
        )}
      </div>
    </div>
  );
}

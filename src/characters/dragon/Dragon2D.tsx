import type { CSSProperties, ReactNode } from 'react';
import PartArt from '../../components/PartArt';
import { DRAGON, DRAGON_BODY_LAYOUT, resolveDragonColors } from './config';
import { pickOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

const VW = 600;
const VH = 720;
const BODY_SIZE = 440;
const BODY_CX = 300;
const BODY_CY = 400;
const BODY_TOP = BODY_CY - BODY_SIZE / 2 + (46 / 512) * BODY_SIZE;
const BODY_BOTTOM = BODY_CY - BODY_SIZE / 2 + (470 / 512) * BODY_SIZE;
const BODY_H = BODY_BOTTOM - BODY_TOP;

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
export function dragonSlots(parts: PartMap): SlotLayout {
  const L = DRAGON_BODY_LAYOUT[parts.body] ?? DRAGON_BODY_LAYOUT.chubby;
  const hornCY = BODY_TOP + L.hornY * BODY_H - 34;
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'body', cx: BODY_CX, cy: BODY_CY, w: 300, h: BODY_H },
      { id: 'wings', cx: BODY_CX - 195, cy: 372, w: 190, h: 220 },
      { id: 'wings', cx: BODY_CX + 195, cy: 372, w: 190, h: 220 },
      { id: 'tail', cx: 462, cy: 528, w: 200, h: 170 },
      { id: 'horns', cx: BODY_CX, cy: hornCY + 46, w: 230, h: 120 },
      { id: 'mouth', cx: BODY_CX, cy: BODY_TOP + L.mouthY * BODY_H, w: L.mouthSize * 0.85, h: L.mouthSize * 0.6 },
      { id: 'eyes', cx: BODY_CX, cy: BODY_TOP + L.eyeY * BODY_H, w: L.eyeSize * 0.9, h: L.eyeSize * 0.6 },
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
 *  its own transform (mirroring, wagging) goes on a wrapper inside it. */
function Layer({ style, extra, children }: { style: CSSProperties; extra?: string; children: ReactNode }) {
  return <div className={`part pop${extra ? ` ${extra}` : ''}`} style={style}>{children}</div>;
}

export default function Dragon2D({ parts, colors, animate = true, className }: Props) {
  const body = pickOption(DRAGON, 'body', parts.body);
  const wings = pickOption(DRAGON, 'wings', parts.wings);
  const horns = pickOption(DRAGON, 'horns', parts.horns);
  const eyes = pickOption(DRAGON, 'eyes', parts.eyes);
  const mouth = pickOption(DRAGON, 'mouth', parts.mouth);
  const tail = pickOption(DRAGON, 'tail', parts.tail);

  const L = DRAGON_BODY_LAYOUT[body?.id ?? 'chubby'] ?? DRAGON_BODY_LAYOUT.chubby;
  const eff = resolveDragonColors(parts, colors);
  const eyeCY = BODY_TOP + L.eyeY * BODY_H;
  const mouthCY = BODY_TOP + L.mouthY * BODY_H;
  // The fire mouth is drawn off-centre (flame to the right), so it shifts to keep the lips on the face.
  const mouthDX = mouth?.id === 'fire' ? (66 / 512) * L.mouthSize : 0;
  const HORN = 230;
  const hornCY = BODY_TOP + L.hornY * BODY_H - 34;
  const anim = animate ? ' is-animated' : '';
  const full: CSSProperties = { width: '100%', height: '100%' };

  return (
    <div
      className={`char2d dragon2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {tail && (
          <Layer key={`tail-${tail.id}`} style={box(452, 520, 300, 0)}>
            <div className="tail-wag" style={{ ...full, transformOrigin: '12% 60%' }}>
              <PartArt option={tail} colors={eff} />
            </div>
          </Layer>
        )}
        {wings && (
          <Layer key={`wings-${wings.id}`} style={box(BODY_CX, 372, 560, 1)} extra="wing-flap">
            <PartArt option={wings} colors={eff} />
          </Layer>
        )}
        {horns && (
          <Layer key={`horns-${horns.id}`} style={box(BODY_CX, hornCY, HORN, 2)}>
            <PartArt option={horns} colors={eff} />
          </Layer>
        )}
        {body && (
          <Layer key={`body-${body.id}`} style={box(BODY_CX, BODY_CY, BODY_SIZE, 3)}>
            <PartArt option={body} colors={eff} />
          </Layer>
        )}
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} style={box(BODY_CX + mouthDX, mouthCY, L.mouthSize, 4)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} style={box(BODY_CX, eyeCY, L.eyeSize, 5)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
      </div>
    </div>
  );
}

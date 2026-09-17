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
/** Wing box: the pair is one 512 drawing, so the right wing lives in its right half. */
const WING_SIZE = 460;
const WING_CY = 416;
const TAIL_SIZE = 300;
const TAIL_CX = 452;
const TAIL_CY = 520;
/** The fire mouth carries its jet of flame, so it needs a roomier box than the other mouths. */
const FIRE_SCALE = 1.5;
/** The jaw is drawn left of centre (at x=190 of 512) to leave room for the flame. */
const FIRE_DX = 66 / 512;

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

/** Maps a span of the 512 art box onto the stage, for the slot rectangles. */
function span(boxCx: number, boxCy: number, size: number, x0: number, y0: number, x1: number, y1: number) {
  const k = size / 512;
  return {
    cx: boxCx + ((x0 + x1) / 2 - 256) * k,
    cy: boxCy + ((y0 + y1) / 2 - 256) * k,
    w: (x1 - x0) * k,
    h: (y1 - y0) * k,
  };
}

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function dragonSlots(parts: PartMap): SlotLayout {
  const L = DRAGON_BODY_LAYOUT[parts.body] ?? DRAGON_BODY_LAYOUT.classic;
  // the right wing occupies x 288..506, y 64..376 of its 512 box; the left one mirrors it
  const wing = span(BODY_CX, WING_CY, WING_SIZE, 288, 64, 506, 376);
  const tail = span(TAIL_CX, TAIL_CY, TAIL_SIZE, 40, 100, 480, 340);
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'body', cx: BODY_CX, cy: BODY_CY, w: 300, h: BODY_H },
      { id: 'wings', cx: wing.cx, cy: wing.cy, w: wing.w, h: wing.h },
      { id: 'wings', cx: VW - wing.cx, cy: wing.cy, w: wing.w, h: wing.h },
      { id: 'tail', cx: tail.cx, cy: tail.cy, w: tail.w, h: tail.h },
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
 *  its own transform (mirroring, wagging) goes on a wrapper inside it.
 *  `part` is the category id: a piece being dragged around finds its layers by it. */
function Layer({ part, style, extra, children }: { part: string; style: CSSProperties; extra?: string; children: ReactNode }) {
  return (
    <div className={`part pop${extra ? ` ${extra}` : ''}`} data-part={part} style={style}>
      {children}
    </div>
  );
}

export default function Dragon2D({ parts, colors, animate = true, className }: Props) {
  const body = pickOption(DRAGON, 'body', parts.body);
  const wings = pickOption(DRAGON, 'wings', parts.wings);
  const eyes = pickOption(DRAGON, 'eyes', parts.eyes);
  const mouth = pickOption(DRAGON, 'mouth', parts.mouth);
  const tail = pickOption(DRAGON, 'tail', parts.tail);

  const L = DRAGON_BODY_LAYOUT[body?.id ?? 'classic'] ?? DRAGON_BODY_LAYOUT.classic;
  const eff = resolveDragonColors(parts, colors);
  const eyeCY = BODY_TOP + L.eyeY * BODY_H;
  const mouthCY = BODY_TOP + L.mouthY * BODY_H;
  const fire = mouth?.id === 'fire';
  const mouthSize = fire ? L.mouthSize * FIRE_SCALE : L.mouthSize;
  // the fire mouth is drawn off-centre (flame to the right), so it shifts to keep the jaw on the snout
  const mouthDX = fire ? FIRE_DX * mouthSize : 0;
  const anim = animate ? ' is-animated' : '';
  const full: CSSProperties = { width: '100%', height: '100%' };

  return (
    <div
      className={`char2d dragon2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {tail && (
          <Layer key={`tail-${tail.id}`} part="tail" style={box(TAIL_CX, TAIL_CY, TAIL_SIZE, 0)}>
            <div className="tail-wag" style={{ ...full, transformOrigin: '12% 60%' }}>
              <PartArt option={tail} colors={eff} />
            </div>
          </Layer>
        )}
        {wings && (
          <Layer key={`wings-${wings.id}`} part="wings" style={box(BODY_CX, WING_CY, WING_SIZE, 1)} extra="wing-flap">
            <PartArt option={wings} colors={eff} />
          </Layer>
        )}
        {body && (
          <Layer key={`body-${body.id}`} part="body" style={box(BODY_CX, BODY_CY, BODY_SIZE, 3)}>
            <PartArt option={body} colors={eff} />
          </Layer>
        )}
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} part="mouth" style={box(BODY_CX + mouthDX, mouthCY, mouthSize, 4)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} part="eyes" style={box(BODY_CX, eyeCY, L.eyeSize, 5)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
      </div>
    </div>
  );
}

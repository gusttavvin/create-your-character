import type { CSSProperties, ReactNode } from 'react';
import { BODY_LAYOUT, LEG_TOP, MONSTER } from './config';
import { pickOption, type PartMap, type SlotLayout } from '../types';

const VW = 600;
const VH = 720;
const BODY_SIZE = 440;
const BODY_CX = 300;
const BODY_CY = 400;
const ARM = 230;
const LEG = 300;

/** The art's own 512 px rows mapped onto the virtual canvas. */
function bodyBox(bodyId: string) {
  const L = BODY_LAYOUT[bodyId] ?? BODY_LAYOUT.round;
  const top = BODY_CY - BODY_SIZE / 2 + (L.top / 512) * BODY_SIZE;
  const bottom = BODY_CY - BODY_SIZE / 2 + (L.bottom / 512) * BODY_SIZE;
  return { L, top, bottom, height: bottom - top };
}

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
export function monsterSlots(parts: PartMap): SlotLayout {
  const bodyId = parts.body in BODY_LAYOUT ? parts.body : 'round';
  const { L, top, bottom, height } = bodyBox(bodyId);
  const legsId = parts.legs in LEG_TOP ? parts.legs : 'stubby';
  const legVisibleTop = bottom - 22;
  const legHeight = (1 - (LEG_TOP[legsId] ?? 0.15)) * LEG * 0.62;
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'body', cx: BODY_CX, cy: (top + bottom) / 2, w: L.halfW * 2, h: height },
      { id: 'arms', cx: BODY_CX - L.halfW - 80, cy: top + L.armY * height - 50, w: 190, h: 210 },
      { id: 'arms', cx: BODY_CX + L.halfW + 80, cy: top + L.armY * height - 50, w: 190, h: 210 },
      { id: 'legs', cx: BODY_CX, cy: legVisibleTop + legHeight / 2, w: 280, h: legHeight },
      { id: 'mouth', cx: BODY_CX, cy: top + L.mouthY * height, w: L.mouthSize * 0.9, h: L.mouthSize * 0.75 },
      { id: 'eyes', cx: BODY_CX, cy: top + L.eyeY * height, w: L.eyeSize * 0.95, h: L.eyeSize * 0.8 },
    ],
  };
}

interface Props {
  parts: PartMap;
  animate?: boolean;
  className?: string;
}

/** A positioned layer. The pop animation owns the element's transform, so anything that
 *  needs its own transform (mirroring, wiggling) goes on a wrapper inside it. */
function Layer({ style, children, extra }: { style: CSSProperties; children: ReactNode; extra?: string }) {
  return <div className={`part pop${extra ? ` ${extra}` : ''}`} style={style}>{children}</div>;
}

/**
 * Layers the monster-kit PNGs on a 600x720 virtual stage.
 * Parts keep their kit look; only positions and scales are adjusted so they snap onto the body.
 */
export default function Monster2D({ parts, animate = true, className }: Props) {
  const body = pickOption(MONSTER, 'body', parts.body);
  const eyes = pickOption(MONSTER, 'eyes', parts.eyes);
  const mouth = pickOption(MONSTER, 'mouth', parts.mouth);
  const arms = pickOption(MONSTER, 'arms', parts.arms);
  const legs = pickOption(MONSTER, 'legs', parts.legs);

  const { L, top, bottom, height } = bodyBox(body?.id ?? 'round');
  const eyeCY = top + L.eyeY * height;
  const mouthCY = top + L.mouthY * height;
  const armAttachY = top + L.armY * height;
  // The kit arm art has its base near (29%, 90%) of the image, hand pointing up and out.
  const armBaseX = 0.29 * ARM;
  const armBaseY = 0.9 * ARM;
  const rightAttachX = BODY_CX + L.halfW * L.armInset;
  const leftAttachX = BODY_CX - L.halfW * L.armInset;

  const legTopFrac = LEG_TOP[legs?.id ?? 'stubby'] ?? 0.15;
  const legTop = bottom - 22 - legTopFrac * LEG;

  const anim = animate ? ' is-animated' : '';
  const fill: CSSProperties = { width: '100%', height: '100%', display: 'block' };
  const armBox = (leftEdge: number): CSSProperties => ({
    position: 'absolute',
    left: `${(leftEdge / VW) * 100}%`,
    top: `${((armAttachY - armBaseY) / VH) * 100}%`,
    width: `${(ARM / VW) * 100}%`,
    aspectRatio: '1 / 1',
    zIndex: 2,
  });

  return (
    <div
      className={`char2d monster2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {legs && (
          <Layer key={`legs-${legs.id}`} style={box(BODY_CX, legTop + LEG / 2, LEG, 1)}>
            <img src={legs.img} alt={legs.label} draggable={false} style={fill} />
          </Layer>
        )}

        {arms && (
          <>
            <Layer key={`arm-r-${arms.id}`} style={armBox(rightAttachX - armBaseX)}>
              <div className="arm-wiggle" style={{ ...fill, transformOrigin: '29% 90%' }}>
                <img src={arms.img} alt={arms.label} draggable={false} style={fill} />
              </div>
            </Layer>
            <Layer key={`arm-l-${arms.id}`} style={armBox(leftAttachX - (ARM - armBaseX))}>
              <div style={{ ...fill, transform: 'scaleX(-1)' }}>
                <div className="arm-wiggle" style={{ ...fill, transformOrigin: '29% 90%' }}>
                  <img src={arms.img} alt="" draggable={false} style={fill} />
                </div>
              </div>
            </Layer>
          </>
        )}

        {body && (
          <Layer key={`body-${body.id}`} style={box(BODY_CX, BODY_CY, BODY_SIZE, 3)}>
            <img src={body.img} alt={body.label} draggable={false} style={fill} />
          </Layer>
        )}

        {mouth && (
          <Layer key={`mouth-${mouth.id}`} style={box(BODY_CX, mouthCY, L.mouthSize, 4)}>
            <img src={mouth.img} alt={mouth.label} draggable={false} style={fill} />
          </Layer>
        )}

        {eyes && (
          <Layer key={`eyes-${eyes.id}`} style={box(BODY_CX, eyeCY, L.eyeSize, 5)} extra="blink">
            <img src={eyes.img} alt={eyes.label} draggable={false} style={fill} />
          </Layer>
        )}
      </div>
    </div>
  );
}

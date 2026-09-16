import type { CSSProperties } from 'react';
import { BODY_LAYOUT, LEG_TOP, MONSTER } from './config';
import { findOption, type PartMap } from '../types';

const VW = 600;
const VH = 720;
const BODY_SIZE = 440;
const BODY_CX = 300;
const BODY_CY = 400;
// The body art occupies rows 41..470 of its 512px image.
const BODY_TOP = BODY_CY - BODY_SIZE / 2 + (41 / 512) * BODY_SIZE;
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

interface Props {
  parts: PartMap;
  animate?: boolean;
  className?: string;
}

/**
 * Layers the monster-kit PNGs on a 600x720 virtual stage.
 * Parts keep their kit look; only positions/scales are adjusted so they "snap" onto the body.
 */
export default function Monster2D({ parts, animate = true, className }: Props) {
  const body = findOption(MONSTER, 'body', parts.body) ?? MONSTER.categories[0].options[0];
  const eyes = findOption(MONSTER, 'eyes', parts.eyes) ?? MONSTER.categories[1].options[0];
  const mouth = findOption(MONSTER, 'mouth', parts.mouth) ?? MONSTER.categories[2].options[0];
  const arms = findOption(MONSTER, 'arms', parts.arms) ?? MONSTER.categories[3].options[0];
  const legs = findOption(MONSTER, 'legs', parts.legs) ?? MONSTER.categories[4].options[0];
  const L = BODY_LAYOUT[body.id] ?? BODY_LAYOUT.round;

  const eyeCY = BODY_TOP + L.eyeY * BODY_H;
  const mouthCY = BODY_TOP + L.mouthY * BODY_H;
  const armAttachY = BODY_TOP + L.armY * BODY_H;
  const ARM = 230;
  // The kit arm art has its base near (29%, 90%) of the image and the hand pointing up-right.
  const armBaseX = 0.29 * ARM;
  const armBaseY = 0.9 * ARM;
  const rightAttachX = BODY_CX + L.halfW * L.armInset;
  const leftAttachX = BODY_CX - L.halfW * L.armInset;

  const LEG = 300;
  const legTopFrac = LEG_TOP[legs.id] ?? 0.15;
  const legVisibleTop = BODY_BOTTOM - 38;
  const legTop = legVisibleTop - legTopFrac * LEG;

  const anim = animate ? ' is-animated' : '';
  const imgStyle: CSSProperties = { width: '100%', height: '100%', display: 'block' };

  return (
    <div
      className={`char2d monster2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {/* legs (behind body) */}
        <img
          key={`legs-${legs.id}`}
          src={legs.img}
          alt={legs.label}
          draggable={false}
          className="part pop"
          style={box(BODY_CX, legTop + LEG / 2, LEG, 1)}
        />
        {/* right arm */}
        <div
          key={`arm-r-${arms.id}`}
          className="part pop arm-wiggle"
          style={{
            position: 'absolute',
            left: `${((rightAttachX - armBaseX) / VW) * 100}%`,
            top: `${((armAttachY - armBaseY) / VH) * 100}%`,
            width: `${(ARM / VW) * 100}%`,
            aspectRatio: '1 / 1',
            zIndex: 2,
            transformOrigin: '29% 90%',
          }}
        >
          <img src={arms.img} alt={arms.label} draggable={false} style={imgStyle} />
        </div>
        {/* left arm (mirrored) */}
        <div
          key={`arm-l-${arms.id}`}
          className="part pop"
          style={{
            position: 'absolute',
            left: `${((leftAttachX - (ARM - armBaseX)) / VW) * 100}%`,
            top: `${((armAttachY - armBaseY) / VH) * 100}%`,
            width: `${(ARM / VW) * 100}%`,
            aspectRatio: '1 / 1',
            zIndex: 2,
            transform: 'scaleX(-1)',
          }}
        >
          <div className="arm-wiggle" style={{ width: '100%', height: '100%', transformOrigin: '29% 90%' }}>
            <img src={arms.img} alt="" draggable={false} style={imgStyle} />
          </div>
        </div>
        {/* body */}
        <img
          key={`body-${body.id}`}
          src={body.img}
          alt={body.label}
          draggable={false}
          className="part pop"
          style={box(BODY_CX, BODY_CY, BODY_SIZE, 3)}
        />
        {/* mouth */}
        <img
          key={`mouth-${mouth.id}`}
          src={mouth.img}
          alt={mouth.label}
          draggable={false}
          className="part pop"
          style={box(BODY_CX, mouthCY, L.mouthSize, 4)}
        />
        {/* eyes */}
        <img
          key={`eyes-${eyes.id}`}
          src={eyes.img}
          alt={eyes.label}
          draggable={false}
          className="part pop blink"
          style={box(BODY_CX, eyeCY, L.eyeSize, 5)}
        />
      </div>
    </div>
  );
}

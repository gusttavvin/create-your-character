import type { CSSProperties } from 'react';
import { DRAGON, DRAGON_BODY_LAYOUT, resolveDragonColors } from './config';
import { findOption, type ColorMap, type PartMap } from '../types';

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

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

export default function Dragon2D({ parts, colors, animate = true, className }: Props) {
  const body = findOption(DRAGON, 'body', parts.body) ?? DRAGON.categories[0].options[0];
  const wings = findOption(DRAGON, 'wings', parts.wings) ?? DRAGON.categories[1].options[0];
  const horns = findOption(DRAGON, 'horns', parts.horns) ?? DRAGON.categories[2].options[0];
  const eyes = findOption(DRAGON, 'eyes', parts.eyes) ?? DRAGON.categories[3].options[0];
  const mouth = findOption(DRAGON, 'mouth', parts.mouth) ?? DRAGON.categories[4].options[0];
  const tail = findOption(DRAGON, 'tail', parts.tail) ?? DRAGON.categories[5].options[0];
  const L = DRAGON_BODY_LAYOUT[body.id] ?? DRAGON_BODY_LAYOUT.chubby;
  const eff = resolveDragonColors(parts, colors);

  const Body = body.Svg!;
  const Wings = wings.Svg!;
  const Horns = horns.Svg!;
  const Eyes = eyes.Svg!;
  const Mouth = mouth.Svg!;
  const Tail = tail.Svg!;

  const eyeCY = BODY_TOP + L.eyeY * BODY_H;
  const mouthCY = BODY_TOP + L.mouthY * BODY_H;
  // The fire mouth is drawn off-centre (flame to the right); shift it so the mouth stays on the face.
  const mouthDX = mouth.id === 'fire' ? (66 / 512) * L.mouthSize : 0;
  const HORN = 230;
  const hornCY = BODY_TOP + L.hornY * BODY_H - 34;
  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d dragon2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        <div key={`tail-${tail.id}`} className="part pop tail-wag" style={{ ...box(452, 520, 300, 0), transformOrigin: '12% 60%' }}>
          <Tail colors={eff} />
        </div>
        <div key={`wings-${wings.id}`} className="part pop wing-flap" style={box(BODY_CX, 372, 560, 1)}>
          <Wings colors={eff} />
        </div>
        <div key={`horns-${horns.id}`} className="part pop" style={box(BODY_CX, hornCY, HORN, 2)}>
          <Horns colors={eff} />
        </div>
        <div key={`body-${body.id}`} className="part pop" style={box(BODY_CX, BODY_CY, BODY_SIZE, 3)}>
          <Body colors={eff} />
        </div>
        <div key={`mouth-${mouth.id}`} className="part pop" style={box(BODY_CX + mouthDX, mouthCY, L.mouthSize, 4)}>
          <Mouth colors={eff} />
        </div>
        <div key={`eyes-${eyes.id}`} className="part pop blink" style={box(BODY_CX, eyeCY, L.eyeSize, 5)}>
          <Eyes colors={eff} />
        </div>
      </div>
    </div>
  );
}

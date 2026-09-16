import type { CSSProperties } from 'react';
import { SUPERHERO, resolveSuperheroColors } from './config';
import { Body, FaceEyes, HeadBase } from './parts';
import type { ColorMap, PartMap, PartOption, SlotLayout } from '../types';

const VW = 600;
const VH = 720;

/** Head box: 300 virtual units centred at (300, 168). Face circle r=160 in 512 space. */
const HEAD = { cx: 300, cy: 168, size: 300 };
/** Body box: 500 virtual units centred at (300, 440). Hands at (92,272) / (420,272) in 512 space. */
const BODY = { cx: 300, cy: 440, size: 500 };
/** Emblem box, sitting on the chest. */
const EMBLEM = { cx: 300, cy: 356, size: 130 };

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

/**
 * The chosen option for a category.
 * An empty id means the child erased that part, so nothing is drawn; an id that
 * is simply unknown falls back to the default option.
 */
function pick(categoryId: string, id: string | undefined): PartOption | null {
  if (id === '') return null;
  const cat = SUPERHERO.categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  return cat.options.find((o) => o.id === id) ?? cat.options.find((o) => o.id === SUPERHERO.defaultParts[categoryId]) ?? cat.options[0];
}

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function superheroSlots(parts: PartMap): SlotLayout {
  const shortCape = parts.cape === 'short';
  const capeCY = shortCape ? 490 : 582;
  const capeH = shortCape ? 150 : 210;
  const tallBoot = parts.boots === 'tall' || parts.boots === 'armour';
  const bootH = tallBoot ? 150 : 110;
  const bootCY = tallBoot ? 610 : 628;
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'cape', cx: 145, cy: capeCY, w: 110, h: capeH },
      { id: 'cape', cx: 455, cy: capeCY, w: 110, h: capeH },
      { id: 'suit', cx: 300, cy: 450, w: 190, h: 100 },
      { id: 'emblem', cx: EMBLEM.cx, cy: EMBLEM.cy, w: 130, h: 130 },
      { id: 'mask', cx: 300, cy: 170, w: 210, h: 110 },
      { id: 'power', cx: 140, cy: 452, w: 130, h: 150 },
      { id: 'power', cx: 460, cy: 452, w: 130, h: 150 },
      { id: 'boots', cx: 221, cy: bootCY, w: 120, h: bootH },
      { id: 'boots', cx: 379, cy: bootCY, w: 120, h: bootH },
    ],
  };
}

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

export default function Superhero2D({ parts, colors, animate = true, className }: Props) {
  const suit = pick('suit', parts.suit);
  const mask = pick('mask', parts.mask);
  const cape = pick('cape', parts.cape);
  const emblem = pick('emblem', parts.emblem);
  const power = pick('power', parts.power);
  const boots = pick('boots', parts.boots);
  const eff = resolveSuperheroColors(parts, colors);

  const Cape = cape?.Svg;
  const Suit = suit?.Svg;
  const Boots = boots?.Svg;
  const Emblem = emblem?.Svg;
  const Mask = mask?.Svg;
  const Power = power?.Svg;

  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d superhero2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {Cape && (
          <div
            key={`cape-${cape!.id}`}
            className="part pop dress-sway"
            style={{ ...box(BODY.cx, BODY.cy, BODY.size, 0), transformOrigin: '50% 14%' }}
          >
            <Cape colors={eff} />
          </div>
        )}
        <div className="part" style={box(BODY.cx, BODY.cy, BODY.size, 1)}>
          <Body colors={eff} />
        </div>
        {Suit && (
          <div key={`suit-${suit!.id}`} className="part pop" style={box(BODY.cx, BODY.cy, BODY.size, 2)}>
            <Suit colors={eff} />
          </div>
        )}
        {Boots && (
          <div key={`boots-${boots!.id}`} className="part pop" style={box(BODY.cx, BODY.cy, BODY.size, 3)}>
            <Boots colors={eff} />
          </div>
        )}
        {Emblem && (
          <div key={`emblem-${emblem!.id}`} className="part pop" style={box(EMBLEM.cx, EMBLEM.cy, EMBLEM.size, 4)}>
            <Emblem colors={eff} />
          </div>
        )}
        <div className="part" style={box(HEAD.cx, HEAD.cy, HEAD.size, 5)}>
          <HeadBase colors={eff} />
        </div>
        <div className="part blink" style={box(HEAD.cx, HEAD.cy, HEAD.size, 6)}>
          <FaceEyes colors={eff} />
        </div>
        {Mask && (
          <div key={`mask-${mask!.id}`} className="part pop" style={box(HEAD.cx, HEAD.cy, HEAD.size, 7)}>
            <Mask colors={eff} />
          </div>
        )}
        {Power && (
          <div
            key={`power-${power!.id}`}
            className="part pop acc-wave"
            style={{ ...box(BODY.cx, BODY.cy, BODY.size, 8), transformOrigin: '50% 30%' }}
          >
            <Power colors={eff} />
          </div>
        )}
      </div>
    </div>
  );
}

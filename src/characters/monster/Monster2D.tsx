import type { CSSProperties, ReactNode } from 'react';
import PartArt from '../../components/PartArt';
import { MONSTER, monsterColors } from './config';
import { MONSTER_BODY_LAYOUT, MONSTER_SHEET, type SlotRect } from './layout';
import { MONSTER_PART_BOX, MONSTER_PART_SPAN } from './parts';
import { pickOption, type ColorMap, type PartMap, type SlotLayout } from '../types';

const { vw: VW, vh: VH } = MONSTER_SHEET;

/**
 * Lays the monster out on the sheet.
 *
 * There is no invented geometry here and no magic numbers. Every piece is a slice of one of
 * the six drawings Clara approved and carries its own measured box; every body says where
 * that drawing kept its eyes, its mouth, its arms and its legs. Placing a piece is
 * therefore one step: put the piece's box on the body's box for that row.
 *
 * A piece worn by the creature it came from lands back exactly where the artist drew it,
 * because the two boxes are the same box. A piece borrowed from another creature is matched
 * to the width of the slot and keeps its own proportions, so a wide mouth stays wide and a
 * tall pair of legs stays tall instead of being squashed to fit.
 *
 * Stacking, back to front: legs, arms, body, mouth, eyes. The limbs go behind the body
 * because that is the order the drawings are painted in — a limb is tucked under the body's
 * own outline, which is what makes it look grown on rather than stuck on.
 */
const Z = { legs: 1, arms: 2, body: 3, mouth: 4, eyes: 5 };

/**
 * Where a piece lands: the middle of the slot, as large as it can be without leaving it.
 *
 * A piece worn by the creature it was cut from comes out exactly right, because its box and
 * the slot's box are the same box measured twice. What this decides is the borrowed case,
 * and it goes by width: the width of a slot is how far apart a creature's hands are, how
 * wide its face is, how far its feet stand — matching it is what puts a borrowed hand
 * beside the body instead of inside it. The height then follows from the piece's own shape,
 * so a mouth that is wide and shallow stays wide and shallow.
 *
 * The one thing width alone cannot handle is a piece that is far taller than its slot — the
 * orange monster holds one arm up and one down — so the height is capped, and the piece
 * shrinks a little rather than reaching over the head and past the feet.
 */
const TALLEST = 2.2;

function place(slot: SlotRect, optionId: string, z: number): CSSProperties {
  /**
   * A pair of arms is fitted by the hole it leaves, not by its box.
   *
   * The slot for that row is the width of the body where the arms meet it, and what has to
   * match it is the gap between the two arms. Fitted by the box, a pair that is mostly hole —
   * two little tentacles — ended up hanging in the air beside the body.
   */
  const box = MONSTER_PART_BOX[optionId];
  const span = MONSTER_PART_SPAN[optionId];
  let k = box ? slot.w / box[2] : 1;
  if (box && box[3] * k > slot.h * TALLEST) k = (slot.h * TALLEST) / box[3];
  const w = box ? box[2] * k : slot.w;
  const h = box ? box[3] * k : slot.h;
  return {
    position: 'absolute',
    // hung by the middle of the hole, not the middle of the box
    left: `${((slot.cx - w / 2 + (box && span ? (box[0] + box[2] / 2 - span[1]) * k : 0)) / VW) * 100}%`,
    top: `${((slot.cy - h / 2) / VH) * 100}%`,
    width: `${(w / VW) * 100}%`,
    height: `${(h / VH) * 100}%`,
    zIndex: z,
  };
}

function layoutOf(bodyId: string | undefined) {
  return MONSTER_BODY_LAYOUT[bodyId ?? 'round'] ?? MONSTER_BODY_LAYOUT.round;
}

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function monsterSlots(parts: PartMap): SlotLayout {
  const L = layoutOf(parts.body);
  return {
    vw: VW,
    vh: VH,
    slots: (['body', 'eyes', 'mouth', 'arms', 'legs'] as const).map((id) => ({
      id,
      cx: L[id].cx,
      cy: L[id].cy,
      w: L[id].w,
      h: L[id].h,
    })),
  };
}

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

/** A positioned layer. The pop animation owns the element's transform, so anything that
 *  needs its own transform goes on a wrapper inside it. */
function Layer({ part, style, extra, children }: { part: string; style: CSSProperties; extra?: string; children: ReactNode }) {
  return (
    <div className={`part pop${extra ? ` ${extra}` : ''}`} data-part={part} style={style}>
      {children}
    </div>
  );
}

export default function Monster2D({ parts, animate = true, className }: Props) {
  const body = pickOption(MONSTER, 'body', parts.body);
  const eyes = pickOption(MONSTER, 'eyes', parts.eyes);
  const mouth = pickOption(MONSTER, 'mouth', parts.mouth);
  const arms = pickOption(MONSTER, 'arms', parts.arms);
  const legs = pickOption(MONSTER, 'legs', parts.legs);

  const L = layoutOf(body?.id);
  // the colours come from the body the child picked, not from a colour they chose
  const eff = monsterColors(parts);
  const anim = animate ? ' is-animated' : '';

  return (
    <div
      className={`char2d monster2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {legs && (
          <Layer key={`legs-${legs.id}`} part="legs" style={place(L.legs, legs.id, Z.legs)}>
            <PartArt option={legs} colors={eff} />
          </Layer>
        )}

        {arms && (
          <Layer key={`arms-${arms.id}`} part="arms" style={place(L.arms, arms.id, Z.arms)}>
            <div className="arm-wiggle" style={{ width: '100%', height: '100%' }}>
              <PartArt option={arms} colors={eff} />
            </div>
          </Layer>
        )}

        {body && (
          <Layer key={`body-${body.id}`} part="body" style={place(L.body, body.id, Z.body)}>
            <PartArt option={body} colors={eff} />
          </Layer>
        )}

        {mouth && (
          <Layer key={`mouth-${mouth.id}`} part="mouth" style={place(L.mouth, mouth.id, Z.mouth)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}

        {eyes && (
          <Layer key={`eyes-${eyes.id}`} part="eyes" style={place(L.eyes, eyes.id, Z.eyes)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
      </div>
    </div>
  );
}

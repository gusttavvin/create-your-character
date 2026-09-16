import { lazy, Suspense } from 'react';
import type { CharacterKind, ColorMap, PartMap, SlotLayout, ViewMode } from '../characters/types';
import Character2D from './Character2D';
import { CHARACTERS } from '../characters/registry';
import { monsterSlots } from '../characters/monster/Monster2D';
import { dragonSlots } from '../characters/dragon/Dragon2D';
import { princessSlots } from '../characters/princess/Princess2D';
import { superheroSlots } from '../characters/superhero/Superhero2D';
import { fairySlots } from '../characters/fairy/Fairy2D';
import { useDrag } from '../lib/drag';

const Character3D = lazy(() => import('./Character3D'));

function slotsFor(kind: CharacterKind, parts: PartMap): SlotLayout {
  if (kind === 'dragon') return dragonSlots(parts);
  if (kind === 'princess') return princessSlots();
  if (kind === 'superhero') return superheroSlots(parts);
  if (kind === 'fairy') return fairySlots(parts);
  return monsterSlots(parts);
}

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
  mode: ViewMode;
  name?: string;
  /** Larger presentation variant */
  big?: boolean;
  /** Accepts parts dragged from the palette. */
  interactive?: boolean;
}

/** The taped sheet of paper where the character appears (2D layers or a 3D canvas). */
export default function Stage({ kind, parts, colors, mode, name, big, interactive }: Props) {
  const { drag } = useDrag();
  const def = CHARACTERS[kind];
  const layout = interactive && drag && mode === '2d' ? slotsFor(kind, parts) : null;

  return (
    <div
      className={`stage${big ? ' stage-big' : ''}${drag && interactive ? ' is-dropping' : ''}`}
      data-mode={mode}
      {...(interactive ? { 'data-drop-stage': '' } : {})}
    >
      <img className="stage-paper" src="/assets/monster/ui/paper.png" alt="" draggable={false} />
      <div className="stage-inner">
        {mode === '3d' ? (
          <Suspense
            fallback={
              <div className="stage-loading">
                <span className="spinner" /> Loading 3D…
              </div>
            }
          >
            <Character3D kind={kind} parts={parts} colors={colors} />
          </Suspense>
        ) : (
          <Character2D kind={kind} parts={parts} colors={colors} />
        )}
      </div>

      {layout && (
        <div className="stage-slots">
          {layout.slots.map((s, i) => {
            const cat = def.categories.find((c) => c.id === s.id);
            const isTarget = drag?.category.id === s.id;
            const isHot = isTarget && drag?.over === s.id;
            return (
              <div
                key={`${s.id}-${i}`}
                data-slot={s.id}
                className={`slot${isTarget ? ' is-target' : ''}${isHot ? ' is-hot' : ''}`}
                style={{
                  left: `${((s.cx - s.w / 2) / layout.vw) * 100}%`,
                  top: `${((s.cy - s.h / 2) / layout.vh) * 100}%`,
                  width: `${(s.w / layout.vw) * 100}%`,
                  height: `${(s.h / layout.vh) * 100}%`,
                  ['--row' as string]: cat?.color ?? '#FFD93D',
                }}
              >
                {isTarget && <span className="slot-label">{cat?.label}</span>}
              </div>
            );
          })}
        </div>
      )}

      {name ? <div className="stage-name">{name}</div> : null}
    </div>
  );
}

import { lazy, Suspense, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { NEUTRAL, isEmptyCharacter, type CharacterKind, type ColorMap, type LayoutMap, type PartMap, type SlotLayout, type ViewMode } from '../characters/types';
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
  /** Accepts parts dragged from the palette, and lets placed parts be moved. */
  interactive?: boolean;
  layout?: LayoutMap;
  /** Category the child is currently adjusting. */
  selected?: string | null;
  onSelect?: (categoryId: string | null) => void;
  /** New offset for a part, in virtual canvas units. */
  onMove?: (categoryId: string, dx: number, dy: number) => void;
}

/** The taped sheet of paper where the character appears (2D layers or a 3D canvas). */
export default function Stage({
  kind,
  parts,
  colors,
  mode,
  name,
  big,
  interactive,
  layout,
  selected,
  onSelect,
  onMove,
}: Props) {
  const { drag } = useDrag();
  const innerRef = useRef<HTMLDivElement>(null);
  const def = CHARACTERS[kind];
  const editing = !!interactive && mode === '2d';
  // nothing placed yet: the sheet stays blank instead of showing a bare mannequin
  const empty = isEmptyCharacter(parts);
  const showSlots = !!interactive && !!drag && mode === '2d';
  const layoutRects = showSlots ? slotsFor(kind, parts) : null;

  // mark the part being adjusted so it stands out under the child's finger
  useLayoutEffect(() => {
    const host = innerRef.current;
    if (!host) return;
    host.querySelectorAll<HTMLElement>('[data-part]').forEach((el) => {
      el.classList.toggle('is-picked', !!selected && el.dataset.part === selected);
    });
  });

  /** Dragging a part that is already on the sheet moves it. */
  const startMove = (e: ReactPointerEvent) => {
    if (!editing) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-part]');
    if (!target) {
      onSelect?.(null);
      return;
    }
    const id = target.dataset.part;
    if (!id) return;
    onSelect?.(id);
    const art = innerRef.current?.querySelector<HTMLElement>('.char2d');
    const unit = (art?.clientWidth ?? 600) / 600;
    const startX = e.clientX;
    const startY = e.clientY;
    const base = layout?.[id] ?? NEUTRAL;
    let moved = false;

    const move = (ev: PointerEvent) => {
      const px = ev.clientX - startX;
      const py = ev.clientY - startY;
      if (!moved && Math.hypot(px, py) < 4) return;
      moved = true;
      if (ev.cancelable) ev.preventDefault();
      onMove?.(id, base.dx + px / unit, base.dy + py / unit);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.classList.remove('is-dragging');
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    document.body.classList.add('is-dragging');
  };

  return (
    <div
      className={`stage${big ? ' stage-big' : ''}${drag && interactive ? ' is-dropping' : ''}${editing ? ' is-editing' : ''}`}
      data-mode={mode}
      {...(interactive ? { 'data-drop-stage': '' } : {})}
    >
      <img className="stage-paper" src="/assets/monster/ui/paper.png" alt="" draggable={false} />
      <div className="stage-inner" ref={innerRef} onPointerDown={startMove}>
        {empty ? (
          interactive ? (
            <p className="stage-empty">
              <span aria-hidden>👆</span>
              Drag a piece here to start
            </p>
          ) : null
        ) : mode === '3d' ? (
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
          <Character2D kind={kind} parts={parts} colors={colors} layout={layout} />
        )}
      </div>

      {layoutRects && (
        <div className="stage-slots">
          {layoutRects.slots.map((s, i) => {
            const cat = def.categories.find((c) => c.id === s.id);
            const isTarget = drag?.category.id === s.id;
            const isHot = isTarget && drag?.over === s.id;
            return (
              <div
                key={`${s.id}-${i}`}
                data-slot={s.id}
                className={`slot${isTarget ? ' is-target' : ''}${isHot ? ' is-hot' : ''}`}
                style={{
                  left: `${((s.cx - s.w / 2) / layoutRects.vw) * 100}%`,
                  top: `${((s.cy - s.h / 2) / layoutRects.vh) * 100}%`,
                  width: `${(s.w / layoutRects.vw) * 100}%`,
                  height: `${(s.h / layoutRects.vh) * 100}%`,
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

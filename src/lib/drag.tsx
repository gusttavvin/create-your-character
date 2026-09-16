import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { PartCategory, PartOption } from '../characters/types';

export interface DragInfo {
  category: PartCategory;
  option: PartOption;
  /** Pointer position in viewport pixels. */
  x: number;
  y: number;
  /** Slot id under the pointer, if any. */
  over: string | null;
  /** True while the pointer is over the character sheet. */
  onStage: boolean;
}

export type DropFn = (category: PartCategory, option: PartOption, slot: string | null) => void;

interface DragContextValue {
  drag: DragInfo | null;
  /** Starts a drag; a press without movement is treated as a plain tap instead. */
  beginDrag: (e: ReactPointerEvent, category: PartCategory, option: PartOption, onTap: () => void) => void;
  setDropHandler: (fn: DropFn | null) => void;
}

const DragContext = createContext<DragContextValue | null>(null);

/** How far the pointer must travel before a press becomes a drag. */
const THRESHOLD = 8;

function hitTest(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  return {
    slot: el?.closest('[data-slot]')?.getAttribute('data-slot') ?? null,
    onStage: !!el?.closest('[data-drop-stage]'),
  };
}

export function DragProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const dropRef = useRef<DropFn | null>(null);

  const setDropHandler = useCallback((fn: DropFn | null) => {
    dropRef.current = fn;
  }, []);

  const beginDrag = useCallback(
    (e: ReactPointerEvent, category: PartCategory, option: PartOption, onTap: () => void) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;

      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
        if (!moved) {
          moved = true;
          document.body.classList.add('is-dragging');
        }
        if (ev.cancelable) ev.preventDefault();
        const hit = hitTest(ev.clientX, ev.clientY);
        setDrag({ category, option, x: ev.clientX, y: ev.clientY, over: hit.slot, onStage: hit.onStage });
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', cancel);
        document.body.classList.remove('is-dragging');
        setDrag(null);
        if (!moved) {
          onTap();
          return;
        }
        const hit = hitTest(ev.clientX, ev.clientY);
        if (hit.onStage) dropRef.current?.(category, option, hit.slot);
      };

      const cancel = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', cancel);
        document.body.classList.remove('is-dragging');
        setDrag(null);
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', cancel);
    },
    [],
  );

  useEffect(() => () => document.body.classList.remove('is-dragging'), []);

  const value = useMemo(() => ({ drag, beginDrag, setDropHandler }), [drag, beginDrag, setDropHandler]);

  return (
    <DragContext.Provider value={value}>
      {children}
      {drag && <DragGhost drag={drag} />}
    </DragContext.Provider>
  );
}

function DragGhost({ drag }: { drag: DragInfo }) {
  const Svg = drag.option.Svg;
  return (
    <div
      className={`drag-ghost${drag.onStage ? ' is-over' : ''}`}
      style={{ left: drag.x, top: drag.y, ['--row' as string]: drag.category.color }}
      aria-hidden
    >
      {drag.option.img ? <img src={drag.option.img} alt="" draggable={false} /> : Svg ? <Svg colors={{}} /> : null}
    </div>
  );
}

export function useDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside DragProvider');
  return ctx;
}

/** Registers the character sheet as the place parts can be dropped. */
export function useDropTarget(onDrop: DropFn) {
  const { setDropHandler } = useDrag();
  const ref = useRef(onDrop);
  ref.current = onDrop;
  useEffect(() => {
    const fn: DropFn = (c, o, s) => ref.current(c, o, s);
    setDropHandler(fn);
    return () => setDropHandler(null);
  }, [setDropHandler]);
}

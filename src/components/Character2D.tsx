import { useLayoutEffect, useRef } from 'react';
import Monster2D from '../characters/monster/Monster2D';
import Dragon2D from '../characters/dragon/Dragon2D';
import Princess2D from '../characters/princess/Princess2D';
import Superhero2D from '../characters/superhero/Superhero2D';
import Fairy2D from '../characters/fairy/Fairy2D';
import type { CharacterKind, ColorMap, LayoutMap, PartMap } from '../characters/types';

/** Every character composes its parts on a canvas this many units wide. */
const VW = 600;

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
  /** Nudges and resizes the child applied to individual parts. */
  layout?: LayoutMap;
  animate?: boolean;
  className?: string;
}

/**
 * Picks the right 2D compositor for a character kind, then applies the child's own
 * nudges on top.
 *
 * Each compositor tags its layers with `data-part="<category id>"`. The offsets are
 * stored in virtual canvas units, so they are converted with the live pixel size of
 * the stage. They are written to the `translate` and `scale` properties rather than
 * `transform`, which the pop animation already owns.
 */
export default function Character2D({ kind, parts, colors, layout, animate = true, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const apply = () => {
      const unit = root.clientWidth / VW;
      root.querySelectorAll<HTMLElement>('[data-part]').forEach((el) => {
        const t = layout?.[el.dataset.part ?? ''];
        el.style.translate = t ? `${t.dx * unit}px ${t.dy * unit}px` : '';
        el.style.scale = t ? String(t.s) : '';
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(root);
    return () => ro.disconnect();
  });

  const common = { parts, colors, animate, className };
  return (
    <div ref={ref} className="char2d-host">
      {kind === 'dragon' ? (
        <Dragon2D {...common} />
      ) : kind === 'princess' ? (
        <Princess2D {...common} />
      ) : kind === 'superhero' ? (
        <Superhero2D {...common} />
      ) : kind === 'fairy' ? (
        <Fairy2D {...common} />
      ) : (
        <Monster2D parts={parts} animate={animate} className={className} />
      )}
    </div>
  );
}

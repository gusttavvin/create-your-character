import { lazy, Suspense } from 'react';
import type { CharacterKind, ColorMap, PartMap, ViewMode } from '../characters/types';
import Character2D from './Character2D';

const Character3D = lazy(() => import('./Character3D'));

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
  mode: ViewMode;
  name?: string;
  /** Larger presentation variant */
  big?: boolean;
}

/** The taped sheet of paper where the character appears (2D layers or a 3D canvas). */
export default function Stage({ kind, parts, colors, mode, name, big }: Props) {
  return (
    <div className={`stage${big ? ' stage-big' : ''}`} data-mode={mode}>
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
      {name ? <div className="stage-name">{name}</div> : null}
    </div>
  );
}

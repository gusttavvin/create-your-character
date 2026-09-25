import type { CharacterDefinition, PartMap, ViewMode } from '../characters/types';
import { ERASED } from '../characters/types';
import { movable3d } from '../characters/movable3d';

interface Props {
  def: CharacterDefinition;
  mode: ViewMode;
  parts: PartMap;
  /** Whether anything has been moved or resized, which the "put everything back" button needs. */
  touched: boolean;
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  onResetAll: () => void;
}

/**
 * Lets the child choose which part they are adjusting: drag it on the picture, or pick
 * it here and use the size buttons beside the character. Only parts actually on the
 * sheet are listed.
 */
export default function AdjustBar({ def, mode, parts, touched, selected, onSelect, onResetAll }: Props) {
  // in 3D the face is painted on the head, so only the pieces that stand on their own are listed
  const movable = mode === '3d' ? movable3d(def.kind, parts) : null;
  const placed = def.categories.filter((c) => parts[c.id] !== ERASED && (!movable || movable.includes(c.id)));
  if (placed.length === 0) return null;

  const current = selected && parts[selected] !== ERASED && placed.some((c) => c.id === selected) ? selected : null;

  return (
    <div className="adjust">
      <span className="adjust-hint">
        {mode === '3d' ? 'Drag a piece on the model to move it' : 'Drag a piece on the picture to move it'}
      </span>
      <div className="adjust-parts">
        {placed.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`adjust-chip${current === c.id ? ' is-on' : ''}`}
            style={{ ['--row' as string]: c.color }}
            onClick={() => onSelect(current === c.id ? null : c.id)}
            aria-pressed={current === c.id}
          >
            {c.label}
          </button>
        ))}
        {touched && (
          <button type="button" className="adjust-chip adjust-reset-all" onClick={onResetAll} title="Put every piece back">
            ↺ All
          </button>
        )}
      </div>

    </div>
  );
}

import type { CharacterDefinition, LayoutMap, PartMap } from '../characters/types';
import { ERASED, MAX_SCALE, MIN_SCALE, NEUTRAL } from '../characters/types';

interface Props {
  def: CharacterDefinition;
  parts: PartMap;
  layout: LayoutMap;
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  onScale: (categoryId: string, s: number) => void;
  onReset: (categoryId: string) => void;
  onResetAll: () => void;
}

const STEP = 0.12;

/**
 * Lets the child move and resize a part they already placed: drag it on the picture,
 * or pick it here and use the buttons. Only parts actually on the sheet are listed.
 */
export default function AdjustBar({ def, parts, layout, selected, onSelect, onScale, onReset, onResetAll }: Props) {
  const placed = def.categories.filter((c) => parts[c.id] !== ERASED);
  if (placed.length === 0) return null;

  const current = selected && parts[selected] !== ERASED ? selected : null;
  const cat = current ? def.categories.find((c) => c.id === current) : null;
  const t = current ? layout[current] ?? NEUTRAL : NEUTRAL;
  const touched = Object.keys(layout).length > 0;

  return (
    <div className="adjust">
      <span className="adjust-hint">Drag a piece on the picture to move it</span>
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

      {cat && (
        <div className="adjust-tools" style={{ ['--row' as string]: cat.color }}>
          <span className="adjust-name">{cat.label}</span>
          <button
            type="button"
            className="adjust-btn"
            onClick={() => onScale(cat.id, t.s - STEP)}
            disabled={t.s <= MIN_SCALE + 0.001}
            aria-label={`Make the ${cat.label.toLowerCase()} smaller`}
          >
            −
          </button>
          <span className="adjust-size">{Math.round(t.s * 100)}%</span>
          <button
            type="button"
            className="adjust-btn"
            onClick={() => onScale(cat.id, t.s + STEP)}
            disabled={t.s >= MAX_SCALE - 0.001}
            aria-label={`Make the ${cat.label.toLowerCase()} bigger`}
          >
            +
          </button>
          <button type="button" className="adjust-btn adjust-btn-wide" onClick={() => onReset(cat.id)}>
            ↺ Put back
          </button>
        </div>
      )}
    </div>
  );
}

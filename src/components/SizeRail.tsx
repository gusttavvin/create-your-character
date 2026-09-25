import type { PartCategory, PartTransform } from '../characters/types';
import { MAX_SCALE, MIN_SCALE, TURN_STEP } from '../characters/types';

interface Props {
  category: PartCategory;
  transform: PartTransform;
  onScale: (categoryId: string, s: number) => void;
  onTurn: (categoryId: string, r: number) => void;
  onReset: (categoryId: string) => void;
}

const STEP = 0.12;

/**
 * The size buttons, glued to the right of the picture.
 *
 * They used to sit under the sheet, which meant scrolling the page in the middle of a
 * lesson to make an eye smaller. Here they are always next to the character, in reach.
 */
export default function SizeRail({ category, transform, onScale, onTurn, onReset }: Props) {
  const word = category.label.toLowerCase();
  return (
    <div className="rail" style={{ ['--row' as string]: category.color }}>
      <span className="rail-name">{category.label}</span>
      <button
        type="button"
        className="rail-btn"
        onClick={() => onScale(category.id, transform.s + STEP)}
        disabled={transform.s >= MAX_SCALE - 0.001}
        aria-label={`Make the ${word} bigger`}
      >
        +
      </button>
      <span className="rail-size">{Math.round(transform.s * 100)}%</span>
      <button
        type="button"
        className="rail-btn"
        onClick={() => onScale(category.id, transform.s - STEP)}
        disabled={transform.s <= MIN_SCALE + 0.001}
        aria-label={`Make the ${word} smaller`}
      >
        −
      </button>
      <div className="rail-turn">
        <button
          type="button"
          className="rail-btn rail-btn-small"
          onClick={() => onTurn(category.id, (transform.r ?? 0) - TURN_STEP)}
          aria-label={`Turn the ${word} left`}
          title="Turn it left"
        >
          ↰
        </button>
        <button
          type="button"
          className="rail-btn rail-btn-small"
          onClick={() => onTurn(category.id, (transform.r ?? 0) + TURN_STEP)}
          aria-label={`Turn the ${word} right`}
          title="Turn it right"
        >
          ↱
        </button>
      </div>
      <button
        type="button"
        className="rail-btn rail-back"
        onClick={() => onReset(category.id)}
        aria-label={`Put the ${word} back`}
        title="Put it back where it started, at 100%"
      >
        ↺
      </button>
    </div>
  );
}

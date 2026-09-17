import type { CharacterDefinition, PartCategory, PartOption } from '../characters/types';
import { useDrag } from '../lib/drag';

const UI = '/assets/monster/ui';

/** The three little dashes the worksheet draws either side of its headings. */
function Dashes({ side }: { side: 'l' | 'r' }) {
  return (
    <svg className={'ws-dashes ws-dashes-' + side} viewBox="0 0 34 54" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M6 12 L28 5" />
        <path d="M4 27 L29 27" />
        <path d="M6 42 L28 49" />
      </g>
    </svg>
  );
}

/**
 * "CREATE YOUR ___", drawn the same way for every character.
 * It used to be a crop of the worksheet for the monster, which clipped the first letter
 * and could not spell any other character's name.
 */
export function TitleBanner({ def }: { def: CharacterDefinition }) {
  return (
    <h1 className="ws-title" aria-label={def.title}>
      <Dashes side="l" />
      <span className="ws-title-words">
        <span className="t-cream">Create Your</span> <span className="t-yellow">{def.noun}</span>
      </span>
      <Dashes side="r" />
    </h1>
  );
}

/** The "USE YOUR IMAGINATION!" badge, redrawn so nothing is cut off. */
export function Sticker() {
  return (
    <div className="ws-sticker" aria-label="Use your imagination!">
      <Dashes side="l" />
      <span className="ws-sticker-brush">
        <svg className="ws-sticker-ink" viewBox="0 0 320 120" aria-hidden focusable="false" preserveAspectRatio="none">
          <path
            d="M10,34 C60,16 120,10 180,14 C240,18 300,20 312,36 C318,58 306,86 292,98 C250,112 150,110 90,106 C40,102 8,94 6,72 C5,56 6,42 10,34 Z"
            fill="var(--yellow)"
          />
        </svg>
        <span className="ws-sticker-text">
          Use your
          <br />
          imagination!
        </span>
      </span>
      <Dashes side="r" />
    </div>
  );
}

/** Colored row label ("BODY", "EYES"...). Monster rows use the worksheet crops. */
export function LabelTile({ def, category }: { def: CharacterDefinition; category: PartCategory }) {
  if (def.kind === 'monster') {
    return <img className="ws-label ws-label-img" src={`${UI}/label_${category.id}.png`} alt={category.label} />;
  }
  return (
    <div className="ws-label ws-label-css" style={{ background: category.color }}>
      <span className="ws-label-text">{category.label}</span>
    </div>
  );
}

export function GenericTile({ label, color }: { label: string; color: string }) {
  return (
    <div className="ws-label ws-label-css" style={{ background: color }}>
      <span className="ws-label-text">{label}</span>
    </div>
  );
}

interface CardProps {
  category: PartCategory;
  option: PartOption;
  selected: boolean;
  onPick: (category: PartCategory, option: PartOption) => void;
}

export function OptionCard({ category, option, selected, onPick }: CardProps) {
  const Svg = option.Svg;
  const { beginDrag, drag } = useDrag();
  const held = drag?.option.id === option.id && drag.category.id === category.id;
  return (
    <button
      type="button"
      className={`ws-card${selected ? ' is-selected' : ''}${held ? ' is-held' : ''}`}
      style={{ ['--row' as string]: category.color }}
      onPointerDown={(e) => beginDrag(e, category, option, () => onPick(category, option))}
      // A pointer tap picks the part through beginDrag; detail 0 means the keyboard did it.
      onClick={(e) => {
        if (e.detail === 0) onPick(category, option);
      }}
      aria-pressed={selected}
      title={`${option.phrase} — drag me onto the picture`}
    >
      <span className="ws-card-art">
        {option.img ? <img src={option.img} alt="" draggable={false} /> : Svg ? <Svg colors={{}} /> : null}
      </span>
      <span className="ws-card-label">{option.label}</span>
      {selected && (
        <span className="ws-card-check" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}

export function PartRow({
  def,
  category,
  value,
  onPick,
  onErase,
}: {
  def: CharacterDefinition;
  category: PartCategory;
  value: string;
  onPick: (category: PartCategory, option: PartOption) => void;
  onErase: (category: PartCategory) => void;
}) {
  const erased = value === '';
  return (
    <div className="ws-row" data-cat={category.id}>
      <LabelTile def={def} category={category} />
      {category.options.map((o) => (
        <OptionCard key={o.id} category={category} option={o} selected={value === o.id} onPick={onPick} />
      ))}
      {category.optional ? (
        <button
          type="button"
          className={`ws-erase${erased ? ' is-on' : ''}`}
          style={{ ['--row' as string]: category.color }}
          onClick={() => onErase(category)}
          aria-pressed={erased}
          title={`No ${category.label.toLowerCase()}`}
        >
          <span className="ws-erase-mark" aria-hidden />
          <span className="ws-erase-text">None</span>
        </button>
      ) : (
        <span className="ws-erase-gap" aria-hidden />
      )}
    </div>
  );
}

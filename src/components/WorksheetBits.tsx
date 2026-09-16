import type { CharacterDefinition, PartCategory, PartOption } from '../characters/types';
import { useDrag } from '../lib/drag';

const UI = '/assets/monster/ui';

/** Big "CREATE YOUR ___" banner. The monster one is the original worksheet art. */
export function TitleBanner({ def }: { def: CharacterDefinition }) {
  if (def.kind === 'monster') {
    return <img className="ws-title ws-title-img" src={`${UI}/title.png`} alt="Create Your Monster" />;
  }
  return (
    <h1 className="ws-title ws-title-text" aria-label={def.title}>
      <span className="doodle doodle-l" aria-hidden />
      <span className="t-cream">Create Your</span> <span className="t-yellow">{def.noun}</span>
      <span className="doodle doodle-r" aria-hidden />
    </h1>
  );
}

export function Sticker() {
  return <img className="ws-sticker" src={`${UI}/sticker.png`} alt="Use your imagination!" />;
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

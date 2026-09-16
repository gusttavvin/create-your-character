import type { ColorMap, ColorSlot } from '../characters/types';
import { GenericTile } from './WorksheetBits';

interface Props {
  slots: ColorSlot[];
  colors: ColorMap;
  onPick: (slot: ColorSlot, value: string, label: string) => void;
}

/** "COLORS" row with swatches for each paintable slot (skin, hair, dress, body, wings...). */
export default function ColorRow({ slots, colors, onPick }: Props) {
  if (!slots.length) return null;
  return (
    <div className="ws-row ws-row-colors">
      <GenericTile label="Colors" color="#FFB8D9" />
      <div className="ws-colors">
        {slots.map((slot) => (
          <div key={slot.id} className="ws-color-slot">
            <span className="ws-color-name">{slot.label}</span>
            <div className="ws-swatches">
              {slot.swatches.map((sw) => {
                const on = (colors[slot.id] || '') === sw.value;
                return (
                  <button
                    key={sw.id}
                    type="button"
                    className={`swatch${on ? ' is-on' : ''}`}
                    style={{ background: sw.value }}
                    title={sw.label}
                    aria-label={`${slot.label}: ${sw.label}`}
                    aria-pressed={on}
                    onClick={() => onPick(slot, sw.value, sw.label)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

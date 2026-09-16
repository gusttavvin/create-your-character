import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  normalizeColors,
  normalizeParts,
  randomColors,
  randomParts,
  type CharacterDefinition,
  type ColorMap,
  type ColorSlot,
  type PartCategory,
  type PartMap,
  type PartOption,
  type SavedCharacter,
} from '../characters/types';
import { usePrefs } from '../lib/prefs';
import { useStore } from '../lib/useStore';
import { useAuth } from '../lib/auth';
import { speak } from '../lib/speech';
import { playPop, playShuffle, playTada, playClick } from '../lib/sounds';
import { burstConfetti } from '../lib/confetti';
import { PartRow, Sticker, TitleBanner } from './WorksheetBits';
import ColorRow from './ColorRow';
import Stage from './Stage';
import NameDialog from './NameDialog';
import Sentence from './Sentence';

interface Props {
  def: CharacterDefinition;
  initial?: SavedCharacter | null;
}

export default function Builder({ def, initial }: Props) {
  const { mode, setMode } = usePrefs();
  const store = useStore();
  const { role } = useAuth();

  const [parts, setParts] = useState<PartMap>(() => normalizeParts(def, initial?.parts));
  const [colors, setColors] = useState<ColorMap>(() => normalizeColors(def, initial?.colors));
  const [name, setName] = useState(initial?.name ?? '');
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [dirty, setDirty] = useState(false);
  const [naming, setNaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Reset when switching character or loading another saved one.
  useEffect(() => {
    setParts(normalizeParts(def, initial?.parts));
    setColors(normalizeColors(def, initial?.colors));
    setName(initial?.name ?? '');
    setSavedId(initial?.id);
    setDirty(false);
  }, [def, initial]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = useCallback((category: PartCategory, option: PartOption) => {
    setParts((p) => ({ ...p, [category.id]: option.id }));
    setDirty(true);
    playPop();
    speak(option.phrase);
  }, []);

  const pickColor = useCallback((slot: ColorSlot, value: string, label: string) => {
    setColors((c) => ({ ...c, [slot.id]: value }));
    setDirty(true);
    playPop();
    speak(label);
  }, []);

  const surprise = () => {
    setParts(randomParts(def));
    setColors(randomColors(def));
    setDirty(true);
    playShuffle();
    speak('Surprise!');
  };

  const reset = () => {
    setParts({ ...def.defaultParts });
    setColors({ ...def.defaultColors });
    setDirty(true);
    playClick();
  };

  const sentence = def.sentence(parts, name || undefined);
  const readAloud = () => speak(sentence, { force: true, rate: 0.85 });

  const doSave = async (chosen: string) => {
    setSaving(true);
    try {
      const saved = await store.save({ id: savedId, kind: def.kind, name: chosen, parts, colors });
      setSavedId(saved.id);
      setName(chosen);
      setDirty(false);
      setNaming(false);
      burstConfetti();
      playTada();
      speak(`Great job! ${chosen} the ${def.noun.toLowerCase()} is saved!`, { force: true });
      setToast(`${chosen} is saved ${store.kind === 'cloud' ? 'in the cloud ☁️' : 'on this device 💾'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      setToast(`Oops! ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="worksheet" data-kind={def.kind}>
      <div className="ws-head">
        <TitleBanner def={def} />
        <Sticker />
      </div>

      <div className="ws-body">
        <div className="ws-grid">
          {def.categories.map((c) => (
            <PartRow key={c.id} def={def} category={c} value={parts[c.id]} onPick={pick} />
          ))}
          <ColorRow slots={def.colorSlots} colors={colors} onPick={pickColor} />
        </div>

        <div className="ws-side">
          <div className="ws-stage-tools">
            <div className="seg seg-small" role="group" aria-label="View">
              <button type="button" className={mode === '2d' ? 'is-on' : ''} onClick={() => setMode('2d')}>
                2D
              </button>
              <button type="button" className={mode === '3d' ? 'is-on' : ''} onClick={() => setMode('3d')}>
                3D
              </button>
            </div>
            {mode === '3d' && <span className="hint">Drag to spin · scroll to zoom</span>}
          </div>

          <Stage kind={def.kind} parts={parts} colors={colors} mode={mode} name={name} />

          <Sentence def={def} parts={parts} name={name || undefined} onRead={readAloud} />

          <div className="ws-actions">
            <button type="button" className="btn btn-fun" onClick={surprise}>
              🎲 Surprise me!
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              ↺ Start over
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNaming(true)}>
              {savedId ? (dirty ? '💾 Save changes' : '✏️ Rename') : '💾 Name & Save'}
            </button>
            {savedId && (
              <Link className="btn btn-ghost" to={`/c/${savedId}`}>
                ⭐ Show
              </Link>
            )}
          </div>

          {role === 'guest' && (
            <p className="ws-note">
              You are playing as a guest: characters are saved on this device only.{' '}
              <Link to="/join">Join your class</Link> to keep them online.
            </p>
          )}
        </div>
      </div>

      <NameDialog
        open={naming}
        noun={def.noun}
        initialName={name}
        saving={saving}
        onCancel={() => setNaming(false)}
        onSave={(n) => void doSave(n)}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

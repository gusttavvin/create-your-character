import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ERASED,
  emptyParts,
  normalizeColors,
  normalizeLayout,
  normalizeParts,
  randomColors,
  randomParts,
  withTransform,
  type CharacterDefinition,
  type ColorMap,
  type ColorSlot,
  type LayoutMap,
  type PartCategory,
  type PartMap,
  type PartOption,
  type SavedCharacter,
} from '../characters/types';
import { usePrefs } from '../lib/prefs';
import { useDropTarget } from '../lib/drag';
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
import AdjustBar from './AdjustBar';

interface Props {
  def: CharacterDefinition;
  initial?: SavedCharacter | null;
}

export default function Builder({ def, initial }: Props) {
  const { mode, setMode } = usePrefs();
  const store = useStore();
  const { role } = useAuth();

  const [parts, setParts] = useState<PartMap>(() => (initial ? normalizeParts(def, initial.parts) : emptyParts(def)));
  const [colors, setColors] = useState<ColorMap>(() => normalizeColors(def, initial?.colors));
  const [layout, setLayout] = useState<LayoutMap>(() => normalizeLayout(initial?.layout));
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [dirty, setDirty] = useState(false);
  const [naming, setNaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Reset when switching character or loading another saved one.
  useEffect(() => {
    setParts(initial ? normalizeParts(def, initial.parts) : emptyParts(def));
    setColors(normalizeColors(def, initial?.colors));
    setLayout(normalizeLayout(initial?.layout));
    setSelected(null);
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

  // A part dropped anywhere on the sheet is applied: little hands miss, and the
  // glowing slot already teaches where the piece belongs.
  useDropTarget((category, option) => pick(category, option));

  /** Take a part off again. Base parts are not erasable, so they never reach here. */
  const erase = useCallback((category: PartCategory) => {
    setParts((p) => ({ ...p, [category.id]: ERASED }));
    // a part that is gone should not keep the nudge it had
    setLayout((l) => {
      if (!l[category.id]) return l;
      const next = { ...l };
      delete next[category.id];
      return next;
    });
    setSelected((cur) => (cur === category.id ? null : cur));
    setDirty(true);
    playClick();
    speak(`No ${category.label.toLowerCase()}`);
  }, []);

  const movePart = useCallback((categoryId: string, dx: number, dy: number) => {
    setLayout((l) => withTransform(l, categoryId, { dx, dy }));
    setDirty(true);
  }, []);

  const scalePart = useCallback((categoryId: string, s: number) => {
    setLayout((l) => withTransform(l, categoryId, { s }));
    setDirty(true);
    playClick();
  }, []);

  const resetPart = useCallback((categoryId: string) => {
    setLayout((l) => withTransform(l, categoryId, { dx: 0, dy: 0, s: 1 }));
    setDirty(true);
    playClick();
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
    setLayout({});
    setSelected(null);
    setDirty(true);
    playShuffle();
    speak('Surprise!');
  };

  const reset = () => {
    setParts(emptyParts(def));
    setColors({ ...def.defaultColors });
    setLayout({});
    setSelected(null);
    setDirty(true);
    playClick();
  };

  const sentence = def.sentence(parts, name || undefined);
  const readAloud = () => speak(sentence, { force: true, rate: 0.85 });

  const doSave = async (chosen: string) => {
    setSaving(true);
    try {
      const saved = await store.save({ id: savedId, kind: def.kind, name: chosen, parts, colors, layout });
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
            <PartRow key={c.id} def={def} category={c} value={parts[c.id]} onPick={pick} onErase={erase} />
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
            <span className="hint">
              {mode === '3d' ? 'Drag to spin · scroll to zoom' : 'Drag a piece onto the picture, or tap it'}
            </span>
          </div>

          <Stage
            kind={def.kind}
            parts={parts}
            colors={colors}
            layout={layout}
            mode={mode}
            name={name}
            interactive
            selected={selected}
            onSelect={setSelected}
            onMove={movePart}
          />

          {mode === '2d' && (
            <AdjustBar
              def={def}
              parts={parts}
              layout={layout}
              selected={selected}
              onSelect={setSelected}
              onScale={scalePart}
              onReset={resetPart}
              onResetAll={() => {
                setLayout({});
                setDirty(true);
                playClick();
              }}
            />
          )}

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
              You are playing as a guest: characters are saved on this device only.{' '} Sign in on the Teacher page to keep them online.
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

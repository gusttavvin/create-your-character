import { useEffect, useRef, useState, type FormEvent } from 'react';
import { speak } from '../lib/speech';
import { playClick } from '../lib/sounds';

const SUGGESTIONS = ['Bobo', 'Zizi', 'Fluffy', 'Sparkle', 'Rex', 'Luna', 'Pip', 'Momo', 'Ziggy', 'Nova', 'Coco', 'Blueberry', 'Sunny', 'Pepper', 'Bubbles', 'Rosie'];

interface Props {
  open: boolean;
  noun: string;
  initialName?: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export default function NameDialog({ open, noun, initialName = '', saving, onCancel, onSave }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 24);
    if (!clean) {
      inputRef.current?.focus();
      return;
    }
    onSave(clean);
  };

  const suggest = () => {
    const pick = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    setName(pick);
    playClick();
    speak(pick);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="name-title">
        <h2 id="name-title">What is your {noun.toLowerCase()}'s name?</h2>
        <p className="modal-hint">Type a name in English. You can use a silly one!</p>
        <div className="modal-row">
          <input
            ref={inputRef}
            className="input input-big"
            value={name}
            maxLength={24}
            placeholder="e.g. Fluffy"
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="btn btn-ghost" onClick={suggest} title="Suggest a name">
            🎲
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { chooseVoice, chosenVoice, englishVoices, speak } from '../lib/speech';

/**
 * The voice that reads the words aloud, chosen and heard first (Clara found the old woman's
 * voice bad). The computer's English voices are listed best first; the choice is kept on it.
 */
export default function VoicePicker() {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [chosen, setChosen] = useState(chosenVoice);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = () => setVoices(englishVoices().slice(0, 12));
    load();
    speechSynthesis?.addEventListener?.('voiceschanged', load);
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => {
      speechSynthesis?.removeEventListener?.('voiceschanged', load);
      document.removeEventListener('pointerdown', away);
    };
  }, [open]);

  if (typeof speechSynthesis === 'undefined') return null;
  const best = voices[0]?.name;

  return (
    <div className="voice-picker" ref={box}>
      <button type="button" className="icon-btn" title="Choose the voice" aria-expanded={open} onClick={() => setOpen(!open)}>
        🗣
      </button>
      {open && (
        <div className="voice-menu" role="dialog" aria-label="Choose the voice">
          <p className="voice-title">Which voice reads the words?</p>
          {voices.length === 0 && <p className="wheel-hint">No English voices on this computer.</p>}
          {voices.map((v) => {
            const on = (chosen || best) === v.name;
            return (
              <div key={v.name} className={`voice-row${on ? ' is-on' : ''}`}>
                <button
                  type="button"
                  className="voice-pick"
                  onClick={() => {
                    chooseVoice(v.name);
                    setChosen(v.name);
                    speak('Hello! Let’s play in English!', { force: true });
                  }}
                >
                  {on ? '●' : '○'} {v.name.replace(/^Microsoft |^Google /, '').replace(/ - English.*$/, '').replace(/\s*\(.*\)/, '')}
                  <small>{v.lang}</small>
                </button>
              </div>
            );
          })}
          <p className="wheel-hint">Click a voice to hear it.</p>
        </div>
      )}
    </div>
  );
}

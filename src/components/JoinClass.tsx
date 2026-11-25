import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

/**
 * At the top of the site, for a student with an account: join a teacher's class by the code the
 * teacher gives (accounts are made first, the class joined after). Shows the class once joined.
 */
export default function JoinClass() {
  const { role, profile, enterClass } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  if (role !== 'student') return null;
  const inClass = !!profile?.class_id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const name = await enterClass(code);
      setMsg({ ok: true, text: `🎉 You are in ${name || 'the class'}!` });
      setCode('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Try again!' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-class" ref={box}>
      <button type="button" className="chip chip-join" aria-expanded={open} onClick={() => (setOpen(!open), setMsg(null))}>
        {inClass ? '🏫 My class' : '🏫 Join a class'}
      </button>
      {open && (
        <form className="voice-menu join-menu" onSubmit={submit}>
          <p className="voice-title">{inClass ? 'Change class' : 'Join a class'}</p>
          <label className="field">
            <span>Class code (ask your teacher)</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoFocus autoCapitalize="characters" required />
          </label>
          {msg && <p className={`note ${msg.ok ? 'note-ok' : 'note-error'}`}>{msg.text}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
            {busy ? 'Just a moment…' : "Let's go!"}
          </button>
        </form>
      )}
    </div>
  );
}

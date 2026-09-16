import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { speak } from '../lib/speech';
import { playTada } from '../lib/sounds';

export default function JoinPage() {
  const { hasBackend, role, displayName, joinClass, signOut, ready } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasBackend) {
    return (
      <div className="form-page">
        <h1 className="page-title">🎒 Join Class</h1>
        <p className="note">
          Online classes are not set up yet, but you can still play! Your characters are saved on this device.
        </p>
        <Link to="/" className="btn btn-primary">
          Start creating
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="center-msg">
        <span className="spinner" />
      </div>
    );
  }

  if (role !== 'guest') {
    return (
      <div className="form-page">
        <h1 className="page-title">🎒 You are in!</h1>
        <p className="note">
          You are signed in as <b>{displayName}</b>. Your characters are saved online.
        </p>
        <div className="form-actions">
          <Link to="/" className="btn btn-primary">
            Start creating
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Leave class
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !nick.trim()) {
      setError('Please type the class code and your name.');
      return;
    }
    setBusy(true);
    try {
      await joinClass(code, nick);
      playTada();
      speak(`Welcome, ${nick.trim()}!`, { force: true });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the class');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-page">
      <h1 className="page-title">🎒 Join Class</h1>
      <p className="note">Ask your teacher for the class code. No e-mail needed!</p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Class code</span>
          <input
            className="input input-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC12"
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Your name</span>
          <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Maria" maxLength={24} autoComplete="off" />
        </label>
        {error && <p className="note note-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Joining…' : '🚀 Join'}
        </button>
      </form>
    </div>
  );
}

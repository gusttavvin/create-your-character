import { useState, type FormEvent, type ReactNode } from 'react';
import Logo from '../components/Logo';
import { cleanUsername, useAuth } from '../lib/auth';
import { playClick } from '../lib/sounds';

/**
 * The door of the site, the first time someone comes in (and whenever a guest clicks "Guest"):
 * log in, create an account, or play as a guest. Logging in and creating an account both start
 * with "I'm a student" or "I'm a teacher" (the teacher's sign-in, once in the Teacher area, is
 * here too). A student has a username and no e-mail; a teacher an e-mail. A guest plays as a
 * student, without an account. The site is public: anyone can come in. A guest's choice is
 * remembered on that computer (WELCOMED), so the door does not come back every time.
 */
const WELCOMED = 'funny-games:welcomed';

export function wasWelcomed() {
  try {
    return localStorage.getItem(WELCOMED) === '1';
  } catch {
    return true;
  }
}

function markWelcomed() {
  try {
    localStorage.setItem(WELCOMED, '1');
  } catch {
    /* a blocked storage: the door just shows again next time */
  }
}

export type Who = 'student' | 'teacher';
type Intent = 'login' | 'new';
type Step = 'door' | 'who' | 'form';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

/** `start`: open straight on a form (the Teacher area sends a teacher to log in). */
export default function WelcomePage({ onDone, start }: { onDone: () => void; start?: { intent: Intent; who: Who } }) {
  const { signIn, signUpStudent, signUpTeacher } = useAuth();
  const [step, setStep] = useState<Step>(start ? 'form' : 'door');
  const [intent, setIntent] = useState<Intent>(start?.intent ?? 'login');
  const [who, setWho] = useState<Who>(start?.who ?? 'student');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (s: Step) => {
    playClick();
    setError(null);
    setStep(s);
  };
  const begin = (i: Intent) => {
    setIntent(i);
    go('who');
  };
  const pick = (w: Who) => {
    setWho(w);
    go('form');
  };

  const done = () => {
    markWelcomed();
    onDone();
  };

  const run = (action: () => Promise<unknown>) => async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await action();
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again!');
    } finally {
      setBusy(false);
    }
  };

  const back = (to: Step) => (
    <button type="button" className="welcome-back" onClick={() => go(to)}>
      ← Back
    </button>
  );

  const submit =
    intent === 'login'
      ? run(() => signIn(who === 'student' ? username : email, password))
      : who === 'student'
        ? run(() => signUpStudent(username, password, name, code))
        : run(() => signUpTeacher(email, password, name || 'Teacher'));

  return (
    <div className="welcome">
      <h1 className="hero-title">
        <Logo className="hero-logo" by />
      </h1>

      {step === 'door' && (
        <>
          <p className="welcome-hello">Hello! Welcome to Funny Games. Let's play in English!</p>
          <div className="welcome-doors">
            <button type="button" className="welcome-door is-login" onClick={() => begin('login')}>
              <span className="welcome-door-emoji" aria-hidden>
                🔑
              </span>
              Log in
              <small>I have an account</small>
            </button>
            <button type="button" className="welcome-door is-new" onClick={() => begin('new')}>
              <span className="welcome-door-emoji" aria-hidden>
                ✨
              </span>
              Create an account
              <small>for students and teachers</small>
            </button>
            <button type="button" className="welcome-door is-guest" onClick={() => (playClick(), done())}>
              <span className="welcome-door-emoji" aria-hidden>
                🎮
              </span>
              Play as a guest
              <small>as a student, no account</small>
            </button>
          </div>
        </>
      )}

      {step === 'who' && (
        <div className="welcome-form">
          {back('door')}
          <h2 className="welcome-title">{intent === 'login' ? '🔑 Log in' : '✨ Create an account'}</h2>
          <div className="welcome-doors is-two">
            <button type="button" className="welcome-door is-student" onClick={() => pick('student')}>
              <span className="welcome-door-emoji" aria-hidden>
                🎒
              </span>
              I'm a student
            </button>
            <button type="button" className="welcome-door is-teacher" onClick={() => pick('teacher')}>
              <span className="welcome-door-emoji" aria-hidden>
                🍎
              </span>
              I'm a teacher
            </button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <form className="form welcome-form" onSubmit={submit}>
          {back('who')}
          <h2 className="welcome-title">
            {who === 'student' ? '🎒' : '🍎'} {intent === 'login' ? (who === 'student' ? 'Student log in' : 'Teacher log in') : who === 'student' ? 'New student' : 'New teacher'}
          </h2>

          {intent === 'new' && (
            <Field label={who === 'student' ? 'Your first name' : 'Your name'}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} placeholder={who === 'teacher' ? 'Teacher Clara' : undefined} />
            </Field>
          )}

          {who === 'student' ? (
            <Field label={intent === 'new' ? 'Choose a username' : 'Your username'} hint={intent === 'new' ? 'Letters and numbers, no spaces. You use it to log in.' : undefined}>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(cleanUsername(e.target.value))}
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                autoCapitalize="none"
              />
            </Field>
          ) : (
            <Field label="E-mail">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
          )}

          <Field label={intent === 'new' ? 'Choose a password' : 'Password'} hint={intent === 'new' ? 'At least 6 letters or numbers. Don’t forget it!' : undefined}>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={intent === 'new' ? 6 : undefined}
              autoComplete={intent === 'new' ? 'new-password' : 'current-password'}
            />
          </Field>

          {intent === 'new' && who === 'student' && (
            <Field label="Class code (if your teacher gave you one)" hint="You can also join a class later, at the top of the site.">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoCapitalize="characters" />
            </Field>
          )}

          {error && <p className="note note-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Just a moment…' : intent === 'login' ? "Let's go!" : 'Create my account'}
          </button>
          {intent === 'new' && who === 'teacher' && <p className="wheel-hint">In the Teacher area you can then make classes and give your students a class code.</p>}
          <p className="welcome-switch">
            {intent === 'login' ? 'No account yet? ' : 'Already have an account? '}
            <button type="button" className="welcome-link" onClick={() => (playClick(), setError(null), setIntent(intent === 'login' ? 'new' : 'login'))}>
              {intent === 'login' ? 'Create one' : 'Log in'}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

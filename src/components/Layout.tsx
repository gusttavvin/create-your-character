import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { playClick } from '../lib/sounds';

function ModeToggle() {
  const { mode, setMode } = usePrefs();
  return (
    <div className="seg" role="group" aria-label="View mode">
      <button type="button" className={mode === '2d' ? 'is-on' : ''} onClick={() => { setMode('2d'); playClick(); }}>
        2D
      </button>
      <button type="button" className={mode === '3d' ? 'is-on' : ''} onClick={() => { setMode('3d'); playClick(); }}>
        3D
      </button>
    </div>
  );
}

function SoundToggle() {
  const { soundOn, setSound } = usePrefs();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={soundOn}
      title={soundOn ? 'Sound on' : 'Sound off'}
      onClick={() => setSound(!soundOn)}
    >
      {soundOn ? '🔊' : '🔇'}
    </button>
  );
}

function UserChip() {
  const { role, displayName, signOut, hasBackend } = useAuth();
  if (role === 'guest') {
    return (
      <Link to={hasBackend ? '/join' : '/teacher'} className="chip chip-guest" title="Sign in">
        👋 Guest
      </Link>
    );
  }
  return (
    <span className={`chip chip-${role}`} title={role}>
      {role === 'teacher' ? '🍎' : '🎒'} {displayName}
      <button type="button" className="chip-x" onClick={() => void signOut()} title="Sign out" aria-label="Sign out">
        ×
      </button>
    </span>
  );
}

function Shell() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-icon" aria-hidden>
            🎨
          </span>
          <span className="brand-text">
            Create Your <b>Character</b>
          </span>
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/gallery">My Characters</NavLink>
          <NavLink to="/join">Join Class</NavLink>
          <NavLink to="/teacher">Teacher</NavLink>
        </nav>
        <div className="topbar-right">
          <ModeToggle />
          <SoundToggle />
          <UserChip />
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">Made with ❤ for Teacher Clara's English class · Use your imagination!</footer>
    </div>
  );
}

export default function Layout() {
  return (
    <PrefsProvider>
      <Shell />
    </PrefsProvider>
  );
}

import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { DragProvider } from '../lib/drag';
import { playClick } from '../lib/sounds';
import Logo from './Logo';
import VoicePicker from './VoicePicker';
import JoinClass from './JoinClass';

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
  const { role, displayName, signOut } = useAuth();
  if (role === 'guest') {
    return (
      <Link to="/welcome" className="chip chip-guest" title="Log in or create an account">
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
  const { role, hasBackend } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <Logo />
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            Home
          </NavLink>
          {/* (only with an account: a guest has none; offline, with no accounts at all, the
              characters are kept on the computer and the page stays) */}
          {(role !== 'guest' || !hasBackend) && <NavLink to="/gallery">My Characters</NavLink>}
          {/* (a teacher's classes; teachers log in at the door, like students) */}
          {role === 'teacher' && <NavLink to="/teacher">My Classes</NavLink>}
        </nav>
        <div className="topbar-right">
          <ModeToggle />
          <SoundToggle />
          <VoicePicker />
          <JoinClass />
          <UserChip />
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">Funny Games · made with ❤ for Teacher Clara's English class</footer>
    </div>
  );
}

export default function Layout() {
  return (
    <PrefsProvider>
      <DragProvider>
        <Shell />
      </DragProvider>
    </PrefsProvider>
  );
}

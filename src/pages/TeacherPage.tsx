import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, type ClassRoom } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { listClassCharacters } from '../lib/storage';
import type { SavedCharacter } from '../characters/types';
import CharacterCard from '../components/CharacterCard';
import { playClick } from '../lib/sounds';

function ClassPanel({ cls }: { cls: ClassRoom }) {
  const [chars, setChars] = useState<SavedCharacter[] | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    setChars(await listClassCharacters(cls.id).catch(() => []));
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('class_id', cls.id);
    setStudents(count ?? 0);
  }, [cls.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (c: SavedCharacter) => {
    if (!supabase) return;
    if (!window.confirm(`Delete ${c.name}?`)) return;
    await supabase.from('characters').delete().eq('id', c.id);
    await load();
  };

  return (
    <section className="class-panel">
      <header className="class-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <h2>{cls.name}</h2>
          <p className="class-meta">
            {students ?? '…'} student{students === 1 ? '' : 's'} · {chars?.length ?? '…'} character{chars?.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="class-code" title="The code that identifies this class">
          <span>Class code</span>
          <b>{cls.code}</b>
        </div>
      </header>
      {open && (
        <div className="class-body">
          <p className="note">
            Class code <b>{cls.code}</b>. Everything made for this class shows up here.
          </p>
          {chars === null ? (
            <div className="center-msg">
              <span className="spinner" />
            </div>
          ) : chars.length === 0 ? (
            <p className="empty-small">No characters yet.</p>
          ) : (
            <div className="cgrid">
              {chars.map((c) => (
                <CharacterCard key={c.id} c={c} canEdit onDelete={remove} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const { user, displayName, signOut } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error: err } = await supabase.from('classes').select('id, name, code, teacher_id').eq('teacher_id', user.id).order('created_at');
    if (err) setError(err.message);
    setClasses((data as ClassRoom[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="teacher">
      <div className="gallery-head">
        <h1 className="page-title">🍎 Hello, {displayName}!</h1>
        <div className="show-tools">
          <Link to="/gallery" className="btn btn-ghost">
            🖼 My characters
          </Link>
          <Link to="/memory/words" className="btn btn-ghost">
            ✏️ Memory words
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => { playClick(); void signOut(); }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Clara does not make classes, so there is no way to create one here; any made
          before still show, with what was saved in them. */}
      {error && <p className="note note-error">{error}</p>}

      {classes === null ? (
        <div className="center-msg">
          <span className="spinner" />
        </div>
      ) : (
        classes.map((c) => <ClassPanel key={c.id} cls={c} />)
      )}
    </div>
  );
}

export default function TeacherPage() {
  const { hasBackend, ready, role, signOut, displayName } = useAuth();

  if (!hasBackend) {
    return (
      <div className="form-page">
        <h1 className="page-title">🍎 Teacher area</h1>
        <p className="note">
          The online backend (Supabase) is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to enable teacher accounts and classes. The game works offline meanwhile.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to the game
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
  if (role === 'student') {
    return (
      <div className="form-page">
        <h1 className="page-title">🍎 Teacher area</h1>
        <p className="note">
          You are signed in as student <b>{displayName}</b>. Teachers sign in with an e-mail. Leave the class first to sign in as a teacher.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
          Leave class
        </button>
      </div>
    );
  }
  if (role === 'teacher') return <Dashboard />;
  // (teachers log in and make their accounts at the door of the site, like students)
  return <Navigate to="/welcome?as=teacher" replace />;
}

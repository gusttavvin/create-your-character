import { Link } from 'react-router-dom';
import { CHARACTERS, KINDS } from '../characters/registry';
import Character2D from '../components/Character2D';
import { useAuth } from '../lib/auth';
import { speak } from '../lib/speech';
import { playClick } from '../lib/sounds';

export default function Home() {
  const { role, displayName, hasBackend } = useAuth();
  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">
          <span className="t-cream">Create Your</span> <span className="t-yellow">Character!</span>
        </h1>
        <p className="hero-sub">
          Pick a friend, choose the parts, learn the words in English, give it a name and save it. Use your imagination!
        </p>
        {role !== 'guest' && (
          <p className="hero-hello">
            Hello, <b>{displayName}</b>! 👋
          </p>
        )}
      </section>

      <section className="picker">
        {KINDS.map((k) => {
          const def = CHARACTERS[k];
          return (
            <Link
              key={k}
              to={`/build/${k}`}
              className="pick-card"
              data-kind={k}
              onClick={() => {
                playClick();
                speak(def.noun);
              }}
            >
              <div className="pick-art">
                <Character2D kind={k} parts={def.defaultParts} colors={def.defaultColors} />
              </div>
              <div className="pick-label">
                <span className="pick-emoji" aria-hidden>
                  {def.emoji}
                </span>
                {def.noun}
              </div>
              <div className="pick-cta">Create →</div>
            </Link>
          );
        })}
      </section>

      <section className="home-links">
        <Link to="/gallery" className="btn btn-ghost">
          🖼 My Characters
        </Link>
        {hasBackend && role === 'guest' && (
          <Link to="/join" className="btn btn-fun">
            🎒 Join my class
          </Link>
        )}
        <Link to="/teacher" className="btn btn-ghost">
          🍎 Teacher area
        </Link>
      </section>
    </div>
  );
}

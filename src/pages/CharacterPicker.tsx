import { Link } from 'react-router-dom';
import { CHARACTERS, KINDS } from '../characters/registry';
import Character2D from '../components/Character2D';
import { speak } from '../lib/speech';
import { playClick } from '../lib/sounds';

export default function CharacterPicker() {
  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">
          <span className="t-cream">Create Your</span> <span className="t-yellow">Character!</span>
        </h1>
        <p className="hero-sub">
          Pick a friend, drag the pieces onto the picture, learn the words in English, give it a name and save it.
        </p>
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
        <Link to="/" className="btn btn-ghost">
          ← All games
        </Link>
      </section>
    </div>
  );
}

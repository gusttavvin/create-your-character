import { Link } from 'react-router-dom';
import { GAMES } from '../games';
import { CHARACTERS, KINDS } from '../characters/registry';
import Character2D from '../components/Character2D';
import { useAuth } from '../lib/auth';
import { playClick } from '../lib/sounds';

/** Little cast of characters peeking out of the Create Your Character card. */
function CharacterPeek() {
  return (
    <div className="game-peek" aria-hidden>
      {KINDS.slice(0, 5).map((k) => {
        const def = CHARACTERS[k];
        return (
          <div className="game-peek-one" key={k}>
            <Character2D kind={k} parts={def.defaultParts} colors={def.defaultColors} animate={false} />
          </div>
        );
      })}
    </div>
  );
}

export default function GamesHome() {
  const { role, displayName } = useAuth();
  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">
          <span className="t-cream">Funny</span> <span className="t-yellow">Games</span>
        </h1>
        <p className="hero-sub">Play, build and learn English. Pick a game to start!</p>
        {role !== 'guest' && (
          <p className="hero-hello">
            Hello, <b>{displayName}</b>! 👋
          </p>
        )}
      </section>

      <section className="games">
        {GAMES.map((g) => (
          <Link key={g.id} to={g.path} className="game-card" style={{ ['--game' as string]: g.color }} onClick={() => playClick()}>
            <div className="game-art">{g.id === 'create-your-character' ? <CharacterPeek /> : <span className="game-emoji">{g.emoji}</span>}</div>
            <div className="game-body">
              <h2 className="game-title">
                <span className="game-emoji-small" aria-hidden>
                  {g.emoji}
                </span>
                {g.title}
              </h2>
              <p className="game-blurb">{g.blurb}</p>
              <span className="game-learn">{g.learn}</span>
            </div>
            <span className="game-cta">Play →</span>
          </Link>
        ))}

        <div className="game-card game-soon" aria-hidden>
          <div className="game-art">
            <span className="game-emoji">✨</span>
          </div>
          <div className="game-body">
            <h2 className="game-title">More games soon</h2>
            <p className="game-blurb">New games will appear here as they are built.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

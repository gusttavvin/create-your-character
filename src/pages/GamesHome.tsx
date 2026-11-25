import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GAMES, type Game } from '../games';
import { CHARACTERS, KINDS } from '../characters/registry';
import Character2D from '../components/Character2D';
import GameArt from '../components/GameArt';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { playClick } from '../lib/sounds';
import WelcomePage, { wasWelcomed } from './WelcomePage';

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

/** A little hand-drawn star before each group's name. */
function Star({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden>
      <path d="M20 3 L23 16 L36 20 L23 24 L20 37 L17 24 L4 20 L17 16 Z" fill={color} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

function GameCard({ g }: { g: Game }) {
  return (
    <Link to={g.path} className="game-card" style={{ ['--game' as string]: g.color }} onClick={() => playClick()}>
      <div className="game-art">{g.id === 'create-your-character' ? <CharacterPeek /> : <GameArt id={g.id} />}</div>
      <div className="game-body">
        <h2 className="game-title">{g.title}</h2>
        <p className="game-blurb">{g.blurb}</p>
        <span className="game-learn">{g.learn}</span>
        {g.older && <span className="game-age">11+</span>}
      </div>
      <span className="game-cta">Let's play!</span>
    </Link>
  );
}

export default function GamesHome() {
  const { role, displayName, hasBackend, ready } = useAuth();
  // the first time, the door: log in, create an account or play as a guest
  const [welcomed, setWelcomed] = useState(wasWelcomed);
  if (hasBackend && ready && role === 'guest' && !welcomed) return <WelcomePage onDone={() => setWelcomed(true)} />;
  const younger = GAMES.filter((g) => !g.older);
  const older = GAMES.filter((g) => g.older);
  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">
          <Logo className="hero-logo" by />
        </h1>
        <p className="hero-sub">Pick a game and let's play in English!</p>
        {role !== 'guest' && (
          <p className="hero-hello">
            Hello, <b>{displayName}</b>! 👋
          </p>
        )}
      </section>

      <section className="games-group">
        <h2 className="games-group-title">
          <Star color="var(--sun)" /> Play and create
        </h2>
        <div className="games">
          {younger.map((g) => (
            <GameCard key={g.id} g={g} />
          ))}
        </div>
      </section>

      {older.length > 0 && (
        <section className="games-group is-older">
          <h2 className="games-group-title">
            <Star color="var(--coral)" /> For older students <span className="game-age">11+</span>
          </h2>
          <div className="games">
            {older.map((g) => (
              <GameCard key={g.id} g={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

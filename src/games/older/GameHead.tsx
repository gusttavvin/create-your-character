import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { playClick } from '../../lib/sounds';

/** The head of a game page, like the other games': its title in two colours, a line, and Games. */
export default function GameHead({ first, second, sub, children }: { first: string; second: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <div className="memory-head">
      <div>
        <h1 className="memory-title">
          <span className="t-cream">{first}</span> <span className="t-yellow">{second}</span>
        </h1>
        <p className="memory-sub">{sub}</p>
      </div>
      <div className="memory-head-tools">
        {children}
        <Link to="/" className="btn" onClick={() => playClick()}>
          🏠 Games
        </Link>
      </div>
    </div>
  );
}

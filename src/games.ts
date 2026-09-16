/**
 * Every game on the site. The home page is built from this list, so adding a game
 * means adding an entry here and a route for its `path`.
 */
export interface Game {
  id: string;
  title: string;
  /** One line a child (or a teacher scanning the page) can read. */
  blurb: string;
  /** What English it practises, shown as a small tag. */
  learn: string;
  emoji: string;
  path: string;
  /** Card colour, from the worksheet palette. */
  color: string;
  ready: boolean;
}

export const GAMES: Game[] = [
  {
    id: 'create-your-character',
    title: 'Create Your Character',
    blurb: 'Build a monster, a dragon, a princess, a superhero or a fairy, then give it a name.',
    learn: 'body words · colours · describing',
    emoji: '🎨',
    path: '/create-your-character',
    color: '#FFD93D',
    ready: true,
  },
];

export const READY_GAMES = GAMES.filter((g) => g.ready);

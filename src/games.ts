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
  /** For the older students (11 and up): a small tag on its card. */
  older?: boolean;
}

export const GAMES: Game[] = [
  {
    id: 'create-your-character',
    title: 'Create Your Character',
    blurb: 'Build a monster, a dragon, a princess, a superhero or a fairy, then give it a name.',
    learn: 'body words · colours · describing',
    emoji: '🎨',
    path: '/create-your-character',
    color: '#FFC23D',
    ready: true,
  },
  {
    id: 'memory',
    title: 'Memory Game',
    blurb: 'Turn the cards over, find the pairs and hear the English word for each one.',
    learn: 'animals · fruit · school things · colours',
    emoji: '🧠',
    path: '/memory',
    color: '#2EC4A6',
    ready: true,
  },
  {
    id: 'wheel',
    title: 'Spin the Wheel',
    blurb: 'Put the class on the wheel and let it choose who answers next.',
    learn: 'taking turns · speaking',
    emoji: '🎡',
    path: '/wheel',
    color: '#FF6B4A',
    ready: true,
  },
  {
    id: 'quiz',
    title: 'Quiz Board',
    blurb: 'Teams pick a category and a value, answer in English and win the points.',
    learn: 'review anything · teams',
    emoji: '🏆',
    path: '/quiz',
    color: '#FFC23D',
    ready: true,
    older: true,
  },
  {
    id: 'dont-say-it',
    title: "Don't Say It!",
    blurb: 'Describe the word to your team without saying the forbidden words.',
    learn: 'speaking · describing',
    emoji: '🤐',
    path: '/dont-say-it',
    color: '#2EC4A6',
    ready: true,
    older: true,
  },
  {
    id: 'mystery-word',
    title: 'Mystery Word',
    blurb: 'Find the English word in six tries. Green, yellow or grey: every try helps.',
    learn: 'spelling · vocabulary',
    emoji: '🔤',
    path: '/mystery-word',
    color: '#B69CE0',
    ready: true,
    older: true,
  },
  {
    id: 'would-you-rather',
    title: 'Would You Rather?',
    blurb: "Two choices, one vote. Then say why: “I'd rather … because …”",
    learn: 'opinions · speaking',
    emoji: '🤔',
    path: '/would-you-rather',
    color: '#FF6B4A',
    ready: true,
    older: true,
  },
];

export const READY_GAMES = GAMES.filter((g) => g.ready);

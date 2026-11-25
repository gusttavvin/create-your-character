/**
 * The Quiz Board's own boards: a review board and one for each theme (sports, food, animals,
 * superpowers & fantasy, school & everyday life). The answers are short, so a student playing
 * alone can type theirs and have it checked: alternatives are written with a / between them,
 * and anything in brackets is an explanation, not needed in the answer.
 */
export interface Cell {
  q: string;
  a: string;
}
export interface Board {
  id: string;
  title: string;
  emoji?: string;
  categories: string[];
  /** cells[category][row] */
  cells: Cell[][];
}

const c = (q: string, a: string): Cell => ({ q, a });

export const BUILT_IN: Board[] = [
  {
    id: 'review',
    title: 'Review time',
    emoji: '📚',
    categories: ['Past verbs', 'Food', 'Opposites', 'Questions', 'Spell it!'],
    cells: [
      [c("What is the past of 'go'?", 'went'), c("What is the past of 'eat'?", 'ate'), c("What is the past of 'buy'?", 'bought')],
      [c('Name a vegetable.', 'carrot / potato / lettuce / onion / tomato / broccoli (any vegetable)'), c('What do we call the first meal of the day?', 'breakfast'), c("Is 'bread' countable or uncountable?", 'uncountable')],
      [c("What is the opposite of 'hot'?", 'cold'), c("What is the opposite of 'expensive'?", 'cheap'), c("What is the opposite of 'always'?", 'never')],
      [c("Fix it: 'Where you live?'", 'Where do you live?'), c("Make a question: 'She plays tennis.'", 'Does she play tennis?'), c("Fix it: 'He don't like milk.'", "He doesn't like milk.")],
      [c('Spell the number 40.', 'forty'), c('Spell the day after Tuesday.', 'Wednesday'), c("Spell the plural of 'child'.", 'children')],
    ],
  },
  {
    id: 'sports',
    title: 'Sports',
    emoji: '⚽',
    categories: ['Which sport?', 'Sports words', 'Play, do or go?', 'True or false?'],
    cells: [
      [c('You use a racket and a small yellow ball.', 'tennis'), c('You need a pool and a swimsuit.', 'swimming'), c('Two teams, a basket and a big orange ball.', 'basketball')],
      [c('Who stops the ball in front of the goal?', 'goalkeeper / the goalkeeper'), c('Gold, silver and bronze are…', 'medals'), c('The person who trains a team is the…', 'coach / the coach')],
      [c('We ___ football.', 'play'), c('We ___ swimming.', 'go'), c('We ___ karate.', 'do')],
      [c('A football team has 11 players on the field.', 'true'), c('Tennis is played with a bat.', 'false (a racket)'), c('The Olympic Games are every two years.', 'false (every four years)')],
    ],
  },
  {
    id: 'food',
    title: 'Food',
    emoji: '🍕',
    categories: ['Fruit or vegetable?', 'Meals', 'A, an or some?', 'How does it taste?'],
    cells: [
      [c('A carrot is a…', 'vegetable'), c('A banana is a…', 'fruit'), c('A tomato is a… (be careful!)', 'fruit')],
      [c('The meal we eat in the morning.', 'breakfast'), c('The meal in the middle of the day.', 'lunch'), c('The meal in the evening.', 'dinner')],
      [c('I eat ___ apple every day.', 'an'), c('Can I have ___ banana?', 'a'), c('I want ___ water, please.', 'some')],
      [c('Lemons are… (sweet or sour?)', 'sour'), c('Chocolate is… (sweet or salty?)', 'sweet'), c('Chips are… (sweet or salty?)', 'salty')],
    ],
  },
  {
    id: 'animals',
    title: 'Animals',
    emoji: '🐶',
    categories: ['Who am I?', 'Baby animals', 'One, two…', 'Where do they live?'],
    cells: [
      [c("I say 'moo' and I give milk.", 'cow / a cow'), c('I have black and white stripes.', 'zebra / a zebra'), c('I am the biggest animal in the sea.', 'whale / a whale / the blue whale')],
      [c('A baby dog is a…', 'puppy'), c('A baby cat is a…', 'kitten'), c('A baby cow is a…', 'calf')],
      [c('One mouse, two…', 'mice'), c('One sheep, two…', 'sheep'), c('One fish, two…', 'fish')],
      [c('A fish lives in the…', 'water / sea / river'), c('A penguin lives where it is very…', 'cold'), c('A camel lives in the…', 'desert')],
    ],
  },
  {
    id: 'fantasy',
    title: 'Superpowers & fantasy',
    emoji: '🦸',
    categories: ['Who is it?', 'Superpowers', 'Past verbs', 'Magic words'],
    cells: [
      [c('She rides a broom and wears a tall hat.', 'witch / a witch'), c('It has wings and breathes fire.', 'dragon / a dragon'), c('A very, very big person in stories.', 'giant / a giant')],
      [c('A superhero who can go up in the sky can…', 'fly'), c('Nobody can see you: you are…', 'invisible'), c('You know what people think: you can read…', 'minds')],
      [c("What is the past of 'fly'?", 'flew'), c("What is the past of 'see'?", 'saw'), c("What is the past of 'become'?", 'became')],
      [c("A wizard's magic stick is a…", 'wand / magic wand'), c('Magic words that make something happen.', 'spell / a spell'), c('A white horse with a horn.', 'unicorn / a unicorn')],
    ],
  },
  {
    id: 'school',
    title: 'School & everyday life',
    emoji: '🎒',
    categories: ['In the classroom', 'Days and months', 'Opposites', 'Fix it!'],
    cells: [
      [c('You write with it, and you can erase it.', 'pencil / a pencil'), c('You use it to draw straight lines.', 'ruler / a ruler'), c('You use it to erase mistakes.', 'rubber / eraser')],
      [c('The day after Monday.', 'Tuesday'), c('How many days are in a week?', 'seven / 7'), c('The month after March.', 'April')],
      [c("The opposite of 'early'.", 'late'), c("The opposite of 'easy'.", 'difficult / hard'), c("The opposite of 'quiet'.", 'loud / noisy')],
      [c("Fix it: 'I am 11 years.'", 'I am 11 years old. / I am 11.'), c("Fix it: 'She go to school by bus.'", 'She goes to school by bus.'), c("Fix it: 'I have a homework.'", 'I have homework. / I have some homework.')],
    ],
  },
];

/** The words of an answer, plain: small letters, no punctuation, single spaces. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Whether a typed answer is one of a cell's answers (alternatives between /, without what is in
 * brackets; "a" and "the" before a word may be left out).
 */
export function isRight(typed: string, answer: string) {
  const t = plain(typed).replace(/^(a|an|the) /, '');
  if (!t) return false;
  return answer
    .replace(/\([^)]*\)/g, '')
    .split('/')
    .map((alt) => plain(alt).replace(/^(a|an|the) /, ''))
    .some((alt) => alt && (alt === t || (alt.includes(' ') && alt.replace(/'/g, '') === t.replace(/'/g, ''))));
}

/** An answer as it is shown: its first alternative, with its explanation in brackets, if any. */
export function shownAnswer(answer: string) {
  const note = answer.match(/\([^)]*\)/)?.[0];
  const first = answer.replace(/\([^)]*\)/g, '').split('/')[0].trim();
  return note ? `${first} ${note}` : first;
}

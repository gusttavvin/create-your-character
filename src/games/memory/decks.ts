/**
 * The picture packs the memory game is played with.
 *
 * Clara's class uses a sea-animal memory game she built elsewhere, where the free plan
 * let her keep only three activities. These are hers to use as often as she likes, and
 * every card carries the English word, so the game teaches while it is played.
 */
export interface MemoryItem {
  /** The picture on the card. */
  emoji: string;
  /** The English word, read aloud when the pair is found. */
  word: string;
}

export interface MemoryDeck {
  id: string;
  /** Shown on the pack button. */
  label: string;
  emoji: string;
  /** The line under the title while this pack is being played. */
  learn: string;
  items: MemoryItem[];
}

export const DECKS: MemoryDeck[] = [
  {
    id: 'sea',
    label: 'Sea animals',
    emoji: '🐠',
    learn: 'sea animals',
    items: [
      { emoji: '🐠', word: 'fish' },
      { emoji: '🐬', word: 'dolphin' },
      { emoji: '🐙', word: 'octopus' },
      { emoji: '🦀', word: 'crab' },
      { emoji: '🐢', word: 'turtle' },
      { emoji: '🦈', word: 'shark' },
      { emoji: '🐳', word: 'whale' },
      { emoji: '⭐', word: 'starfish' },
      { emoji: '🦞', word: 'lobster' },
      { emoji: '🐚', word: 'shell' },
    ],
  },
  {
    id: 'farm',
    label: 'Farm animals',
    emoji: '🐄',
    learn: 'farm animals',
    items: [
      { emoji: '🐄', word: 'cow' },
      { emoji: '🐖', word: 'pig' },
      { emoji: '🐑', word: 'sheep' },
      { emoji: '🐔', word: 'hen' },
      { emoji: '🦆', word: 'duck' },
      { emoji: '🐴', word: 'horse' },
      { emoji: '🐐', word: 'goat' },
      { emoji: '🐕', word: 'dog' },
      { emoji: '🐈', word: 'cat' },
      { emoji: '🐇', word: 'rabbit' },
    ],
  },
  {
    id: 'wild',
    label: 'Zoo animals',
    emoji: '🦁',
    learn: 'zoo animals',
    items: [
      { emoji: '🦁', word: 'lion' },
      { emoji: '🐘', word: 'elephant' },
      { emoji: '🐒', word: 'monkey' },
      { emoji: '🦒', word: 'giraffe' },
      { emoji: '🦓', word: 'zebra' },
      { emoji: '🐅', word: 'tiger' },
      { emoji: '🐻', word: 'bear' },
      { emoji: '🐍', word: 'snake' },
      { emoji: '🐸', word: 'frog' },
      { emoji: '🐊', word: 'crocodile' },
    ],
  },
  {
    id: 'fruit',
    label: 'Fruit',
    emoji: '🍎',
    learn: 'fruit',
    items: [
      { emoji: '🍎', word: 'apple' },
      { emoji: '🍌', word: 'banana' },
      { emoji: '🍊', word: 'orange' },
      { emoji: '🍇', word: 'grapes' },
      { emoji: '🍓', word: 'strawberry' },
      { emoji: '🍉', word: 'watermelon' },
      { emoji: '🍐', word: 'pear' },
      { emoji: '🍍', word: 'pineapple' },
      { emoji: '🍋', word: 'lemon' },
      { emoji: '🍒', word: 'cherries' },
    ],
  },
  {
    id: 'school',
    label: 'School things',
    emoji: '✏️',
    learn: 'school things',
    items: [
      { emoji: '📕', word: 'book' },
      { emoji: '✏️', word: 'pencil' },
      { emoji: '📏', word: 'ruler' },
      { emoji: '✂️', word: 'scissors' },
      { emoji: '🎒', word: 'backpack' },
      { emoji: '🖍️', word: 'crayon' },
      { emoji: '📓', word: 'notebook' },
      { emoji: '🧽', word: 'rubber' },
      { emoji: '🕐', word: 'clock' },
      { emoji: '💻', word: 'computer' },
    ],
  },
  {
    id: 'toys',
    label: 'Toys',
    emoji: '🧸',
    learn: 'toys',
    items: [
      { emoji: '⚽', word: 'ball' },
      { emoji: '🧸', word: 'teddy bear' },
      { emoji: '🪁', word: 'kite' },
      { emoji: '🤖', word: 'robot' },
      { emoji: '🧩', word: 'puzzle' },
      { emoji: '🥁', word: 'drum' },
      { emoji: '🚗', word: 'car' },
      { emoji: '🎈', word: 'balloon' },
      { emoji: '🚲', word: 'bike' },
      { emoji: '🪀', word: 'yo-yo' },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍕',
    learn: 'food',
    items: [
      { emoji: '🍕', word: 'pizza' },
      { emoji: '🍰', word: 'cake' },
      { emoji: '🍞', word: 'bread' },
      { emoji: '🧀', word: 'cheese' },
      { emoji: '🥚', word: 'egg' },
      { emoji: '🥛', word: 'milk' },
      { emoji: '🍔', word: 'hamburger' },
      { emoji: '🍦', word: 'ice cream' },
      { emoji: '🍪', word: 'biscuit' },
      { emoji: '🥕', word: 'carrot' },
    ],
  },
  {
    id: 'colours',
    label: 'Colors',
    emoji: '🎨',
    learn: 'colors',
    items: [
      { emoji: '🟥', word: 'red' },
      { emoji: '🟦', word: 'blue' },
      { emoji: '🟩', word: 'green' },
      { emoji: '🟨', word: 'yellow' },
      { emoji: '🟪', word: 'purple' },
      { emoji: '🟧', word: 'orange' },
      { emoji: '🩷', word: 'pink' },
      { emoji: '🟫', word: 'brown' },
      { emoji: '⬛', word: 'black' },
      { emoji: '⬜', word: 'white' },
    ],
  },
];

export const DECK_BY_ID = Object.fromEntries(DECKS.map((d) => [d.id, d])) as Record<string, MemoryDeck>;

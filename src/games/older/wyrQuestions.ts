/**
 * Would You Rather's questions, by theme, and the fun result at the end ("You are a Dreamer!").
 *
 * Every choice adds a point to one personality; the one with the most points at the end is the
 * child's (or the class's) result. Six of them, so that every theme can reach every one.
 */
export type Trait = 'adventurer' | 'dreamer' | 'star' | 'chill' | 'brainy' | 'helper';

export const TRAITS: Record<Trait, { title: string; emoji: string; text: string; color: string }> = {
  adventurer: {
    title: 'an Adventurer',
    emoji: '🧭',
    text: 'You love new things, big challenges and exciting places. Nothing can stop you!',
    color: '#FF6B4A',
  },
  dreamer: {
    title: 'a Dreamer',
    emoji: '🌙',
    text: 'Your head is full of magic and big ideas. You see the world in your own special way.',
    color: '#B69CE0',
  },
  star: {
    title: 'a Star',
    emoji: '⭐',
    text: 'You love to shine, to win and to have fun with everybody watching.',
    color: '#FFC23D',
  },
  chill: {
    title: 'a Chill Cat',
    emoji: '😎',
    text: 'You are calm and cosy. You know how to relax and enjoy the little things.',
    color: '#7FD8C6',
  },
  brainy: {
    title: 'a Bright Spark',
    emoji: '💡',
    text: 'You are curious and clever. You love to learn how things work.',
    color: '#FFD97A',
  },
  helper: {
    title: 'a Kind Heart',
    emoji: '💛',
    text: 'You love your friends and you always help. Everybody wants you on their team!',
    color: '#2EC4A6',
  },
};

/** A question: two choices, each with the personality it points to. */
export type Question = [[string, Trait], [string, Trait]];

export interface Theme {
  id: string;
  label: string;
  emoji: string;
  questions: Question[];
}

export const THEMES: Theme[] = [
  {
    id: 'sports',
    label: 'Sports',
    emoji: '⚽',
    questions: [
      [['play football in a big stadium', 'star'], ['go surfing on big waves', 'adventurer']],
      [['win a race', 'star'], ['learn a new sport', 'brainy']],
      [['be the team captain', 'helper'], ['be the best player', 'star']],
      [['ski down a mountain', 'adventurer'], ['play in a chess tournament', 'brainy']],
      [['watch a match on TV with snacks', 'chill'], ['play the match yourself', 'adventurer']],
      [['swim with dolphins', 'dreamer'], ['climb a giant wall', 'adventurer']],
      [['play basketball with famous players', 'star'], ['coach a team of little kids', 'helper']],
      [['go to the Olympics', 'star'], ['invent your own sport', 'dreamer']],
      [['ride a skateboard', 'adventurer'], ['do yoga in the park', 'chill']],
      [['play sports video games', 'chill'], ['play sports outside in the rain', 'adventurer']],
      [['have a pet that plays football', 'dreamer'], ['have a robot that plays tennis', 'brainy']],
      [['win a gold medal alone', 'star'], ['win a silver medal with your friends', 'helper']],
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍕',
    questions: [
      [['only eat pizza', 'chill'], ['only eat sushi', 'adventurer']],
      [['cook dinner for your family', 'helper'], ['eat at a fancy restaurant', 'star']],
      [['try a food you have never eaten', 'adventurer'], ['eat your favourite food again', 'chill']],
      [['have a chocolate river', 'dreamer'], ['have a never-ending pizza', 'chill']],
      [['be a famous chef on TV', 'star'], ['invent a new fruit', 'brainy']],
      [['eat breakfast for dinner', 'dreamer'], ['eat dinner for breakfast', 'adventurer']],
      [['share your sweets with your friends', 'helper'], ['find a secret sweet shop', 'dreamer']],
      [['drink a juice that makes you fly', 'dreamer'], ['drink a juice that makes you super smart', 'brainy']],
      [['have a picnic in the park', 'chill'], ['eat in a restaurant on the moon', 'adventurer']],
      [['bake a giant cake for everyone', 'helper'], ['eat a tiny cake made by a robot', 'brainy']],
      [['grow your own vegetables', 'helper'], ['taste food from ten countries', 'adventurer']],
      [['eat very spicy food', 'adventurer'], ['eat very sweet food', 'chill']],
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🐶',
    questions: [
      [['have a pet dragon', 'dreamer'], ['have a pet dinosaur', 'adventurer']],
      [['talk to animals', 'helper'], ['be a scientist who studies animals', 'brainy']],
      [['ride a horse', 'adventurer'], ['cuddle a panda', 'chill']],
      [['be a dolphin', 'star'], ['be an owl', 'brainy']],
      [['have a giant cat', 'chill'], ['have a tiny elephant', 'dreamer']],
      [['work in a zoo', 'helper'], ['explore the jungle', 'adventurer']],
      [['be as fast as a cheetah', 'star'], ['be as strong as a gorilla', 'adventurer']],
      [['have a cat', 'chill'], ['have a dog', 'helper']],
      [['swim with sharks', 'adventurer'], ['feed baby penguins', 'helper']],
      [['be the lion king', 'star'], ['be a wise old turtle', 'brainy']],
      [['have a unicorn', 'dreamer'], ['have a robot dog', 'brainy']],
      [['sleep like a bear all winter', 'chill'], ['fly like a bird all day', 'dreamer']],
    ],
  },
  {
    id: 'fantasy',
    label: 'Superpowers & fantasy',
    emoji: '🦸',
    questions: [
      [['be able to fly', 'adventurer'], ['be invisible', 'dreamer']],
      [['read minds', 'brainy'], ['see the future', 'dreamer']],
      [['run super fast', 'star'], ['be super strong and help people', 'helper']],
      [['live in a castle', 'star'], ['live in a treehouse', 'dreamer']],
      [['have a magic wand', 'dreamer'], ['have a time machine', 'brainy']],
      [['be a superhero', 'helper'], ['be a wizard', 'brainy']],
      [['travel to the past', 'brainy'], ['travel to the future', 'adventurer']],
      [['talk to ghosts', 'adventurer'], ['talk to aliens', 'brainy']],
      [['have a dragon friend', 'adventurer'], ['have a fairy friend', 'helper']],
      [['stop time', 'chill'], ['teleport anywhere', 'adventurer']],
      [['be famous for your magic', 'star'], ['use your magic in secret', 'dreamer']],
      [['never be bored', 'adventurer'], ['never be tired', 'chill']],
    ],
  },
  {
    id: 'school',
    label: 'School & everyday life',
    emoji: '🎒',
    questions: [
      [['have no homework', 'chill'], ['have a class trip every week', 'adventurer']],
      [['be the teacher for a day', 'helper'], ['be the president for a day', 'star']],
      [['wake up very early', 'brainy'], ['go to bed very late', 'dreamer']],
      [['read a book', 'brainy'], ['watch a movie', 'chill']],
      [['live in a big city', 'star'], ['live on a farm', 'helper']],
      [['sing in front of the school', 'star'], ['paint a giant picture', 'dreamer']],
      [['help a new student', 'helper'], ['win the school quiz', 'brainy']],
      [['have a robot that does your homework', 'brainy'], ['have a cat that tidies your room', 'dreamer']],
      [['go to school by helicopter', 'adventurer'], ['study at home in your pyjamas', 'chill']],
      [['speak every language', 'brainy'], ['play every instrument', 'star']],
      [['have a big party', 'star'], ['have a quiet day at home', 'chill']],
      [['make a new friend', 'helper'], ['find a secret room at school', 'adventurer']],
    ],
  },
];

/** The personality with the most points (the first of them, on a tie), and every one's share. */
export function resultOf(points: Partial<Record<Trait, number>>) {
  const order = (Object.keys(TRAITS) as Trait[]).map((t) => [t, points[t] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  const total = order.reduce((s, [, n]) => s + n, 0) || 1;
  return { top: order[0][0], shares: order.map(([t, n]) => ({ trait: t, share: n / total })) };
}

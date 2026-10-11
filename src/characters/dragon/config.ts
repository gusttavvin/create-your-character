import { listPhrases, phrasesOf, type CharacterDefinition, type ColorMap, type PartMap } from '../types';
import * as P from './parts';

/**
 * The colours of the four dragons Clara approved, from light to dark: Sparky is green,
 * Blaze red, Splash blue and Pip purple.
 *
 * The child does not choose colours any more. Each body is one of the four dragons and
 * brings its own colour, as the monster's bodies do; the tail is skin too, so it wears the
 * body's colour, while wings, flames, fins and hearts keep the colours they were drawn in.
 */
const SKIN: Record<string, [string, string, string]> = {
  classic: ['#A4EE78', '#6FD14A', '#3FA62B'],
  chubby: ['#FF9A7E', '#FF5A4E', '#D9342F'],
  tall: ['#9ADFFF', '#4FB3F5', '#2E86D9'],
  spiky: ['#D2B4FF', '#A77BFF', '#7C4FE0'],
};

/** The main colour of each pair of wings, for the 3D dragon. */
const WING: Record<string, string> = {
  bat: '#FFC93D',
  feather: '#FF7A2A',
  butterfly: '#45CFE0',
  tiny: '#FF7FC4',
};

/** What a dragon is painted in: its body's own colours. */
export function dragonColors(parts: PartMap): ColorMap {
  const [skinTop, skin, skinDark] = SKIN[parts.body] ?? SKIN.classic;
  return { skinTop, skin, skinDark, body: skin, wings: WING[parts.wings] ?? WING.bat };
}

export const DRAGON: CharacterDefinition = {
  kind: 'dragon',
  noun: 'Dragon',
  title: 'Create Your Dragon',
  emoji: '🐉',
  /*
   * Like the monster: names a six-year-old knows, numbered 1 to 4 so the class can call a
   * card out. The cards are in the order of the four dragons — 1 Sparky, 2 Blaze, 3 Splash,
   * 4 Pip — and the ids are the ones saved dragons were stored with.
   */
  numbered: true,
  categories: [
    {
      id: 'body',
      label: 'Body',
      color: '#FF6B78',
      options: [
        { id: 'classic', label: 'Green', phrase: 'a green body', Svg: P.Body1 },
        { id: 'chubby', label: 'Red', phrase: 'a red body', Svg: P.Body2 },
        { id: 'tall', label: 'Blue', phrase: 'a blue body', Svg: P.Body3 },
        { id: 'spiky', label: 'Purple', phrase: 'a purple body', Svg: P.Body4 },
      ],
    },
    {
      id: 'wings',
      label: 'Wings',
      color: '#FF8A2A',
      optional: true,
      options: [
        { id: 'bat', label: 'Bat', phrase: 'bat wings', Svg: P.Wings1 },
        { id: 'feather', label: 'Spiky', phrase: 'spiky wings', Svg: P.Wings2 },
        { id: 'butterfly', label: 'Fin', phrase: 'fin wings', Svg: P.Wings3 },
        { id: 'tiny', label: 'Baby', phrase: 'baby wings', Svg: P.Wings4 },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'cute', label: 'Happy', phrase: 'happy eyes', Svg: P.Eyes1 },
        { id: 'fierce', label: 'Brave', phrase: 'brave eyes', Svg: P.Eyes2 },
        { id: 'big', label: 'Sleepy', phrase: 'sleepy eyes', Svg: P.Eyes3 },
        { id: 'star', label: 'Sparkly', phrase: 'sparkly eyes', Svg: P.Eyes4 },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'smile', label: 'Smile', phrase: 'a big smile', Svg: P.Mouth1 },
        { id: 'fire', label: 'Fire', phrase: 'a mouth that breathes fire', Svg: P.Mouth2 },
        { id: 'teeth', label: 'Bubbles', phrase: 'a mouth blowing bubbles', Svg: P.Mouth3 },
        { id: 'tongue', label: 'Silly', phrase: 'a silly tongue', Svg: P.Mouth4 },
      ],
    },
    {
      id: 'tail',
      label: 'Tail',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'lightning', label: 'Arrow', phrase: 'an arrow tail', Svg: P.Tail1 },
        { id: 'fire', label: 'Fire', phrase: 'a fire tail', Svg: P.Tail2 },
        { id: 'ice', label: 'Fish', phrase: 'a fish tail', Svg: P.Tail3 },
        { id: 'leaf', label: 'Heart', phrase: 'a heart tail', Svg: P.Tail4 },
      ],
    },
  ],
  // no colour picker: the colour belongs to the body, see dragonColors
  colorsFor: dragonColors,
  colorSlots: [],
  defaultParts: { body: 'classic', wings: 'bat', eyes: 'cute', mouth: 'smile', tail: 'lightning' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `${name} the dragon` : 'My dragon';
    const has = listPhrases(phrasesOf(DRAGON, parts, ['body', 'wings', 'eyes', 'mouth', 'tail']));
    return has ? `${who} has ${has}.` : `${who} is still just an idea!`;
  },
};

/** The colours the 3D dragon is painted in: the body's own and the wings' own. */
export function resolveDragonColors(parts: PartMap, _colors?: Record<string, string>) {
  const c = dragonColors(parts);
  return { body: c.body, wings: c.wings };
}

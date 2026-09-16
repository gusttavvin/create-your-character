import { listPhrases, phrasesOf, type CharacterDefinition, type PartMap } from '../types';
import * as P from './parts';

export const DRAGON: CharacterDefinition = {
  kind: 'dragon',
  noun: 'Dragon',
  title: 'Create Your Dragon',
  emoji: '🐉',
  categories: [
    {
      id: 'body',
      label: 'Body',
      color: '#FF6B78',
      options: [
        { id: 'chubby', label: 'Chubby', phrase: 'a chubby body', Svg: P.BodyChubby },
        { id: 'tall', label: 'Tall', phrase: 'a tall body', Svg: P.BodyTall },
        { id: 'spiky', label: 'Spiky', phrase: 'a spiky body', Svg: P.BodySpiky },
        { id: 'round', label: 'Round', phrase: 'a round body', Svg: P.BodyRound },
      ],
    },
    {
      id: 'wings',
      label: 'Wings',
      color: '#FF8A2A',
      optional: true,
      options: [
        { id: 'bat', label: 'Bat', phrase: 'bat wings', Svg: P.WingsBat },
        { id: 'feather', label: 'Feather', phrase: 'feather wings', Svg: P.WingsFeather },
        { id: 'tiny', label: 'Tiny', phrase: 'tiny wings', Svg: P.WingsTiny },
        { id: 'butterfly', label: 'Butterfly', phrase: 'butterfly wings', Svg: P.WingsButterfly },
      ],
    },
    {
      id: 'horns',
      label: 'Horns',
      color: '#FFD93D',
      optional: true,
      options: [
        { id: 'pointy', label: 'Pointy', phrase: 'pointy horns', Svg: P.HornsPointy },
        { id: 'curly', label: 'Curly', phrase: 'curly horns', Svg: P.HornsCurly },
        { id: 'antlers', label: 'Antlers', phrase: 'antlers', Svg: P.HornsAntlers },
        { id: 'unicorn', label: 'Unicorn', phrase: 'a unicorn horn', Svg: P.HornsUnicorn },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'cute', label: 'Cute', phrase: 'cute eyes', Svg: P.EyesCute },
        { id: 'fierce', label: 'Fierce', phrase: 'fierce eyes', Svg: P.EyesFierce },
        { id: 'big', label: 'Big', phrase: 'big eyes', Svg: P.EyesBig },
        { id: 'star', label: 'Star', phrase: 'star eyes', Svg: P.EyesStar },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'smile', label: 'Smile', phrase: 'a big smile', Svg: P.MouthSmile },
        { id: 'fire', label: 'Fire', phrase: 'a mouth that breathes fire', Svg: P.MouthFire },
        { id: 'teeth', label: 'Teeth', phrase: 'sharp teeth', Svg: P.MouthTeeth },
        { id: 'tongue', label: 'Tongue', phrase: 'a silly tongue', Svg: P.MouthTongue },
      ],
    },
    {
      id: 'tail',
      label: 'Tail',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'fire', label: 'Fire', phrase: 'a tail of fire', Svg: P.TailFire },
        { id: 'star', label: 'Star', phrase: 'a star tail', Svg: P.TailStar },
        { id: 'crystal', label: 'Crystal', phrase: 'a crystal tail', Svg: P.TailCrystal },
        { id: 'leaf', label: 'Leaf', phrase: 'a leaf tail', Svg: P.TailLeaf },
      ],
    },
  ],
  colorSlots: [
    {
      id: 'body',
      label: 'Body color',
      swatches: [
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'red', label: 'Red', value: '#FF6B78' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'orange', label: 'Orange', value: '#FF8A2A' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'teal', label: 'Teal', value: '#2ED8C3' },
      ],
    },
    {
      id: 'wings',
      label: 'Wing color',
      swatches: [
        { id: 'orange', label: 'Orange', value: '#FF8A2A' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'red', label: 'Red', value: '#FF6B78' },
        { id: 'white', label: 'White', value: '#F4F6FF' },
      ],
    },
  ],
  defaultParts: { body: 'chubby', wings: 'bat', horns: 'pointy', eyes: 'cute', mouth: 'smile', tail: 'fire' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `${name} the dragon` : 'My dragon';
    const has = listPhrases(phrasesOf(DRAGON, parts, ['body', 'wings', 'horns', 'eyes', 'mouth', 'tail']));
    return has ? `${who} has ${has}.` : `${who} is still just an idea!`;
  },
};

/** Face placement per body shape (fractions of the body height). */
export const DRAGON_BODY_LAYOUT: Record<string, { eyeY: number; mouthY: number; eyeSize: number; mouthSize: number; hornY: number }> = {
  chubby: { eyeY: 0.27, mouthY: 0.45, eyeSize: 170, mouthSize: 140, hornY: 0.0 },
  tall: { eyeY: 0.24, mouthY: 0.4, eyeSize: 170, mouthSize: 140, hornY: 0.0 },
  spiky: { eyeY: 0.36, mouthY: 0.56, eyeSize: 180, mouthSize: 150, hornY: 0.02 },
  round: { eyeY: 0.34, mouthY: 0.55, eyeSize: 190, mouthSize: 150, hornY: 0.0 },
};

/** Effective colors: user choice, else the option's own default color. */
export function resolveDragonColors(parts: PartMap, colors: Record<string, string>) {
  return {
    body: colors.body || P.DRAGON_DEFAULTS.body[parts.body] || '#7ED957',
    wings: colors.wings || P.DRAGON_DEFAULTS.wings[parts.wings] || '#FF8A2A',
  };
}

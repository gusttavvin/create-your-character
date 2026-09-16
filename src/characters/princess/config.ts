import type { CharacterDefinition, PartMap } from '../types';
import * as P from './parts';

export const PRINCESS: CharacterDefinition = {
  kind: 'princess',
  noun: 'Princess',
  title: 'Create Your Princess',
  emoji: '👸',
  categories: [
    {
      id: 'dress',
      label: 'Dress',
      color: '#FF6EC7',
      options: [
        { id: 'gown', label: 'Ball Gown', phrase: 'a ball gown', Svg: P.DressGown },
        { id: 'aline', label: 'Bow Dress', phrase: 'a dress with a bow', Svg: P.DressAline },
        { id: 'mermaid', label: 'Mermaid', phrase: 'a mermaid dress', Svg: P.DressMermaid },
        { id: 'star', label: 'Star', phrase: 'a star dress', Svg: P.DressStar },
      ],
    },
    {
      id: 'hair',
      label: 'Hair',
      color: '#FF8A2A',
      options: [
        { id: 'long', label: 'Long', phrase: 'long hair', Svg: P.HairLong },
        { id: 'braids', label: 'Braids', phrase: 'two braids', Svg: P.HairBraids },
        { id: 'bun', label: 'Bun', phrase: 'a bun', Svg: P.HairBun },
        { id: 'curly', label: 'Curly', phrase: 'curly hair', Svg: P.HairCurly },
      ],
    },
    {
      id: 'crown',
      label: 'Crown',
      color: '#FFD93D',
      options: [
        { id: 'tiara', label: 'Tiara', phrase: 'a tiara', Svg: P.CrownTiara },
        { id: 'gold', label: 'Crown', phrase: 'a golden crown', Svg: P.CrownGold },
        { id: 'flowers', label: 'Flowers', phrase: 'a flower crown', Svg: P.CrownFlowers },
        { id: 'bow', label: 'Bow', phrase: 'a big bow', Svg: P.CrownBow },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#4FC3FF',
      options: [
        { id: 'sparkly', label: 'Sparkly', phrase: 'sparkly eyes', Svg: P.EyesSparkly },
        { id: 'happy', label: 'Happy', phrase: 'happy eyes', Svg: P.EyesHappy },
        { id: 'wink', label: 'Wink', phrase: 'a wink', Svg: P.EyesWink },
        { id: 'sleepy', label: 'Sleepy', phrase: 'sleepy eyes', Svg: P.EyesSleepy },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      options: [
        { id: 'smile', label: 'Smile', phrase: 'a sweet smile', Svg: P.MouthSmile },
        { id: 'laugh', label: 'Laugh', phrase: 'a big laugh', Svg: P.MouthLaugh },
        { id: 'oh', label: 'Oh!', phrase: 'a surprised mouth', Svg: P.MouthOh },
        { id: 'tongue', label: 'Tongue', phrase: 'a silly tongue', Svg: P.MouthTongue },
      ],
    },
    {
      id: 'accessory',
      label: 'Item',
      color: '#A77BFF',
      options: [
        { id: 'wand', label: 'Wand', phrase: 'a magic wand', Svg: P.AccessoryWand },
        { id: 'book', label: 'Book', phrase: 'a book', Svg: P.AccessoryBook },
        { id: 'scepter', label: 'Scepter', phrase: 'a scepter', Svg: P.AccessoryScepter },
        { id: 'kitten', label: 'Kitten', phrase: 'a kitten', Svg: P.AccessoryKitten },
      ],
    },
  ],
  colorSlots: [
    {
      id: 'skin',
      label: 'Skin',
      swatches: [
        { id: 'light', label: 'Light', value: '#FCE1C8' },
        { id: 'tan', label: 'Tan', value: '#F2BE8E' },
        { id: 'brown', label: 'Brown', value: '#B7783F' },
        { id: 'dark', label: 'Dark', value: '#6E3F1E' },
      ],
    },
    {
      id: 'hair',
      label: 'Hair color',
      swatches: [
        { id: 'blonde', label: 'Blonde', value: '#FFC93C' },
        { id: 'brown', label: 'Brown', value: '#8B4513' },
        { id: 'black', label: 'Black', value: '#2B1B12' },
        { id: 'red', label: 'Red', value: '#D2461F' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
      ],
    },
    {
      id: 'dress',
      label: 'Dress color',
      swatches: [
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'teal', label: 'Teal', value: '#2ED8C3' },
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'red', label: 'Red', value: '#FF6B78' },
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'white', label: 'White', value: '#F4F6FF' },
      ],
    },
  ],
  defaultParts: { dress: 'gown', hair: 'long', crown: 'tiara', eyes: 'sparkly', mouth: 'smile', accessory: 'wand' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const ph = (cat: string) =>
      PRINCESS.categories.find((c) => c.id === cat)?.options.find((o) => o.id === parts[cat])?.phrase ?? '';
    const who = name ? `Princess ${name}` : 'My princess';
    return `${who} has ${ph('hair')}, ${ph('crown')}, ${ph('eyes')} and ${ph('mouth')}. She is wearing ${ph('dress')} and holding ${ph('accessory')}.`;
  },
};

/** Effective colors: user choice, else the option's own default color. */
export function resolvePrincessColors(parts: PartMap, colors: Record<string, string>) {
  return {
    skin: colors.skin || P.PRINCESS_DEFAULTS.skin,
    dress: colors.dress || P.PRINCESS_DEFAULTS.dress[parts.dress] || '#FF6EC7',
    hair: colors.hair || P.PRINCESS_DEFAULTS.hair[parts.hair] || '#FFC93C',
  };
}

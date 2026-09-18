import { listPhrases, phrasesOf, pickOption, type CharacterDefinition, type PartMap } from '../types';
import * as P from './parts';

/**
 * 'fairy' is added to CharacterKind when the character is wired into the
 * registry; the cast keeps this module compiling on its own until then.
 */

export const FAIRY: CharacterDefinition = {
  kind: 'fairy',
  noun: 'Fairy',
  title: 'Create Your Fairy',
  emoji: '🧚',
  categories: [
    {
      id: 'dress',
      label: 'Dress',
      color: '#FF6EC7',
      options: [
        { id: 'petal', label: 'Petal', phrase: 'a petal dress', Svg: P.DressPetal },
        { id: 'leaf', label: 'Leaf', phrase: 'a leaf dress', Svg: P.DressLeaf },
        { id: 'star', label: 'Star', phrase: 'a star dress', Svg: P.DressStar },
        { id: 'bubble', label: 'Bubble', phrase: 'a bubble dress', Svg: P.DressBubble },
      ],
    },
    {
      id: 'wings',
      label: 'Wings',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'butterfly', label: 'Butterfly', phrase: 'butterfly wings', Svg: P.WingsButterfly },
        { id: 'dragonfly', label: 'Dragonfly', phrase: 'dragonfly wings', Svg: P.WingsDragonfly },
        { id: 'leaf', label: 'Leaf', phrase: 'leaf wings', Svg: P.WingsLeaf },
        { id: 'star', label: 'Star', phrase: 'star wings', Svg: P.WingsStar },
      ],
    },
    {
      id: 'hair',
      label: 'Hair',
      color: '#FF8A2A',
      optional: true,
      options: [
        { id: 'long', label: 'Long', phrase: 'long hair', Svg: P.HairLong },
        { id: 'buns', label: 'Buns', phrase: 'two buns', Svg: P.HairBuns },
        { id: 'curly', label: 'Curly', phrase: 'curly hair', Svg: P.HairCurly },
        { id: 'braid', label: 'Braid', phrase: 'a braid', Svg: P.HairBraid },
      ],
    },
    {
      id: 'crown',
      label: 'Crown',
      color: '#FFD93D',
      optional: true,
      options: [
        { id: 'flower', label: 'Flower', phrase: 'a flower crown', Svg: P.CrownFlower },
        { id: 'leaf', label: 'Leaf', phrase: 'a leaf crown', Svg: P.CrownLeaf },
        { id: 'star', label: 'Star', phrase: 'a star crown', Svg: P.CrownStar },
        { id: 'berry', label: 'Berry', phrase: 'a berry crown', Svg: P.CrownBerry },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'sparkly', label: 'Sparkly', phrase: 'sparkly eyes', Svg: P.EyesSparkly },
        { id: 'happy', label: 'Happy', phrase: 'happy eyes', Svg: P.EyesHappy },
        { id: 'wink', label: 'Wink', phrase: 'a wink', Svg: P.EyesWink },
        { id: 'big', label: 'Big', phrase: 'big eyes', Svg: P.EyesBig },
      ],
    },
    {
      id: 'wand',
      label: 'Wand',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'star', label: 'Star', phrase: 'a star wand', Svg: P.WandStar },
        { id: 'flower', label: 'Flower', phrase: 'a flower wand', Svg: P.WandFlower },
        { id: 'moon', label: 'Moon', phrase: 'a moon wand', Svg: P.WandMoon },
        { id: 'bubble', label: 'Bubble', phrase: 'a bubble wand', Svg: P.WandBubble },
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
    {
      id: 'wings',
      label: 'Wing color',
      swatches: [
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'teal', label: 'Teal', value: '#2ED8C3' },
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'white', label: 'White', value: '#F4F6FF' },
      ],
    },
  ],
  defaultParts: { dress: 'petal', wings: 'butterfly', hair: 'long', crown: 'flower', eyes: 'sparkly', wand: 'star' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `${name} the fairy` : 'My fairy';
    const has = listPhrases(phrasesOf(FAIRY, parts, ['hair', 'crown', 'eyes']));
    const dress = pickOption(FAIRY, 'dress', parts.dress)?.phrase;
    const wings = pickOption(FAIRY, 'wings', parts.wings)?.phrase;
    const wand = pickOption(FAIRY, 'wand', parts.wand)?.phrase;
    const worn = listPhrases([dress, wings].filter((p): p is string => !!p));
    const lines = [has ? `${who} has ${has}.` : ''];
    if (worn) lines.push(`She is wearing ${worn}.`);
    if (wand) lines.push(`She is holding ${wand}.`);
    const out = lines.filter(Boolean).join(' ');
    return out || `${who} is still just an idea!`;
  },
};

/** Effective colors: user choice, else the option's own default color. */
export function resolveFairyColors(parts: PartMap, colors: Record<string, string>) {
  return {
    skin: colors.skin || P.FAIRY_DEFAULTS.skin,
    dress: colors.dress || P.FAIRY_DEFAULTS.dress[parts.dress] || '#FF6EC7',
    wings: colors.wings || P.FAIRY_DEFAULTS.wings[parts.wings] || '#4FC3FF',
    hair: colors.hair || P.FAIRY_DEFAULTS.hair[parts.hair] || '#FFC93C',
  };
}

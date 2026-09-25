import type { CharacterDefinition, PartMap } from '../types';
import { listPhrases, phrasesOf, pickOption } from '../types';
import * as P from './parts';

/**
 * 'superhero' joins the CharacterKind union when this character is wired into
 * the registry; the cast keeps this folder self-contained until then.
 */

export const SUPERHERO: CharacterDefinition = {
  kind: 'superhero',
  noun: 'Superhero',
  title: 'Create Your Superhero',
  emoji: '🦸',
  categories: [
    {
      id: 'suit',
      label: 'Suit',
      color: '#FF6B78',
      options: [
        { id: 'classic', label: 'Classic', phrase: 'a classic suit', Svg: P.SuitClassic },
        { id: 'armour', label: 'Armour', phrase: 'an armour suit', Svg: P.SuitArmour },
        { id: 'stripes', label: 'Stripes', phrase: 'a striped suit', Svg: P.SuitStripes },
        { id: 'hoodie', label: 'Hoodie', phrase: 'a hoodie suit', Svg: P.SuitHoodie },
      ],
    },
    {
      id: 'mask',
      label: 'Mask',
      color: '#FFD93D',
      optional: true,
      options: [
        { id: 'eye', label: 'Eye Mask', phrase: 'an eye mask', Svg: P.MaskEye },
        { id: 'visor', label: 'Visor', phrase: 'a visor', Svg: P.MaskVisor },
        { id: 'helmet', label: 'Helmet', phrase: 'a helmet', Svg: P.MaskHelmet },
        { id: 'goggles', label: 'Goggles', phrase: 'goggles', Svg: P.MaskGoggles },
      ],
    },
    {
      id: 'cape',
      label: 'Cape',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'long', label: 'Long', phrase: 'a long cape', Svg: P.CapeLong },
        { id: 'short', label: 'Short', phrase: 'a short cape', Svg: P.CapeShort },
        { id: 'torn', label: 'Torn', phrase: 'a torn cape', Svg: P.CapeTorn },
        { id: 'star', label: 'Star', phrase: 'a star cape', Svg: P.CapeStar },
      ],
    },
    {
      id: 'emblem',
      label: 'Emblem',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'star', label: 'Star', phrase: 'a star emblem', Svg: P.EmblemStar },
        { id: 'bolt', label: 'Bolt', phrase: 'a lightning emblem', Svg: P.EmblemBolt },
        { id: 'heart', label: 'Heart', phrase: 'a heart emblem', Svg: P.EmblemHeart },
        { id: 'shield', label: 'Shield', phrase: 'a shield emblem', Svg: P.EmblemShield },
      ],
    },
    {
      id: 'power',
      label: 'Power',
      color: '#FF8A2A',
      optional: true,
      options: [
        { id: 'fire', label: 'Fire', phrase: 'fire powers', Svg: P.PowerFire },
        { id: 'ice', label: 'Ice', phrase: 'ice powers', Svg: P.PowerIce },
        { id: 'bolt', label: 'Lightning', phrase: 'lightning powers', Svg: P.PowerBolt },
        { id: 'stars', label: 'Stars', phrase: 'star powers', Svg: P.PowerStars },
      ],
    },
    {
      id: 'boots',
      label: 'Boots',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'tall', label: 'Tall', phrase: 'tall boots', Svg: P.BootsTall },
        { id: 'rocket', label: 'Rocket', phrase: 'rocket boots', Svg: P.BootsRocket },
        { id: 'sneakers', label: 'Sneakers', phrase: 'sneakers', Svg: P.BootsSneakers },
        { id: 'armour', label: 'Armour', phrase: 'armour boots', Svg: P.BootsArmour },
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
      id: 'suit',
      label: 'Suit color',
      swatches: [
        { id: 'red', label: 'Red', value: '#FF6B78' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'orange', label: 'Orange', value: '#FF8A2A' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
        { id: 'teal', label: 'Teal', value: '#2ED8C3' },
      ],
    },
    {
      id: 'cape',
      label: 'Cape color',
      swatches: [
        { id: 'purple', label: 'Purple', value: '#A77BFF' },
        { id: 'blue', label: 'Blue', value: '#4FC3FF' },
        { id: 'teal', label: 'Teal', value: '#2ED8C3' },
        { id: 'orange', label: 'Orange', value: '#FF8A2A' },
        { id: 'red', label: 'Red', value: '#FF6B78' },
        { id: 'yellow', label: 'Yellow', value: '#FFD93D' },
        { id: 'green', label: 'Green', value: '#7ED957' },
        { id: 'pink', label: 'Pink', value: '#FF6EC7' },
      ],
    },
  ],
  defaultParts: { suit: 'classic', mask: 'eye', cape: 'long', emblem: 'star', power: 'fire', boots: 'tall' },
  defaultColors: {},
  // built from the pieces he actually has, so erasing one never leaves "has , and ."
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `Captain ${name}` : 'My superhero';
    const has = listPhrases(phrasesOf(SUPERHERO, parts, ['mask', 'cape', 'emblem']));
    const worn = listPhrases(phrasesOf(SUPERHERO, parts, ['suit', 'boots']));
    const power = pickOption(SUPERHERO, 'power', parts.power)?.phrase;
    const lines = [has ? `${who} has ${has}.` : ''];
    if (worn) lines.push(`He is wearing ${worn}.`);
    if (power) lines.push(`His power is ${power}.`);
    const out = lines.filter(Boolean).join(' ');
    return out || `${who} is still just an idea!`;
  },
};

/** Effective colors: user choice, else the option's own default color. */
export function resolveSuperheroColors(parts: PartMap, colors: Record<string, string>) {
  return {
    skin: colors.skin || P.SUPERHERO_DEFAULTS.skin,
    suit: colors.suit || P.SUPERHERO_DEFAULTS.suit[parts.suit] || '#FF6B78',
    cape: colors.cape || P.SUPERHERO_DEFAULTS.cape[parts.cape] || '#A77BFF',
  };
}

import { listPhrases, phrasesOf, pickOption, type CharacterDefinition, type ColorMap, type PartMap } from '../types';
import { pieceCard, TONES, type SkinTone } from './pieces';
import { abilityCard } from './abilities';
import * as P from './parts';

/**
 * The princess, cut from the four princesses Clara sent (art-source/princess/reference): a
 * green ball gown, the pink one made closer-fitting with purple, the blue one a red mermaid's
 * tail and the purple one short and blue;
 * a red braid, long brown hair, curly black hair and a blonde bun, each with its own tiara (the
 * crown comes with the hair and is not chosen); eyes that look different and are coloured
 * differently, the first just like the pictures'; smiling lips; and an ability, moving round
 * her (abilities.tsx).
 *
 * Clara wanted the skin chosen for every princess, whatever she wears: her face and arms are
 * drawn in the skin the child picks, everything else in the colours it was drawn in.
 */
const SKIN_SWATCHES: { id: SkinTone; label: string; value: string }[] = [
  { id: 'light', label: 'Light', value: '#FDC59B' },
  { id: 'tan', label: 'Tan', value: '#E4A074' },
  { id: 'brown', label: 'Brown', value: '#B2724A' },
  { id: 'dark', label: 'Dark', value: '#72462C' },
];

function rgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The tone nearest a chosen colour: a princess saved with an older palette gets the closest. */
export function toneOf(chosen?: string): SkinTone {
  if (!chosen) return 'light';
  const [r, g, b] = rgb(chosen);
  let best: SkinTone = 'light';
  let far = Infinity;
  for (const s of SKIN_SWATCHES) {
    const [r2, g2, b2] = rgb(s.value);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < far) [best, far] = [s.id, d];
  }
  return best;
}

/** What a princess is drawn in: the skin the child picked. */
export function princessColors(_parts: PartMap, chosen: ColorMap): ColorMap {
  const tone = toneOf(chosen.skin);
  return { skin: SKIN_SWATCHES[TONES.indexOf(tone)].value, tone };
}

const card = (row: string, id: string) => pieceCard(row, id);

export const PRINCESS: CharacterDefinition = {
  kind: 'princess',
  noun: 'Princess',
  title: 'Create Your Princess',
  emoji: '👸',
  /*
   * Like the monster and the dragon: names a six-year-old knows, numbered 1 to 4 so the class
   * can call a card out. The ids are the old princess's, so a princess saved before still
   * opens, with the new pieces.
   */
  numbered: true,
  categories: [
    {
      id: 'dress',
      label: 'Dress',
      color: '#FF6EC7',
      options: [
        { id: 'gown', label: 'Green', phrase: 'a green ball gown', Svg: card('dress', 'gown') },
        { id: 'aline', label: 'Pink', phrase: 'a pink and purple dress', Svg: card('dress', 'aline') },
        { id: 'mermaid', label: 'Mermaid', phrase: 'a red mermaid tail', Svg: card('dress', 'mermaid') },
        { id: 'star', label: 'Short', phrase: 'a short blue dress', Svg: card('dress', 'star') },
      ],
    },
    {
      id: 'hair',
      label: 'Hair',
      color: '#FF8A2A',
      optional: true,
      options: [
        { id: 'braids', label: 'Braid', phrase: 'a red braid', Svg: card('hair', 'braids') },
        { id: 'long', label: 'Long', phrase: 'long brown hair', Svg: card('hair', 'long') },
        { id: 'curly', label: 'Curly', phrase: 'curly black hair', Svg: card('hair', 'curly') },
        { id: 'bun', label: 'Bun', phrase: 'a blonde bun', Svg: card('hair', 'bun') },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'sparkly', label: 'Brown', phrase: 'brown eyes', Svg: card('eyes', 'sparkly') },
        { id: 'happy', label: 'Blue', phrase: 'sparkly blue eyes', Svg: card('eyes', 'happy') },
        { id: 'wink', label: 'Green', phrase: 'green eyes and a wink', Svg: card('eyes', 'wink') },
        { id: 'sleepy', label: 'Purple', phrase: 'purple eyes with hearts', Svg: card('eyes', 'sleepy') },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'smile', label: 'Smile', phrase: 'a sweet smile', Svg: card('mouth', 'smile') },
        { id: 'laugh', label: 'Laugh', phrase: 'a big laugh', Svg: card('mouth', 'laugh') },
        { id: 'oh', label: 'Wow', phrase: 'a surprised mouth', Svg: card('mouth', 'oh') },
        { id: 'tongue', label: 'Silly', phrase: 'a silly tongue', Svg: card('mouth', 'tongue') },
      ],
    },
    {
      id: 'accessory',
      label: 'Abilities',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'kitten', label: 'Animals', phrase: 'talk to animals', Svg: abilityCard('kitten') },
        { id: 'wand', label: 'Snow', phrase: 'make snow', Svg: abilityCard('wand') },
        { id: 'scepter', label: 'Space', phrase: 'fly to the stars', Svg: abilityCard('scepter') },
        { id: 'book', label: 'Flowers', phrase: 'make flowers grow', Svg: abilityCard('book') },
      ],
    },
  ],
  colorSlots: [{ id: 'skin', label: 'Skin', swatches: SKIN_SWATCHES.map(({ id, label, value }) => ({ id, label, value })) }],
  colorsFor: princessColors,
  defaultParts: { dress: 'gown', hair: 'braids', eyes: 'sparkly', mouth: 'smile', accessory: 'kitten' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `Princess ${name}` : 'My princess';
    const has = listPhrases(phrasesOf(PRINCESS, parts, ['hair', 'eyes', 'mouth']));
    const dress = pickOption(PRINCESS, 'dress', parts.dress)?.phrase;
    const power = pickOption(PRINCESS, 'accessory', parts.accessory)?.phrase;
    const lines = [has ? `${who} has ${has}.` : ''];
    if (dress) lines.push(`She is wearing ${dress}.`);
    if (power) lines.push(`She can ${power}!`);
    const out = lines.filter(Boolean).join(' ');
    return out || `${who} is still just an idea!`;
  },
};

/**
 * The colours the old 3D princess (Princess3D) is built in, until she is remade from the new
 * pictures: the skin picked, and the old pieces' own dress and hair colours.
 */
export function resolvePrincessColors(parts: PartMap, colors: Record<string, string>) {
  return {
    skin: colors.skin || P.PRINCESS_DEFAULTS.skin,
    dress: colors.dress || P.PRINCESS_DEFAULTS.dress[parts.dress] || '#FF6EC7',
    hair: colors.hair || P.PRINCESS_DEFAULTS.hair[parts.hair] || '#FFC93C',
  };
}

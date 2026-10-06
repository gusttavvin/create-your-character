import { listPhrases, phrasesOf, type CharacterDefinition, type ColorMap, type PartMap } from '../types';
import * as P from './parts';
import { MONSTER_BODY_LAYOUT } from './layout';

/**
 * The colours a monster wears.
 *
 * The child does not choose these. Clara asked for the palette to be decided here and the
 * colour picker taken away. Each body is one of the six creatures she approved, so its
 * colour is simply that creature's own, and every piece the monster wears is repainted
 * from it — a piece worn by the creature it was cut from gets its own colours back
 * untouched. See `repainter` in lib/color.
 */
export function monsterColors(parts: PartMap): ColorMap {
  const l = MONSTER_BODY_LAYOUT[parts.body] ?? MONSTER_BODY_LAYOUT.round;
  return { body: l.main, main: l.main };
}

export const MONSTER: CharacterDefinition = {
  kind: 'monster',
  noun: 'Monster',
  title: 'Create Your Monster',
  emoji: '👾',
  categories: [
    {
      id: 'body',
      label: 'Body',
      color: '#FF6B78',
      options: [
        { id: 'round', label: 'Round', phrase: 'a round body', Svg: P.BodyRound },
        { id: 'egg', label: 'Egg', phrase: 'an egg body', Svg: P.BodyEgg },
        { id: 'square', label: 'Square', phrase: 'a square body', Svg: P.BodySquare },
        { id: 'hourglass', label: 'Hourglass', phrase: 'an hourglass body', Svg: P.BodyHourglass },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#FFD93D',
      optional: true,
      options: [
        { id: 'stalks', label: 'Stalks', phrase: 'eyes on stalks', Svg: P.EyesStalks },
        { id: 'multiple', label: 'Multiple', phrase: 'multiple eyes', Svg: P.EyesMultiple },
        { id: 'one', label: 'One', phrase: 'one big eye', Svg: P.EyesOne },
        { id: 'angry', label: 'Angry', phrase: 'angry eyes', Svg: P.EyesAngry },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'smile', label: 'Smile', phrase: 'a big smile', Svg: P.MouthSmile },
        { id: 'tongue', label: 'Tongue', phrase: 'a smile with a tongue', Svg: P.MouthTongue },
        { id: 'fangs', label: 'Fangs', phrase: 'two sharp fangs', Svg: P.MouthFangs },
        { id: 'beak', label: 'Beak', phrase: 'a yellow beak', Svg: P.MouthBeak },
      ],
    },
    {
      id: 'arms',
      label: 'Arms',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'claw', label: 'Claw', phrase: 'claw arms', Svg: P.ArmClaw },
        { id: 'tentacle', label: 'Tentacle', phrase: 'tentacle arms', Svg: P.ArmTentacle },
        { id: 'pincher', label: 'Pincher', phrase: 'pincher arms', Svg: P.ArmPincher },
        { id: 'fuzzy', label: 'Fuzzy', phrase: 'fuzzy arms', Svg: P.ArmFuzzy },
      ],
    },
    {
      id: 'legs',
      label: 'Legs',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'paws', label: 'Paws', phrase: 'furry paws', Svg: P.LegsPaws },
        { id: 'bird', label: 'Bird', phrase: 'bird legs', Svg: P.LegsBird },
        { id: 'long', label: 'Long', phrase: 'long legs', Svg: P.LegsLong },
        { id: 'snake', label: 'Snake', phrase: 'snake legs', Svg: P.LegsSnake },
      ],
    },
  ],
  // no colour picker: the colour belongs to the body, see monsterColors
  colorsFor: monsterColors,
  colorSlots: [],
  /**
   * Picking a body brings the rest of that creature with it.
   *
   * Each body is one of the six drawings, and a creature is its face and its hands as much
   * as its shape, so choosing "round" puts the whole orange fur ball on the sheet rather
   * than a bare body under whatever face happened to be there. Every row can still be
   * swapped afterwards, which is the point of the game.
   */
  outfits: {
    round: { eyes: 'angry', mouth: 'tongue', arms: 'fuzzy', legs: 'paws' },
    egg: { eyes: 'multiple', mouth: 'tongue', arms: 'claw', legs: 'paws' },
    square: { eyes: 'angry', mouth: 'smile', arms: 'claw', legs: 'long' },
    hourglass: { eyes: 'angry', mouth: 'tongue', arms: 'claw', legs: 'bird' },
  },
  defaultParts: { body: 'round', eyes: 'angry', mouth: 'tongue', arms: 'fuzzy', legs: 'paws' },
  defaultColors: {},
  /**
   * What a saved monster's old words now mean.
   *
   * The frowning eyes were called "sleepy" until the drawing was matched; and the four mouths
   * and four legs were too much alike, so three mouths and two legs were redrawn. A character
   * a child saved last term still opens, wearing the nearest thing to what it had.
   */
  renamed: {
    eyes: { sleepy: 'angry' },
    mouth: { teeth: 'smile', jagged: 'fangs', big_tongue: 'tongue' },
    legs: { stubby: 'paws', thick: 'long' },
  },
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `${name} the monster` : 'My monster';
    const has = listPhrases(phrasesOf(MONSTER, parts, ['body', 'eyes', 'mouth', 'arms', 'legs']));
    return has ? `${who} has ${has}.` : `${who} is still just an idea!`;
  },
};

/** Main fill colour of each part in 3D, before the child paints the monster. */
export const MONSTER_COLORS = {
  body: { round: '#8BD43B', egg: '#A97CF1', square: '#4FA9F5', hourglass: '#FF8A2A' } as Record<string, string>,
  arms: { claw: '#8BD43B', tentacle: '#FF6EC7', pincher: '#4FA9F5', fuzzy: '#FF8A2A' } as Record<string, string>,
  legs: { stubby: '#A97CF1', bird: '#FFC400', thick: '#8BD43B', snake: '#FF3B4A' } as Record<string, string>,
  eyes: { stalks: '#7ED957', multiple: '#ffffff', one: '#3AA0FF', angry: '#3AA0FF' } as Record<string, string>,
};

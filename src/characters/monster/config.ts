import { listPhrases, phrasesOf, type CharacterDefinition, type PartMap } from '../types';

const P = '/assets/monster/parts';

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
        { id: 'round', label: 'Round', phrase: 'a round body', img: `${P}/body/round.png` },
        { id: 'egg', label: 'Egg', phrase: 'an egg body', img: `${P}/body/egg.png` },
        { id: 'square', label: 'Square', phrase: 'a square body', img: `${P}/body/square.png` },
        { id: 'hourglass', label: 'Hourglass', phrase: 'an hourglass body', img: `${P}/body/hourglass.png` },
      ],
    },
    {
      id: 'eyes',
      label: 'Eyes',
      color: '#FFD93D',
      optional: true,
      options: [
        { id: 'stalks', label: 'Stalks', phrase: 'eyes on stalks', img: `${P}/eyes/stalks.png` },
        { id: 'multiple', label: 'Multiple', phrase: 'multiple eyes', img: `${P}/eyes/multiple.png` },
        { id: 'one', label: 'One', phrase: 'one big eye', img: `${P}/eyes/one.png` },
        { id: 'sleepy', label: 'Sleepy', phrase: 'sleepy eyes', img: `${P}/eyes/sleepy.png` },
      ],
    },
    {
      id: 'mouth',
      label: 'Mouth',
      color: '#7ED957',
      optional: true,
      options: [
        { id: 'teeth', label: 'Teeth', phrase: 'a mouth full of teeth', img: `${P}/mouth/teeth.png` },
        { id: 'tongue', label: 'Tongue', phrase: 'a smile with a tongue', img: `${P}/mouth/tongue.png` },
        { id: 'jagged', label: 'Jagged', phrase: 'a jagged mouth', img: `${P}/mouth/jagged.png` },
        { id: 'big_tongue', label: 'Big Tongue', phrase: 'a big tongue', img: `${P}/mouth/big_tongue.png` },
      ],
    },
    {
      id: 'arms',
      label: 'Arms',
      color: '#A77BFF',
      optional: true,
      options: [
        { id: 'claw', label: 'Claw', phrase: 'claw arms', img: `${P}/arms/claw.png` },
        { id: 'tentacle', label: 'Tentacle', phrase: 'tentacle arms', img: `${P}/arms/tentacle.png` },
        { id: 'pincher', label: 'Pincher', phrase: 'pincher arms', img: `${P}/arms/pincher.png` },
        { id: 'fuzzy', label: 'Fuzzy', phrase: 'fuzzy arms', img: `${P}/arms/fuzzy.png` },
      ],
    },
    {
      id: 'legs',
      label: 'Legs',
      color: '#4FC3FF',
      optional: true,
      options: [
        { id: 'stubby', label: 'Stubby', phrase: 'stubby legs', img: `${P}/legs/stubby.png` },
        { id: 'bird', label: 'Bird', phrase: 'bird legs', img: `${P}/legs/bird.png` },
        { id: 'thick', label: 'Thick', phrase: 'thick legs', img: `${P}/legs/thick.png` },
        { id: 'snake', label: 'Snake', phrase: 'snake legs', img: `${P}/legs/snake.png` },
      ],
    },
  ],
  colorSlots: [],
  defaultParts: { body: 'round', eyes: 'stalks', mouth: 'teeth', arms: 'claw', legs: 'stubby' },
  defaultColors: {},
  sentence: (parts: PartMap, name?: string) => {
    const who = name ? `${name} the monster` : 'My monster';
    const has = listPhrases(phrasesOf(MONSTER, parts, ['body', 'eyes', 'mouth', 'arms', 'legs']));
    return has ? `${who} has ${has}.` : `${who} is still just an idea!`;
  },
};

/** 2D layout metrics per body shape, in a 600 x 720 virtual canvas. */
export interface BodyLayout {
  halfW: number; // half of the visible body width (virtual units)
  /** First and last opaque row of the art, in its own 512 px image. */
  top: number;
  bottom: number;
  eyeY: number; // fraction of body height (0 = top, 1 = bottom)
  eyeSize: number;
  mouthY: number;
  mouthSize: number;
  armY: number;
  armInset: number; // where the arm attaches, as a fraction of halfW
}

// Three of the four bodies were drawn standing on their own little feet, which fought with
// the legs the child picks. Those feet were cut off the artwork and the hem closed, so each
// body now ends higher than the kit's original 470.
export const BODY_LAYOUT: Record<string, BodyLayout> = {
  round: { halfW: 173, top: 41, bottom: 425, eyeY: 0.3, eyeSize: 210, mouthY: 0.63, mouthSize: 150, armY: 0.6, armInset: 0.82 },
  egg: { halfW: 143, top: 41, bottom: 441, eyeY: 0.33, eyeSize: 190, mouthY: 0.61, mouthSize: 140, armY: 0.64, armInset: 0.86 },
  square: { halfW: 171, top: 41, bottom: 425, eyeY: 0.3, eyeSize: 210, mouthY: 0.63, mouthSize: 150, armY: 0.6, armInset: 0.78 },
  hourglass: { halfW: 136, top: 41, bottom: 470, eyeY: 0.22, eyeSize: 170, mouthY: 0.4, mouthSize: 120, armY: 0.72, armInset: 0.9 },
};

/** Fraction of the 512px legs image between its top edge and the first opaque pixel. */
export const LEG_TOP: Record<string, number> = { stubby: 0.215, bird: 0.13, thick: 0.22, snake: 0.12 };

/** Main fill color of each kit part (used by the 3D builder). */
export const MONSTER_COLORS = {
  body: { round: '#8BD43B', egg: '#A97CF1', square: '#4FA9F5', hourglass: '#FF8A2A' } as Record<string, string>,
  arms: { claw: '#8BD43B', tentacle: '#FF6EC7', pincher: '#4FA9F5', fuzzy: '#FF8A2A' } as Record<string, string>,
  legs: { stubby: '#A97CF1', bird: '#FFC400', thick: '#8BD43B', snake: '#FF3B4A' } as Record<string, string>,
  eyes: { stalks: '#7ED957', multiple: '#ffffff', one: '#3AA0FF', sleepy: '#3AA0FF' } as Record<string, string>,
};

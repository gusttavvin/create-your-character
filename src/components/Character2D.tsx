import Monster2D from '../characters/monster/Monster2D';
import Dragon2D from '../characters/dragon/Dragon2D';
import Princess2D from '../characters/princess/Princess2D';
import Superhero2D from '../characters/superhero/Superhero2D';
import Fairy2D from '../characters/fairy/Fairy2D';
import type { CharacterKind, ColorMap, PartMap } from '../characters/types';

interface Props {
  kind: CharacterKind;
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

/** Picks the right 2D compositor for a character kind. */
export default function Character2D({ kind, parts, colors, animate = true, className }: Props) {
  const common = { parts, colors, animate, className };
  if (kind === 'dragon') return <Dragon2D {...common} />;
  if (kind === 'princess') return <Princess2D {...common} />;
  if (kind === 'superhero') return <Superhero2D {...common} />;
  if (kind === 'fairy') return <Fairy2D {...common} />;
  return <Monster2D parts={parts} animate={animate} className={className} />;
}

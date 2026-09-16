import Monster2D from '../characters/monster/Monster2D';
import Dragon2D from '../characters/dragon/Dragon2D';
import Princess2D from '../characters/princess/Princess2D';
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
  if (kind === 'dragon') return <Dragon2D parts={parts} colors={colors} animate={animate} className={className} />;
  if (kind === 'princess') return <Princess2D parts={parts} colors={colors} animate={animate} className={className} />;
  return <Monster2D parts={parts} animate={animate} className={className} />;
}

import type { ColorMap, PartOption } from '../characters/types';

const FILL = { width: '100%', height: '100%', display: 'block' } as const;

/** Draws one part, whichever way it was authored: a kit PNG or a vector component. */
export default function PartArt({ option, colors, alt }: { option: PartOption; colors: ColorMap; alt?: string }) {
  if (option.img) return <img src={option.img} alt={alt ?? option.label} draggable={false} style={FILL} />;
  const Svg = option.Svg;
  return Svg ? <Svg colors={colors} /> : null;
}

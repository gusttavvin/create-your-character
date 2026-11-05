import type { MemoryItem } from './decks';

/**
 * An emoji drawn as a colour picture: some (the ball ⚽, the star ⭐) are text symbols unless
 * followed by the emoji sign U+FE0F, and Windows drew the ball bigger and plainer than the rest.
 */
function asEmoji(emoji: string) {
  const chars = [...emoji];
  if (chars.length === 1 && (chars[0].codePointAt(0) ?? 0) < 0x1f000) return `${emoji}️`;
  return emoji;
}

/** A card's picture: the teacher's own image when she chose one, otherwise the emoji. */
export default function ItemPicture({ item, className }: { item: Pick<MemoryItem, 'emoji' | 'image'>; className: string }) {
  if (item.image) return <img className={`${className} is-photo`} src={item.image} alt="" draggable={false} />;
  return (
    <span className={className} aria-hidden>
      {asEmoji(item.emoji)}
    </span>
  );
}

import type { MemoryItem } from './decks';

/** A card's picture: the teacher's own image when she chose one, otherwise the emoji. */
export default function ItemPicture({ item, className }: { item: Pick<MemoryItem, 'emoji' | 'image'>; className: string }) {
  if (item.image) return <img className={`${className} is-photo`} src={item.image} alt="" draggable={false} />;
  return (
    <span className={className} aria-hidden>
      {item.emoji}
    </span>
  );
}

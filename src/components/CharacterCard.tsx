import { Link } from 'react-router-dom';
import type { SavedCharacter } from '../characters/types';
import { CHARACTERS } from '../characters/registry';
import Character2D from './Character2D';

interface Props {
  c: SavedCharacter;
  canEdit?: boolean;
  onDelete?: (c: SavedCharacter) => void;
}

export default function CharacterCard({ c, canEdit, onDelete }: Props) {
  const def = CHARACTERS[c.kind];
  return (
    <article className="ccard" data-kind={c.kind}>
      <Link to={`/c/${c.id}`} className="ccard-art" title="Show">
        <Character2D kind={c.kind} parts={c.parts} colors={c.colors} layout={c.layout} animate={false} />
      </Link>
      <div className="ccard-body">
        <h3 className="ccard-name">
          {def.emoji} {c.name}
        </h3>
        <p className="ccard-meta">
          {def.noun}
          {c.owner_name ? ` · by ${c.owner_name}` : ''}
        </p>
        <div className="ccard-actions">
          <Link to={`/c/${c.id}`} className="btn btn-small btn-ghost">
            ⭐ Show
          </Link>
          {canEdit && (
            <Link to={`/build/${c.kind}/${c.id}`} className="btn btn-small btn-primary">
              ✏️ Edit
            </Link>
          )}
          {canEdit && onDelete && (
            <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(c)}>
              🗑
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

import { useEffect, useState } from 'react';
import { findPictures, type Found } from './library';

/**
 * A picture from one collection. A collection that has no drawing of that thing simply
 * answers with nothing, so a picture only appears once it has loaded: one that will not
 * load is never seen, rather than shown as an empty box until it fails.
 */
function Thumb({ src, from, caption, busy, onChoose }: { src: string; from: string; caption: boolean; busy: boolean; onChoose: (src: string) => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'broken'>('loading');
  if (state === 'broken') return null;
  return (
    <button type="button" className={`wp-thumb${state === 'loading' ? ' is-loading' : ''}`} title={from} aria-label={`Choose this picture (${from})`} disabled={busy} onClick={() => onChoose(src)}>
      <img src={src} alt="" draggable={false} onLoad={() => setState('ready')} onError={() => setState('broken')} />
      {caption && <span className="wp-from">{from}</span>}
      {busy && (
        <span className="wp-busy" aria-hidden>
          ⏳
        </span>
      )}
    </button>
  );
}

/**
 * Every collection's pictures of one word, to choose from.
 *
 * In a line of the editor it is a single strip with the best picture from each collection,
 * there as soon as she stops typing. In the chooser each collection gets its own row with a
 * few pictures, for when the first guess is not the one she wants.
 */
export default function WordPictures({
  word,
  perLibrary,
  compact = false,
  busySrc,
  onChoose,
}: {
  word: string;
  perLibrary: number;
  compact?: boolean;
  /** The picture being copied into the pack, if any. */
  busySrc?: string | null;
  onChoose: (src: string) => void;
}) {
  const [found, setFound] = useState<Found[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const w = word.trim();

  useEffect(() => {
    if (w.length < 2) {
      setFound(null);
      setState('idle');
      return;
    }
    let live = true;
    setState('loading');
    // wait until she stops typing, so "dolphin" is not looked up as "d", "do", "dol"…
    const t = window.setTimeout(() => {
      findPictures(w, perLibrary)
        .then((f) => {
          if (!live) return;
          setFound(f);
          setState('done');
        })
        .catch(() => live && setState('failed'));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [w, perLibrary]);

  if (state === 'idle') return null;
  if (state === 'loading' && !found) return <p className="wp-note">Looking for pictures of “{w}”…</p>;
  if (state === 'failed') return <p className="wp-note">The pictures could not be reached. Check the internet and try again.</p>;

  const any = (found ?? []).some((f) => f.pictures.length);
  if (!any) return <p className="wp-note">No pictures found for “{w}”. Try another word — a simpler one often works.</p>;

  if (compact) {
    return (
      <div className="wp-strip" aria-label={`Pictures of ${w}`}>
        {(found ?? [])
          .filter((f) => f.pictures.length)
          .map((f) => (
            <Thumb key={f.pictures[0]} src={f.pictures[0]} from={f.library.name} caption busy={busySrc === f.pictures[0]} onChoose={onChoose} />
          ))}
      </div>
    );
  }

  return (
    <div className="wp-libraries">
      {(found ?? [])
        .filter((f) => f.pictures.length)
        .map((f) => (
          <section key={f.library.id} className="wp-library">
            <h3 className="wp-name">{f.library.name}</h3>
            <div className="wp-row">
              {f.pictures.map((src) => (
                <Thumb key={src} src={src} from={f.library.name} caption={false} busy={busySrc === src} onChoose={onChoose} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

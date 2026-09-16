import type { ReactNode } from 'react';
import type { CharacterDefinition, PartMap } from '../characters/types';

/** Renders the description sentence with each vocabulary phrase colored like its row. */
export function highlightSentence(sentence: string, def: CharacterDefinition, parts: PartMap): ReactNode[] {
  const phrases = def.categories
    .map((c) => ({ color: c.color, text: c.options.find((o) => o.id === parts[c.id])?.phrase ?? '' }))
    .filter((p) => p.text);
  const out: ReactNode[] = [];
  let rest = sentence;
  let i = 0;
  while (rest.length) {
    let best: { idx: number; color: string; text: string } | null = null;
    for (const p of phrases) {
      const idx = rest.indexOf(p.text);
      if (idx >= 0 && (best === null || idx < best.idx)) best = { idx, color: p.color, text: p.text };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(
      <mark key={i++} className="word" style={{ ['--w' as string]: best.color }}>
        {best.text}
      </mark>,
    );
    rest = rest.slice(best.idx + best.text.length);
  }
  return out;
}

export default function Sentence({ def, parts, name, onRead }: { def: CharacterDefinition; parts: PartMap; name?: string; onRead?: () => void }) {
  const sentence = def.sentence(parts, name);
  return (
    <div className="sentence">
      <p className="sentence-text">{highlightSentence(sentence, def, parts)}</p>
      {onRead && (
        <button type="button" className="btn btn-read" onClick={onRead} title="Read the sentence aloud">
          🔈 Read it!
        </button>
      )}
    </div>
  );
}

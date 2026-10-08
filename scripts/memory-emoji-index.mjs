/**
 * Writes the word list the memory game uses to find pictures for an English word.
 *
 *   npm run memory:index
 *
 * Every picture collection the game offers is drawn from the same list of emoji, so one
 * list of names and keywords finds a dolphin in all of them at once. It comes from
 * emojibase (MIT), is kept inside the site and is searched there, so typing a word asks
 * no outside service anything: the first version asked a search service, and a few
 * minutes of trying it out were enough for that service to start turning requests away.
 *
 * Each entry is [code points, name, keywords], the keywords joined by spaces.
 */
import { writeFileSync } from 'node:fs';

const SOURCE = 'https://cdn.jsdelivr.net/npm/emojibase-data@16/en/data.json';
const OUT = new URL('../src/games/memory/emoji-index.json', import.meta.url);

/** emojibase's group for skin tones and hair styles: parts of other emoji, not pictures. */
const COMPONENTS = 2;

const data = await (await fetch(SOURCE)).json();
const entries = data
  .filter((e) => e.group !== COMPONENTS && e.hexcode && e.label)
  .sort((a, b) => a.order - b.order)
  .map((e) => [e.hexcode, e.label.toLowerCase(), (e.tags ?? []).filter((t) => t !== e.label).join(' ').toLowerCase()]);

writeFileSync(OUT, JSON.stringify(entries));
console.log(`wrote ${entries.length} entries to src/games/memory/emoji-index.json`);

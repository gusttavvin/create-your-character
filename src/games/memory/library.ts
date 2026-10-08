/**
 * The picture collections the memory game can take a card's picture from.
 *
 * Clara did not like the cards in emoji — on Windows they come out flat and outlined — and
 * asked for all the other kinds there are, to choose from as she types each word. These
 * are the free ones that cover a whole class's vocabulary and that the site is allowed to
 * use: cartoon sets drawn from the same list of emoji (so one word finds the same thing in
 * every style), and two sets of symbols made for teaching, which are looked up by word.
 *
 * A picture is only looked at here while she edits. The one she chooses is copied into her
 * pack, so the game itself never needs these sites during a lesson.
 */

/** One emoji from the word list: its code points, its name and its keywords. */
type Entry = [hex: string, label: string, tags: string];

export interface Library {
  id: string;
  /** Shown above its pictures in the chooser. */
  name: string;
  /** Pictures from the emoji list: the address of one, by its code points and name. */
  emoji?: (hex: string, label: string) => string;
  /** Pictures looked up by word in the collection's own catalogue. */
  byWord?: (word: string, limit: number) => Promise<string[]>;
}

/** The emoji's code points, lower case, without the "show as a picture" marker. */
function points(hex: string, join: string) {
  return hex
    .toLowerCase()
    .split('-')
    .filter((p) => p !== 'fe0f')
    .join(join);
}

const FLUENT = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

/** Microsoft names its folders after the emoji, capital first: "Spouting whale". */
function fluent(style: '3D' | 'Color' | 'Flat', ext: string) {
  return (_hex: string, label: string) => {
    const folder = label.charAt(0).toUpperCase() + label.slice(1);
    const file = `${label.replace(/[^a-z0-9]+/g, '_')}_${style.toLowerCase()}.${ext}`;
    return `${FLUENT}/${encodeURIComponent(folder)}/${style}/${file}`;
  };
}

const NOTO = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main';

/* ------------------------------------------------------------ teaching symbols */

async function arasaac(word: string, limit: number) {
  const r = await fetch(`https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(word)}`);
  if (!r.ok) return [];
  const list = (await r.json()) as { _id: number }[];
  return list.slice(0, limit).map((p) => `https://static.arasaac.org/pictograms/${p._id}/${p._id}_300.png`);
}

const MULBERRY = 'https://cdn.jsdelivr.net/gh/mulberrysymbols/mulberry-symbols@master/EN';
let mulberryNames: Promise<string[]> | null = null;

/** Mulberry's files are named after the word ("teddy_bear.svg", "baker_1a.svg"). */
function mulberryIndex() {
  mulberryNames ??= fetch('https://data.jsdelivr.com/v1/package/gh/mulberrysymbols/mulberry-symbols@master/flat')
    .then((r) => r.json())
    .then((j: { files: { name: string }[] }) =>
      j.files.map((f) => f.name).filter((n) => n.startsWith('/EN/') && n.endsWith('.svg')).map((n) => n.slice(4, -4)),
    )
    .catch((e) => {
      mulberryNames = null;
      throw e;
    });
  return mulberryNames;
}

async function mulberry(word: string, limit: number) {
  const names = await mulberryIndex();
  const scored = names
    .map((name) => {
      const words = name.toLowerCase().replace(/_\d+[a-z]?$/, '').replace(/_/g, ' ');
      return { name, score: closeness(word, words, '') };
    })
    .filter((s) => s.score < NOT_FOUND)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length);
  return scored.slice(0, limit).map((s) => `${MULBERRY}/${encodeURIComponent(s.name)}.svg`);
}

/* ------------------------------------------------------------------ the list */

export const LIBRARIES: Library[] = [
  { id: 'ms3d', name: 'Microsoft 3D', emoji: fluent('3D', 'png') },
  { id: 'g3d', name: 'Google 3D', emoji: (hex) => `${NOTO}/3D/png/128/emoji_u${points(hex, '_')}.png` },
  { id: 'mscolor', name: 'Microsoft Color', emoji: fluent('Color', 'svg') },
  { id: 'msflat', name: 'Microsoft Flat', emoji: fluent('Flat', 'svg') },
  { id: 'noto', name: 'Google', emoji: (hex) => `${NOTO}/2D/svg/emoji_u${points(hex, '_')}.svg` },
  { id: 'twemoji', name: 'Twemoji', emoji: (hex) => `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${points(hex, '-')}.svg` },
  { id: 'openmoji', name: 'OpenMoji', emoji: (hex) => `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${hex.toUpperCase()}.svg` },
  { id: 'emojione', name: 'Emoji One', emoji: (hex) => `https://cdn.jsdelivr.net/npm/emojione@2.2.7/assets/svg/${points(hex, '-')}.svg` },
  { id: 'arasaac', name: 'ARASAAC (for teaching)', byWord: arasaac },
  { id: 'mulberry', name: 'Mulberry (for teaching)', byWord: mulberry },
];

/**
 * A bigger copy of a picture, for keeping in the pack.
 *
 * The chooser shows small pictures so forty of them load quickly; the one she picks is
 * fetched at full size, so it is still sharp on a card projected on the board.
 */
export function fullSize(src: string) {
  return src.replace(`${NOTO}/3D/png/128/`, `${NOTO}/3D/png/512/`);
}

/* ------------------------------------------------------------------ searching */

const NOT_FOUND = 99;

/**
 * How well a name answers a word: 0 for the word itself, more the looser the match.
 *
 * "fish" is the fish first, then the tropical fish (the word inside a name), then things
 * tagged with it, then names that only start with it.
 */
function closeness(word: string, label: string, tags: string) {
  if (label === word) return 0;
  const inLabel = ` ${label} `.includes(` ${word} `);
  if (inLabel) return 1;
  if (` ${tags} `.includes(` ${word} `)) return 2;
  if (label.startsWith(word)) return 3;
  if (tags.split(' ').some((t) => t.startsWith(word))) return 4;
  if (word.length >= 4 && label.includes(word)) return 5;
  return NOT_FOUND;
}

/** The word, and the word without a plural ending: "cherries" also finds "cherry". */
function forms(word: string) {
  const w = word.trim().toLowerCase().replace(/\s+/g, ' ');
  const out = [w];
  if (w.endsWith('ies') && w.length > 4) out.push(`${w.slice(0, -3)}y`);
  else if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1));
  return out;
}

let index: Promise<Entry[]> | null = null;

/** The word list ships with the site but is only loaded once someone opens the chooser. */
function emojiIndex() {
  index ??= import('./emoji-index.json').then((m) => m.default as Entry[]);
  return index;
}

/** The emoji whose names best answer a word, best first. */
export async function emojiFor(word: string, limit: number): Promise<Entry[]> {
  const list = await emojiIndex();
  const tries = forms(word);
  const scored: { e: Entry; score: number }[] = [];
  for (const e of list) {
    let best = NOT_FOUND;
    tries.forEach((w, k) => {
      // the word as typed beats the word with its plural taken off
      const s = closeness(w, e[1], e[2]) + k * 0.5;
      if (s < best) best = s;
    });
    if (best < NOT_FOUND) scored.push({ e, score: best });
  }
  // the list is in emoji order, so ties stay with the commoner, earlier emoji
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.e);
}

export interface Found {
  library: Library;
  pictures: string[];
}

const cache = new Map<string, Promise<Found[]>>();

/** The pictures every collection has for a word, a few from each. */
export function findPictures(word: string, perLibrary: number): Promise<Found[]> {
  const key = `${word.trim().toLowerCase()}|${perLibrary}`;
  let found = cache.get(key);
  if (!found) {
    found = (async () => {
      const emoji = await emojiFor(word, perLibrary);
      return Promise.all(
        LIBRARIES.map(async (library) => {
          if (library.emoji) return { library, pictures: emoji.map(([hex, label]) => library.emoji!(hex, label)) };
          try {
            return { library, pictures: await library.byWord!(forms(word)[0], perLibrary) };
          } catch {
            return { library, pictures: [] };
          }
        }),
      );
    })();
    found.catch(() => cache.delete(key));
    cache.set(key, found);
  }
  return found;
}

/** The credit line the licences of these collections ask for. */
export const CREDITS: { name: string; licence: string; url: string }[] = [
  { name: 'Microsoft Fluent Emoji', licence: 'MIT', url: 'https://github.com/microsoft/fluentui-emoji' },
  { name: 'Google Noto Emoji', licence: 'Apache 2.0', url: 'https://github.com/googlefonts/noto-emoji' },
  { name: 'Twemoji', licence: 'CC BY 4.0', url: 'https://github.com/jdecked/twemoji' },
  { name: 'OpenMoji', licence: 'CC BY-SA 4.0', url: 'https://openmoji.org' },
  { name: 'Emoji One', licence: 'CC BY 4.0', url: 'https://github.com/joypixels/emojione' },
  {
    name: 'ARASAAC pictograms by Sergio Palao, Government of Aragon',
    licence: 'CC BY-NC-SA 4.0',
    url: 'https://arasaac.org',
  },
  { name: 'Mulberry Symbols by Steve Lee', licence: 'CC BY-SA 2.0 UK', url: 'https://mulberrysymbols.org' },
];

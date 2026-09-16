# Funny Games 🎮

A little arcade of English-learning games for Teacher Clara's class. The home page lists the
games; today there is one, **Create Your Character**, where children build a **Monster**,
**Dragon**, **Princess**, **Superhero** or **Fairy**, hear the English words read aloud, name
their creature and save it. Every character can be shown in **2D** (layered artwork) or **3D**
(a toon-shaded model that spins on the page).

Live site: deployed on Cloudflare Pages (see *Deploy* below). Backend: Supabase (free tier).

## Features

- Worksheet-style builder faithful to the original *Create Your Monster* sheet (title, sticker,
  colored rows and the taped paper are the original artwork).
- **Drag and drop**: the pieces sit in the palette at the side and are dragged onto the picture.
  The spot where the held piece belongs glows and names itself, so the child reads the word while
  placing it. Dropping anywhere on the sheet still works, because small hands miss. Tapping a
  piece also works, on a projector or with a keyboard.
- Parts that come in twos (arms, legs, eyes, braids) are **true mirrors**: one hand-drawn piece
  and its exact reflection, in 2D and in 3D.
- Five characters, each with 5–6 categories × 4 options, plus colour palettes (skin, hair,
  dress, body, wings, suit, cape).
- Any part except the base one can be erased with the **None** button in its row.
- 2D layered art with idle animations (bobbing, blinking, wiggling arms, flapping wings…).
- 3D mode with cartoon outlines, orbit/zoom and idle motion (Three.js / React Three Fiber).
- English vocabulary: every click reads the word aloud (Web Speech API), a sentence describes
  the character with the words highlighted, and a **Read it!** button reads the sentence.
- Save & name characters. Guests save on the device; signed-in users save in the cloud.
- **Teacher area**: e-mail login, classes, and every character made for a class in one place.
- Presentation page (`/c/:id`) with a big stage: perfect for the projector.

## Tech

| Layer     | Choice                                             |
| --------- | -------------------------------------------------- |
| Front-end | Vite 8 + React 19 + TypeScript, plain CSS          |
| 3D        | three.js, @react-three/fiber, @react-three/drei    |
| Backend   | Supabase (Postgres + Auth + Row Level Security)    |
| Hosting   | Cloudflare Pages (static)                          |

## Run locally

```bash
npm install
npm run dev
```

Opens on <http://localhost:9090>. Without a `.env` file the game runs in **offline mode**:
everything works and characters are saved in the browser.

## Supabase setup (once)

1. Create a project at <https://supabase.com> (free plan).
2. Open **SQL Editor → New query**, paste the content of [`supabase/schema.sql`](supabase/schema.sql)
   and run it. It creates the tables (`classes`, `profiles`, `characters`), the trigger that
   creates a profile on sign-up and all the security policies.
3. **Authentication → Sign In / Providers**: enable **Anonymous sign-ins** (students join
   without an e-mail). Under **Email** you may turn off *Confirm email* so the teacher can sign
   in right after creating the account.
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key into a `.env`
   file (see `.env.example`):

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

5. Restart `npm run dev`. The **Teacher** page now offers *Create account*.

## Deploy on Cloudflare Pages

1. Push this repo to GitHub (`gusttavvin/create-your-character`).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the
   repo and use:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under
   **Settings → Environment variables** (Production and Preview), then redeploy.
4. `public/_redirects` already routes every path to `index.html` (single-page app).

Every push to `main` triggers a new deploy.

## Project structure

```
art-source/                  untouched originals of the pieces that were turned into mirrors
public/assets/monster/       kit PNGs (parts) + crops of the worksheet (ui)
src/games.ts                 the list the home page is built from
src/characters/monster/      config (words, phrases, layout), Monster2D, Monster3D
src/characters/dragon/       vector parts (SVG), config, Dragon2D, Dragon3D
src/characters/princess/     vector parts (SVG), config, Princess2D, Princess3D
src/characters/superhero/    vector parts (SVG), config, Superhero2D, Superhero3D
src/characters/fairy/        vector parts (SVG), config, Fairy2D, Fairy3D
src/components/              Builder (worksheet), Stage, cards, dialogs, 3D canvas
src/pages/                   Home, Builder, Gallery, Character (show), Teacher, Join
src/lib/                     auth, storage (local/cloud), speech, sounds, confetti, three helpers
supabase/schema.sql          database schema + RLS policies
```

## Adding a new part

1. Draw the part as a React SVG component (512×512 box, thick `#0B1B3B` outlines) in the
   character's `parts.tsx`, or drop a PNG in `public/assets/...`. Draw one side only for a pair
   and let the code mirror it.
2. Add an option `{ id, label, phrase, Svg | img }` to the category in `config.ts`.
   `phrase` is the English text read aloud and used in the sentence.
3. Optionally add a 3D variant in the character's `*3D.tsx`.

A whole new category also needs a drop zone, otherwise its pieces can only be dropped on the
sheet at large: add a rect to the `…Slots()` function exported from the character's `*2D.tsx`.
Coordinates are in that character's virtual canvas (600 × 720), and several rects may share one
category id, which is how the two arms and the two wings each get their own zone.

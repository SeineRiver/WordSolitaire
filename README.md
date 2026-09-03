# Solitaire Associations

Solitaire Associations is a mobile-first PWA word game inspired by solitaire. Players uncover category cards and word cards, group words from the same category, and move completed categories to the foundation area. The current UI is optimized for a narrow, portrait phone viewport and also works in a desktop browser.

## Run locally

Requirements:

- Node.js `>=22.13.0`
- npm

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server supports hot reload. Use `Ctrl+C` to stop it.

Useful commands:

```bash
npm run build   # production build; run this before publishing
npm run start   # serve the production build locally
npm run lint    # ESLint checks
```

## Project layout

```text
app/
  app/page.tsx          Main game state, rules, rendering, and interactions
  app/layout.tsx        Page metadata, PWA manifest, and stylesheet link
  public/game.css       Main visual styling (the app uses this static stylesheet)
  public/manifest.webmanifest
  public/sw.js          Network-first service worker
  content/categories.json Reusable category and word database
  content/levels.json   Level definitions and category references
  .openai/hosting.json  Sites project metadata (only needed for publishing)
```

`app/globals.css` is part of the framework scaffold, but the game’s effective styles live in `public/game.css`, linked from `app/layout.tsx`.

## Content data

Categories are reusable records. A category has a stable ID, a short display name, and its words:

```json
{
  "id": "primary-colors",
  "name": "Primary colors",
  "words": ["red", "blue", "yellow"]
}
```

Levels do not copy words. They reference category IDs:

```json
{
  "id": "level-001",
  "name": "First Steps",
  "difficulty": 1,
  "difficultyScore": 10,
  "categoryIds": ["primary-colors", "body-parts", "shapes", "weekdays"]
}
```

To add or edit content, change `content/categories.json` or `content/levels.json` in a text editor. Keep IDs stable after release: saved games and level references depend on them. If an ID must change, treat it as a migration and update every level and saved-data compatibility path.

Content invariants to check before running the app:

- Every category ID is unique.
- Every category name is at most two words and every category has a non-empty `words` array.
- Words are unique within a category; avoid duplicate card IDs.
- Every `categoryIds` entry refers to an existing category.
- Level IDs and difficulty values are unique and ordered as intended.

The level picker calculates each level’s card total as one category card plus every word card in its referenced categories.

## Game rules and current interaction model

- Each category contributes one category card and one card for every word.
- A deal places about half the deck into four tableau columns. The column counts are four consecutive numbers, from left to right; the rest goes into the stock pile.
- Tap the stock pile to reveal a card into the waste pile. The top waste card is selectable.
- Tap any face-up card in a tableau column to select the entire face-up substack beneath it.
- A word substack can move onto a face-up word from the same category, or into its matching category foundation.
- A selected open substack can move to an empty tableau column.
- A category card moves to one of four foundation placeholders. The category must be filled before that slot clears for another category.
- Completing a category shows a short celebration animation. Clearing the level shows a centered next-level/replay button.
- Hint and Undo are available in the header. Moves count every draw or move.

The current interaction is tap-to-select and tap-to-destination. This is intentional for touch reliability; drag-and-drop can be added later as an enhancement without removing tap controls.

## Local persistence

The game stores the current level and game state in browser `localStorage` under a versioned save key. The saved state includes the tableau, stock, waste, foundations, completed words, move count, and undo history. The loader normalizes incomplete older saves so future schema changes can remain backward-compatible.

When changing the save shape, either extend `normalizeGame()` in `app/page.tsx` or increment `SAVE_KEY` and provide a migration. Do not assume a saved array or object exists without validating it first.

## Continuing development

1. Edit `app/page.tsx` for game rules, state transitions, level selection, and accessible labels.
2. Edit `public/game.css` for layout, card proportions, typography, and animations.
3. Keep content changes in the JSON files rather than hard-coding words in the component.
4. Run `npm run build` after each meaningful change; run `npm run lint` before sharing a larger change.
5. Test on a narrow portrait viewport and refresh the page to verify persistence.

Potential next improvements include automated JSON validation, drag-and-drop with Pointer Events, richer hint logic, level-unlock progression, and more robust mobile accessibility testing.

## Publishing

This repository is configured as an OpenAI Sites project through `.openai/hosting.json`. Development should remain local unless a public deployment is explicitly requested. Before publishing, run `npm run build` and deploy the validated version through the project’s Sites workflow. The public site is:

<https://solitaire-associations-huy.seineriver544982.chatgpt.site>

Do not commit source credentials, local environment files, generated archives, or user save data.

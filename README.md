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
  npm run validate # validate categories and level recipes
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
  docs/visual-asset-style.md  Canonical style guide for custom image assets
  .openai/hosting.json  Sites project metadata (only needed for publishing)
```

`app/globals.css` is part of the framework scaffold, but the game’s effective styles live in `public/game.css`, linked from `app/layout.tsx`.

## Content data

Categories are reusable records. A category has a stable ID, a short display name, and its words:

```json
{
  "id": "primary-colors",
  "name": "Primary colors",
  "words": ["red", "blue", "yellow"],
  "visual": { "kind": "text" }
}
```

Categories use `visual.kind: "text"` by default; selected categories may use `icon`. Future `image` categories should follow the [visual asset style guide](docs/visual-asset-style.md) and provide a complete visual mapping for every word. If any mapping is missing, the whole category must fall back to text. Visual alt text is optional and should fall back to the category name or original word.

Themes are defined separately in `content/themes.json`. Each theme has a stable ID, semantic card colors, and card geometry tokens. The selected `themeId` is stored with local settings and applied through CSS variables, so adding a new theme does not require changing category or level data.

Levels store a generation recipe rather than fixed category IDs. At runtime, the game randomly selects unused categories whose word counts match the recipe:

```json
{
  "id": "level-001",
  "name": "First Links 1",
  "difficulty": 1,
  "difficultyScore": 10,
  "totalCards": 25,
  "categoryCount": 4,
  "wordCounts": [3, 3, 6, 9]
}
```

`totalCards` includes one category card per category. The invariant is `totalCards = categoryCount + sum(wordCounts)`. A new random deal can select different matching categories, making replay less predictable. The generated category IDs are saved inside the current game state so refreshes restore the exact in-progress deal.

To add or edit content, change `content/categories.json` or `content/levels.json` in a text editor. Keep IDs stable after release: saved games and level references depend on them. If an ID must change, treat it as a migration and update every level and saved-data compatibility path.

Content invariants to check before running the app:

- Every category ID is unique.
- Every category name is at most two words and every category has a non-empty `words` array.
- Words are unique within a category; avoid duplicate card IDs.
- Every level has `wordCounts.length === categoryCount` and its card-total formula is correct.
- Each requested word-count frequency is supported by enough categories in the category database.
- Level IDs and difficulty values are unique and ordered as intended.

The level picker calculates each level’s card total as one category card plus every word card in its referenced categories.

The 100-level recipe set is generated with varied category sizes. It allows at most two 3-word categories and three 4-word categories per level, while keeping totals between 25 and 75 cards and category counts between 4 and 12. To regenerate the set after changing the design, run `node scripts/regenerate-levels.mjs`, then `npm run validate`.

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

# Visual Asset Style Guide

This is the canonical style guide for custom image assets used on cards. New category sets should follow it so the game feels like one cohesive illustrated deck.

## Art direction

- **Style:** friendly, modern flat vector illustration with a small amount of soft shading.
- **Mood:** warm, curious, playful, and calm; suitable for an all-ages puzzle game.
- **Silhouette:** one instantly recognizable subject, centered and facing a useful angle.
- **Detail:** simplify rather than add detail. The image must remain identifiable when displayed at roughly half a card width.
- **Line work:** clean rounded outlines, medium weight, with no sketchiness or photographic texture.
- **Composition:** one object per asset; no scenery, labels, captions, borders, badges, or decorative text inside the image.
- **Background:** transparent. Do not bake a card background into the asset.

## Technical specification

- Square canvas: **512 × 512 px** source, exported as optimized SVG where practical or WebP for painterly/raster work.
- Keep the subject inside a centered **safe area of 384 × 384 px** (75% of the canvas), leaving comfortable transparent padding.
- Use sRGB color and preserve transparency.
- Avoid very thin lines, tiny highlights, and low-contrast details that disappear on a phone.
- Target an individual asset size below 50 KB for SVG or below 100 KB for WebP when possible.

## Color and consistency

Use a restrained palette shared across categories:

- Deep green: `#174335`
- Ink green: `#243B32`
- Warm gold: `#D8B653`
- Cream: `#FFF9E9`
- Plum accent: `#72539B`
- Coral accent: `#C96258`

Colors may vary to make an object recognizable, but avoid neon colors, pure black outlines, and heavy gradients. Use the same outline and shading treatment across every asset in a category.

## File and data conventions

Use lowercase kebab-case names matching the category word:

```text
public/assets/categories/<category-id>/<word>.svg
```

Example:

```text
public/assets/categories/gemstones/ruby.svg
public/assets/categories/gemstones/sapphire.svg
```

The category record references the complete set:

```json
{
  "visual": { "kind": "image", "key": "gemstones" },
  "wordImages": {
    "ruby": "/assets/categories/gemstones/ruby.svg",
    "sapphire": "/assets/categories/gemstones/sapphire.svg"
  }
}
```

The renderer must keep the all-or-nothing rule: if the category image key is unknown or any word is missing an image, render every card in that category as its original text. Alt text remains the original word (or category name), even when an image is present.

## Generation prompt template

Use this as the base prompt for new assets:

> Create a single centered [SUBJECT] for a mobile puzzle-card game. Friendly modern flat vector illustration, clean rounded medium-weight outline, restrained warm palette, subtle soft shading, clear silhouette, transparent background, square 512x512 canvas, subject contained within the central 75% safe area, no text, no labels, no border, no scenery, no extra objects. Match the established Solitaire Associations visual asset style.

For a category, generate every word in one batch or with the same style reference. Do not mix photographs, 3D renders, and flat illustrations within one category.

## QA checklist

Before enabling an image category:

1. Every word has an image file and a `wordImages` entry.
2. Every file opens, has transparency, and uses the expected square dimensions.
3. The subject is recognizable at small card size and has no embedded text.
4. All assets in the category share the same style, outline, and visual weight.
5. The category still has a meaningful text fallback and accessible alt text.
6. Record the source and license in the asset manifest. Generated assets should be marked `original`.


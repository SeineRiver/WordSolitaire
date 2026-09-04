import fs from 'node:fs';

const categories = JSON.parse(fs.readFileSync(new URL('../content/categories.json', import.meta.url)));
const levels = JSON.parse(fs.readFileSync(new URL('../content/levels.json', import.meta.url)));
const fail = (message) => { throw new Error(message); };

const categoryIds = new Set();
const availableByWordCount = new Map();
for (const category of categories.categories) {
  if (!category.id || categoryIds.has(category.id)) fail(`Duplicate or missing category ID: ${category.id}`);
  if (!Array.isArray(category.words) || category.words.length === 0) fail(`Category has no words: ${category.id}`);
  if (new Set(category.words).size !== category.words.length) fail(`Duplicate words: ${category.id}`);
  categoryIds.add(category.id);
  availableByWordCount.set(category.words.length, (availableByWordCount.get(category.words.length) ?? 0) + 1);
}

const levelIds = new Set();
let previousCards = 0;
let previousCategories = 0;
for (const level of levels.levels) {
  if (!level.id || levelIds.has(level.id)) fail(`Duplicate or missing level ID: ${level.id}`);
  if (!Number.isInteger(level.categoryCount) || level.categoryCount < 4 || level.categoryCount > 12) fail(`Invalid category count: ${level.id}`);
  if (!Array.isArray(level.wordCounts) || level.wordCounts.length !== level.categoryCount) fail(`Invalid wordCounts: ${level.id}`);
  const total = level.categoryCount + level.wordCounts.reduce((sum, count) => sum + count, 0);
  if (total !== level.totalCards || level.totalCards < 25 || level.totalCards > 75) fail(`Invalid totalCards: ${level.id}`);
  const requested = new Map();
  for (const count of level.wordCounts) requested.set(count, (requested.get(count) ?? 0) + 1);
  for (const [count, needed] of requested) if (needed > (availableByWordCount.get(count) ?? 0)) fail(`Not enough ${count}-word categories for ${level.id}`);
  if (level.totalCards < previousCards || level.categoryCount < previousCategories) fail(`Progression decreases at ${level.id}`);
  previousCards = level.totalCards; previousCategories = level.categoryCount; levelIds.add(level.id);
}

console.log(`Content valid: ${categoryIds.size} categories, ${levelIds.size} levels.`);

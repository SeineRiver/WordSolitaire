import fs from 'node:fs';

const { categories } = JSON.parse(fs.readFileSync(new URL('../content/categories.json', import.meta.url)));
const glyphs = { palette: '🎨', shapes: '◈', seasons: '🍃', directions: '🧭', 'card-suits': '🃏', 'five-senses': '🧍', 'farm-animals': '🏡', weather: '🌦️', 'musical-instruments': '🎶', 'body-parts': '🫀', breakfast: '🍽️', sports: '🏅', drinks: '🥤' };
const visualCategories = categories.filter((c) => c.visual?.kind === 'image' || c.visual?.kind === 'icon');

function esc(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function card(category, word, type) {
  const isImage = category.visual.kind === 'image';
  const value = type === 'category' ? category.categoryImage : category.wordImages?.[word];
  const imagePath = value?.replace(/^\//, './');
  const visual = isImage ? `<img class="card-image" src="${esc(imagePath)}" alt="">` : `<span class="preview-glyph">${esc(category.wordVisuals?.[word] ?? glyphs[category.visual.key] ?? '')}</span>`;
  return `<div class="preview-card word-card ${type} uncovered full ${isImage ? 'image' : 'icon'}"><span class="card-content"><span class="category-label">${esc(type === 'category' ? category.name : word)}</span>${visual}</span></div>`;
}
const groups = visualCategories.map((category) => `<section class="preview-group"><h2>${esc(category.name)} <small>${category.visual.kind}</small></h2><div class="preview-cards">${card(category, '', 'category')}${category.words.map((word) => card(category, word, 'word')).join('')}</div></section>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Card Preview</title><link rel="stylesheet" href="/game.css"><style>.preview-canvas{width:min(1200px,100%);max-width:none;min-height:100vh;padding:24px;display:block}.preview-title{margin:0 0 24px;font-size:28px}.preview-group{margin:0 0 28px}.preview-group h2{margin:0 0 10px;font-size:20px}.preview-group h2 small{font-size:12px;opacity:.7;text-transform:uppercase}.preview-cards{display:flex;flex-wrap:wrap;gap:12px}.preview-card{position:relative!important;left:auto!important;top:auto!important;width:110px!important;height:147px!important;flex:0 0 110px;padding:8px!important}.preview-card .card-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;height:100%}.preview-card .category-label{font-size:13px}.preview-card .card-image{width:50%;height:50%;object-fit:contain}.preview-glyph{font-size:44px;line-height:1}.preview-card.category .category-label{font-weight:700}@media(max-width:600px){.preview-canvas{padding:16px}.preview-card{width:92px!important;height:123px!important;flex-basis:92px}.preview-glyph{font-size:36px}}</style></head><body><main class="game-canvas theme-default preview-canvas"><h1 class="preview-title">Visual Card Preview</h1>${groups}</main></body></html>`;
fs.writeFileSync(new URL('../public/visual-preview.html', import.meta.url), html);
console.log(`Generated ${visualCategories.length} categories and ${visualCategories.reduce((n, c) => n + c.words.length + 1, 0)} cards.`);

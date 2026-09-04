'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import categoryData from '../content/categories.json';
import levelData from '../content/levels.json';
import themeData from '../content/themes.json';

type Category = { id: string; name: string; words: string[]; visual?: { kind?: string; key?: string }; wordVisuals?: Record<string, string>; wordImages?: Record<string, string>; categoryImage?: string };
type Card = { id: string; type: 'word' | 'category'; label: string; categoryId: string; faceUp: boolean };
type Source = number | 'waste';
type Move = { kind: 'stack' | 'foundation' | 'draw' | 'redeal'; from: Source | 'stock'; fromIndex?: number; to?: number; cards: Card[] };
type Level = { id: string; name: string; difficulty: number; difficultyScore: number; totalCards: number; categoryCount: number; wordCounts: number[]; cardCount: number };
type GameState = { categoryIds: string[]; tableau: Card[][]; stock: Card[]; waste: Card[]; foundations: (string | null)[]; completed: Record<string, string[]>; moves: number; history: Move[] };
type Settings = { themeId: string; reducedMotion: boolean; showStockCount: boolean; allowCategoryStack: boolean };
type HintArrow = { from: { x: number; y: number }; to: { x: number; y: number } };
type Theme = { id: string; name: string; colors: Record<string, string>; cards: { borderWidth: number; borderRadius: number; shadow: string } };

const categories = new Map((categoryData.categories as Category[]).map((category) => [category.id, category]));
const themes = themeData.themes as Theme[];
const themeMap = new Map(themes.map((theme) => [theme.id, theme]));
const iconGlyphs: Record<string, string> = {
  palette: '🎨',
  shapes: '◈',
  seasons: '🌍',
  directions: '🧭',
  'card-suits': '🃏',
  'five-senses': '👁️',
  'farm-animals': '🐄',
  weather: '🌦️',
  'musical-instruments': '🎶',
  'body-parts': '🫀',
  breakfast: '🍽️',
  sports: '🏅',
  drinks: '🥤',
  'rainbow-colors': '🌈',
};
const levels = levelData.levels.map((item) => ({ ...item, categoryCount: item.categoryCount, cardCount: item.totalCards })) as Level[];
const SAVE_KEY = 'solitaire-associations.save-v6';
const SETTINGS_KEY = 'solitaire-associations.settings-v1';
const DEFAULT_SETTINGS: Settings & { themeId: string } = { themeId: 'default', reducedMotion: false, showStockCount: true, allowCategoryStack: true };

function validateLevels() {
  const available = new Map<number, number>();
  for (const category of categories.values()) available.set(category.words.length, (available.get(category.words.length) ?? 0) + 1);
  const ids = new Set<string>();
  for (const level of levels) {
    if (ids.has(level.id) || level.wordCounts.length !== level.categoryCount || level.categoryCount < 4 || level.categoryCount > 12) throw new Error(`Invalid level recipe: ${level.id}`);
    ids.add(level.id);
    const total = level.categoryCount + level.wordCounts.reduce((sum, count) => sum + count, 0);
    if (total !== level.totalCards || level.totalCards < 25 || level.totalCards > 75) throw new Error(`Invalid card total: ${level.id}`);
    const requested = new Map<number, number>();
    for (const count of level.wordCounts) requested.set(count, (requested.get(count) ?? 0) + 1);
    for (const [count, needed] of requested) if (needed > (available.get(count) ?? 0)) throw new Error(`Not enough ${count}-word categories for ${level.id}`);
  }
}
validateLevels();

function categoryVisualReady(category: Category) {
  if (category.visual?.kind === 'icon') return Boolean(category.visual.key && iconGlyphs[category.visual.key]) && category.words.every((word) => Boolean(category.wordVisuals?.[word]));
  if (category.visual?.kind === 'image') return Boolean(category.visual.key && category.categoryImage) && category.words.every((word) => Boolean(category.wordImages?.[word]));
  return false;
}

function cardVisual(categoryId: string, label: string, type: Card['type']) {
  const category = categories.get(categoryId);
  if (!category || !categoryVisualReady(category)) return { kind: 'text', value: label, alt: label };
  if (category.visual!.kind === 'image') return { kind: 'image', value: type === 'category' ? category.categoryImage! : category.wordImages![label], alt: type === 'category' ? category.name : label };
  if (type === 'category') return { kind: 'icon', value: iconGlyphs[category.visual!.key!], alt: category.name };
  return { kind: 'icon', value: category.wordVisuals![label], alt: label };
}

function labelSizeClass(label: string) {
  return label.length <= 5 ? 'word-short' : label.length <= 7 ? 'word-medium' : '';
}

function renderVisual(visual: { kind: string; value: string }, label?: string, showImage = true) {
  if (visual.kind !== 'image') return visual.value;
  if (label && !showImage) return label;
  return <>{label && <span className="category-label">{label}</span>}<img className="card-image" src={visual.value} alt="" draggable={false} /></>;
}

function renderCategoryVisual(visual: { kind: string; value: string }, label: string, partial = false) {
  if (partial) return <span className="category-label">{label}</span>;
  if (visual.kind === 'image') return <><span className="category-label">{label}</span><img className="card-image" src={visual.value} alt="" draggable={false} /></>;
  if (visual.kind === 'icon') return <><span className="category-label">{label}</span><span className="category-glyph" aria-hidden="true">{visual.value}</span></>;
  return label;
}

function shuffled<T>(items: T[], seed: number) {
  const copy = [...items]; let state = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const next = state % (index + 1);
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function resolveCategoryIds(seed: number, level: Level) {
  const used = new Set<string>();
  return level.wordCounts.map((wordCount, index) => {
    const candidates = shuffled([...categories.values()].filter((category) => category.words.length === wordCount && !used.has(category.id)), seed + index * 7919);
    const selected = candidates[0];
    if (!selected) throw new Error(`Unable to resolve category recipe for ${level.id}`);
    used.add(selected.id);
    return selected.id;
  });
}

function makeGame(seed = 101, level = levels[0]): GameState {
  const categoryIds = resolveCategoryIds(seed, level);
  const activeCategories = categoryIds.map((id) => categories.get(id)!);
  const deck: Card[] = activeCategories.flatMap((category) => [
    { id: `category:${category.id}`, type: 'category' as const, label: category.name, categoryId: category.id, faceUp: false },
    ...category.words.map((word) => ({ id: `word:${category.id}:${word}`, type: 'word' as const, label: word, categoryId: category.id, faceUp: false })),
  ]);
  const shuffledDeck = shuffled(deck, seed);
  const targetDeal = Math.round(shuffledDeck.length / 2);
  const starts = Array.from({ length: Math.max(1, Math.floor((shuffledDeck.length - 6) / 4) + 1) }, (_, index) => index);
  const firstColumnCount = starts.reduce((best, candidate) => Math.abs((4 * candidate) + 6 - targetDeal) < Math.abs((4 * best) + 6 - targetDeal) ? candidate : best, 0);
  const tableau = Array.from({ length: 4 }, (_, index) => shuffledDeck.splice(0, firstColumnCount + index));
  tableau.forEach((column) => {
    const top = column.at(-1);
    if (top) top.faceUp = true;
  });
  return { categoryIds, tableau, stock: shuffledDeck, waste: [], foundations: Array(4).fill(null), completed: Object.fromEntries(activeCategories.map((category) => [category.id, []])), moves: 0, history: [] };
}

function revealTop(column: Card[]) {
  return column.map((card, index) => index === column.length - 1 ? { ...card, faceUp: true } : card);
}

function restoreToColumn(column: Card[], cards: Card[], fromIndex = column.length) {
  const prefix = column.slice(0, fromIndex).map((card, index, source) => index === source.length - 1 ? { ...card, faceUp: false } : card);
  return [...prefix, ...cards.map((card) => ({ ...card, faceUp: true }))];
}

function normalizeGame(candidate: Partial<GameState>, level = levels[0]): GameState {
  const categoryIds = Array.isArray(candidate.categoryIds) && candidate.categoryIds.length === level.categoryCount && candidate.categoryIds.every((id, index) => categories.has(id) && categories.get(id)!.words.length === level.wordCounts[index]) ? candidate.categoryIds : resolveCategoryIds(101, level);
  const activeCategories = categoryIds.map((id) => categories.get(id)!);
  const fresh = makeGame(101, level);
  const tableau = Array.isArray(candidate.tableau) ? candidate.tableau.map((column) => Array.isArray(column) ? column.map((card, index) => ({ ...card, faceUp: card.faceUp ?? index === column.length - 1 })) : []) : fresh.tableau;
  return {
    ...fresh,
    ...candidate,
    categoryIds,
    tableau,
    stock: Array.isArray(candidate.stock) ? candidate.stock : fresh.stock,
    waste: Array.isArray(candidate.waste) ? candidate.waste : [],
    foundations: Array.from({ length: 4 }, (_, index) => {
      const foundationId = Array.isArray(candidate.foundations) ? candidate.foundations[index] : null;
      return typeof foundationId === 'string' && categoryIds.includes(foundationId) ? foundationId : null;
    }),
    completed: Object.fromEntries(activeCategories.map((category) => [category.id, Array.isArray(candidate.completed?.[category.id]) ? candidate.completed[category.id] : []])),
    history: Array.isArray(candidate.history) ? candidate.history : [],
  } as GameState;
}

export default function Home() {
  const [level, setLevel] = useState(() => levels[0]);
  const [game, setGame] = useState<GameState>(() => makeGame(101, levels[0]));
  const [selectedColumn, setSelectedColumn] = useState<Source | null>(null);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [celebratingSlot, setCelebratingSlot] = useState<number | null>(null);
  const [celebratingCategory, setCelebratingCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('Move an uncovered category card to an empty foundation.');
  const [flash, setFlash] = useState<string | null>(null);
  const [saveReady, setSaveReady] = useState(false);
  const canvasRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [hintArrow, setHintArrow] = useState<HintArrow | null>(null);
  const theme = themeMap.get(settings.themeId) ?? themes[0];
  const remaining = useMemo(() => game.tableau.reduce((total, column) => total + column.length, 0) + game.stock.length + game.waste.length, [game.tableau, game.stock, game.waste]);
  const selectedCards = selectedColumn === null ? [] : selectedColumn === 'waste' ? game.waste.slice(-1) : game.tableau[selectedColumn].slice(selectedStart ?? game.tableau[selectedColumn].length - 1);
  const selected = selectedCards[0] ?? null;
  const isComplete = remaining === 0;

  function wrongCategory(text = 'Wrong category') {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 900);
  }

  function showHintArrow(sourceKey: string, destinationKey: string) {
    window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const source = cardRefs.current[sourceKey];
      const destination = cardRefs.current[destinationKey];
      if (!canvas || !source || !destination) return;
      const canvasRect = canvas.getBoundingClientRect();
      const center = (element: HTMLElement) => { const rect = element.getBoundingClientRect(); return { x: rect.left - canvasRect.left + rect.width / 2, y: rect.top - canvasRect.top + rect.height / 2 }; };
      setHintArrow({ from: center(source), to: center(destination) });
      window.setTimeout(() => setHintArrow(null), 1100);
    });
  }

  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') setSettings({ ...DEFAULT_SETTINGS, ...saved, themeId: typeof saved.themeId === 'string' && themeMap.has(saved.themeId) ? saved.themeId : DEFAULT_SETTINGS.themeId });
    } catch { /* Use defaults when settings cannot be read. */ }
  }, []);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      const savedLevel = levels.find((item) => item.id === saved?.levelId);
      if (saved?.schemaVersion === 5 && savedLevel && saved?.game) { setLevel(savedLevel); setGame(normalizeGame(saved.game, savedLevel)); }
    } catch { /* Start a fresh game when an old save cannot be read. */ }
    setSaveReady(true);
  }, []);
  useEffect(() => { if (saveReady) localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 5, levelId: level.id, updatedAt: new Date().toISOString(), game })); }, [game, level, saveReady]);

  function select(source: Source, cardIndex?: number) {
    const column = source === 'waste' ? null : game.tableau[source];
    const index = source === 'waste' ? undefined : cardIndex;
    const card = source === 'waste' ? game.waste.at(-1) : column?.[index ?? column.length - 1];
    if (!card || isComplete) return;
    const stackStart = source === 'waste' ? null : card.type === 'category' ? (index ?? column!.length - 1) : column!.findIndex((item) => item.faceUp);
    if (selectedColumn === source) { setSelectedColumn(null); setSelectedStart(null); setMessage('Card selection cleared.'); return; }
    if (selectedCards.length > 0 && source !== selectedColumn && card.type === 'category') {
      const sameCategory = selectedCards.every((item) => item.categoryId === card.categoryId);
      setMessage(sameCategory && selectedCards.every((item) => item.type === 'word') ? 'Not allowed' : 'Wrong category');
      wrongCategory(sameCategory && selectedCards.every((item) => item.type === 'word') ? 'Not allowed' : 'Wrong category');
      return;
    }
    if (selectedCards.length > 0 && source !== selectedColumn && card.type === 'word' && (selectedCards.some((item) => item.categoryId !== card.categoryId) || selectedCards.some((item) => item.type !== 'word') && selectedCards.length > 1)) { setMessage('Wrong category'); wrongCategory(); return; }
    if (selectedCards.length === 1 && selectedCards[0].type === 'category' && card.type === 'word' && selectedCards[0].categoryId === card.categoryId && !settings.allowCategoryStack) { setMessage('Not allowed'); wrongCategory('Not allowed'); return; }
    const canStackSelected = selectedCards.length > 0 && (selectedCards.every((item) => item.type === 'word') || (settings.allowCategoryStack && selectedCards.length === 1 && selectedCards[0].type === 'category'));
    if (canStackSelected && card.type === 'word' && selectedCards[0].categoryId === card.categoryId && source !== selectedColumn && source !== 'waste') { stackWord(source); return; }
    setSelectedColumn(source); setSelectedStart(stackStart); setMessage(`“${card.label}” and every open card in this stack selected.`);
  }

  function stackWord(destination: number) {
    if (selectedColumn === null || selectedCards.length === 0 || (selectedCards.some((card) => card.type !== 'word') && !(selectedCards.length === 1 && selectedCards[0].type === 'category')) || destination === selectedColumn) return;
    const target = game.tableau[destination].at(-1);
    if (!target || target.type !== 'word' || target.categoryId !== selectedCards[0].categoryId) { setMessage('Words may only stack on a word from the same category.'); wrongCategory(); return; }
    const cards = selectedCards;
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === destination ? [...column, ...cards.map((card) => ({ ...card, faceUp: true }))] : index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
      waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
      moves: current.moves + 1, history: [...current.history, { kind: 'stack', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: destination, cards }],
    }));
    setSelectedColumn(null); setSelectedStart(null); setMessage(selectedCards[0].type === 'category' ? 'Category card stacked on its matching word.' : 'Matched cards stacked together — a new card is uncovered.');
  }

  function moveToEmptyColumn(destination: number) {
    if (selectedColumn === null || selectedCards.length === 0 || game.tableau[destination].length > 0 || destination === selectedColumn) return;
    const cards = selectedCards;
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === destination ? cards.map((card) => ({ ...card, faceUp: true })) : index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
      waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
      moves: current.moves + 1, history: [...current.history, { kind: 'stack', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: destination, cards }],
    }));
    setSelectedColumn(null); setSelectedStart(null); setMessage('The open substack moved to the empty column.');
  }

  function moveToFoundation(slot: number) {
    if (selectedColumn === null || !selected) { setMessage('Choose an uncovered card first.'); return; }
    const foundation = game.foundations[slot];
    if (selected.type === 'category') {
      if (selectedCards.length !== 1) { setMessage('Move the category card by itself to its foundation.'); return; }
      if (foundation) { setMessage('That foundation already holds a category card.'); wrongCategory(); return; }
      if (game.foundations.includes(selected.categoryId)) { setMessage('That category has already been placed.'); return; }
      setGame((current) => ({ ...current,
        tableau: current.tableau.map((column, index) => index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
        waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
        foundations: current.foundations.map((id, index) => index === slot ? selected.categoryId : id), moves: current.moves + 1, history: [...current.history, { kind: 'foundation', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: slot, cards: selectedCards }],
      }));
      setSelectedColumn(null); setSelectedStart(null); setMessage(`${selected.label} is ready to receive matching words.`); return;
    }
    if (selectedCards.some((card) => card.type !== 'word' || card.categoryId !== selected.categoryId) || foundation !== selected.categoryId) { setMessage('These cards need their matching category foundation first.'); wrongCategory(); return; }
    const categoryComplete = currentCompletedCount(selected.categoryId) + selectedCards.length >= categories.get(selected.categoryId)!.words.length;
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
      waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
      foundations: categoryComplete ? current.foundations.map((id, index) => index === slot ? null : id) : current.foundations,
      completed: { ...current.completed, [selected.categoryId]: [...current.completed[selected.categoryId], ...selectedCards.map((card) => card.label)] }, moves: current.moves + 1, history: [...current.history, { kind: 'foundation', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: slot, cards: selectedCards }],
    }));
    setSelectedColumn(null); setSelectedStart(null);
    if (categoryComplete) { setCelebratingSlot(slot); setCelebratingCategory(selected.categoryId); window.setTimeout(() => { setCelebratingSlot(null); setCelebratingCategory(null); }, 1100); }
    setMessage(categoryComplete ? `${categories.get(foundation)!.name} is complete!` : `${selectedCards.length} matching cards added to ${categories.get(foundation)!.name}.`);
  }

  function drawCard() {
    const next = game.stock.at(-1);
    if (!next) { setMessage('The draw pile is empty.'); return; }
    setGame((current) => ({ ...current, stock: current.stock.slice(0, -1), waste: [...current.waste, { ...next, faceUp: true }], moves: current.moves + 1, history: [...current.history, { kind: 'draw', from: 'stock', cards: [next] }] }));
    setSelectedColumn(null); setSelectedStart(null); setMessage(`“${next.label}” is open. Move it when you can, or draw the next card.`);
  }

  function redeal() {
    if (game.stock.length > 0 || game.waste.length === 0 || isComplete) return;
    const cards = game.waste;
    setGame((current) => ({ ...current, stock: [...cards].reverse().map((card) => ({ ...card, faceUp: false })), waste: [], moves: current.moves + 1, history: [...current.history, { kind: 'redeal', from: 'stock', cards }] }));
    setSelectedColumn(null); setSelectedStart(null); setMessage('Waste pile redealt into the stock.');
  }

  function undo() {
    const latest = game.history.at(-1);
    if (!latest) { setMessage('There is no move to undo yet.'); return; }
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === latest.from ? restoreToColumn(column, latest.cards, latest.fromIndex) : latest.kind === 'stack' && index === latest.to ? column.slice(0, -latest.cards.length) : column),
      stock: latest.kind === 'draw' ? [...current.stock, ...latest.cards.map((card) => ({ ...card, faceUp: false }))] : latest.kind === 'redeal' ? [] : current.stock,
      waste: latest.kind === 'draw' ? current.waste.slice(0, -latest.cards.length) : latest.kind === 'redeal' ? latest.cards : latest.from === 'waste' ? [...current.waste, ...latest.cards.map((card) => ({ ...card, faceUp: true }))] : current.waste,
      foundations: latest.kind === 'foundation' ? latest.cards[0].type === 'category' ? current.foundations.map((id, index) => index === latest.to ? null : id) : current.foundations.map((id, index) => index === latest.to && id === null ? latest.cards[0].categoryId : id) : current.foundations,
      completed: latest.kind === 'foundation' && latest.cards[0].type === 'word' ? { ...current.completed, [latest.cards[0].categoryId]: current.completed[latest.cards[0].categoryId].slice(0, -latest.cards.length) } : current.completed,
      moves: Math.max(0, current.moves - 1), history: current.history.slice(0, -1),
    }));
    setSelectedColumn(null); setSelectedStart(null); setMessage('Last move undone.');
  }

  function hint() {
    if (isComplete) return;
    setGame((current) => ({ ...current, moves: current.moves + 1 }));
    const wasteCard = game.waste.at(-1);
    if (wasteCard) {
      if (wasteCard.type === 'category' && game.foundations.some((id) => id === null)) { const slot = game.foundations.findIndex((id) => id === null); setSelectedColumn('waste'); setMessage('Hint: move this category card to an empty foundation.'); showHintArrow(wasteCard.id, `foundation-${slot}`); return; }
      if (wasteCard.type === 'word' && game.foundations.includes(wasteCard.categoryId)) { const slot = game.foundations.findIndex((id) => id === wasteCard.categoryId); setSelectedColumn('waste'); setMessage(`Hint: “${wasteCard.label}” can move to its category foundation.`); showHintArrow(wasteCard.id, `foundation-${slot}`); return; }
    }
    const categoryColumn = game.tableau.findIndex((column) => column.at(-1)?.type === 'category');
    if (categoryColumn !== -1 && game.foundations.some((id) => id === null)) { const slot = game.foundations.findIndex((id) => id === null); setSelectedColumn(categoryColumn); setMessage('Hint: move this category card to an empty foundation.'); showHintArrow(game.tableau[categoryColumn].at(-1)!.id, `foundation-${slot}`); return; }
    const wordColumn = game.tableau.findIndex((column) => { const card = column.at(-1); return card?.type === 'word' && game.foundations.includes(card.categoryId); });
    if (wordColumn !== -1) { const card = game.tableau[wordColumn].at(-1)!; const slot = game.foundations.findIndex((id) => id === card.categoryId); setSelectedColumn(wordColumn); setMessage(`Hint: “${card.label}” can move to its category foundation.`); showHintArrow(card.id, `foundation-${slot}`); return; }
    for (let from = 0; from < game.tableau.length; from += 1) {
      const source = game.tableau[from].at(-1);
      if (!source || source.type !== 'word') continue;
      const destination = game.tableau.find((column, index) => index !== from && column.at(-1)?.type === 'word' && column.at(-1)!.categoryId === source.categoryId);
      if (destination) { const destinationCard = destination.at(-1)!; setSelectedColumn(from); setMessage(`Hint: stack “${source.label}” with its matching category.`); showHintArrow(source.id, destinationCard.id); return; }
    }
    setMessage('Hint: look for two uncovered words that belong together and stack one on the other.');
  }

  function restart() { setGame(makeGame(Date.now(), level)); setSelectedColumn(null); setSelectedStart(null); setMessage('New deal: uncover a category card or match two related words.'); }

  function currentCompletedCount(categoryId: string) {
    return game.completed[categoryId]?.length ?? 0;
  }

  function chooseLevel(nextLevel: typeof levels[number]) {
    setLevel(nextLevel); setGame(makeGame(Date.now(), nextLevel)); setSelectedColumn(null); setSelectedStart(null); setCelebratingSlot(null); setCelebratingCategory(null); setShowLevels(false); setMessage(`Level ${nextLevel.difficulty} ready.`);
  }

  function goToNextLevel() {
    const currentIndex = levels.findIndex((item) => item.id === level.id);
    chooseLevel(levels[currentIndex + 1] ?? levels[0]);
  }

  return <main className="app-shell"><section ref={canvasRef} className={`game-canvas theme-${theme.id} ${settings.reducedMotion ? 'reduced-motion' : ''}`} aria-label="Solitaire Associations game board">
    <header className="topbar"><button className="level-select top-level" onClick={() => setShowLevels((open) => !open)} aria-expanded={showLevels}>Level {level.difficulty} - {level.cardCount} cards</button><div className="topbar-right"><button className="top-action icon-action" onClick={hint} disabled={isComplete} aria-label="Hint" title="Hint"><span aria-hidden="true">💡</span></button><button className="top-action icon-action" onClick={undo} disabled={game.history.length === 0} aria-label="Undo" title="Undo"><span aria-hidden="true">↶</span></button><button className="restart icon-action" onClick={restart} aria-label="Restart level" title="Restart"><span aria-hidden="true">↻</span></button><button className="top-action icon-action settings-action" onClick={() => setShowSettings((open) => !open)} aria-expanded={showSettings} aria-label="Settings" title="Settings"><span aria-hidden="true">⚙︎</span></button></div></header>
    {flash && <div className="flash-message" role="alert">{flash}</div>}
    {hintArrow && <svg className="hint-arrow-overlay" viewBox={`0 0 ${canvasRef.current?.clientWidth ?? 1} ${canvasRef.current?.clientHeight ?? 1}`} aria-hidden="true"><defs><marker id="hint-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs><path className="hint-arrow-path" d={`M ${hintArrow.from.x} ${hintArrow.from.y} Q ${(hintArrow.from.x + hintArrow.to.x) / 2 + 30} ${(hintArrow.from.y + hintArrow.to.y) / 2 - 35} ${hintArrow.to.x} ${hintArrow.to.y}`} markerEnd="url(#hint-arrowhead)" /></svg>}
    {showSettings && <section className="settings-panel" aria-label="Game settings"><div className="settings-heading"><strong>Settings</strong><button onClick={() => setShowSettings(false)} aria-label="Close settings">×</button></div><label><span>Theme</span><select value={settings.themeId} onChange={(event) => setSettings((current) => ({ ...current, themeId: event.target.value }))}>{themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Reduced motion</span><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings((current) => ({ ...current, reducedMotion: event.target.checked }))} /></label><label><span>Show stock count</span><input type="checkbox" checked={settings.showStockCount} onChange={(event) => setSettings((current) => ({ ...current, showStockCount: event.target.checked }))} /></label><label><span>Allow category stacking</span><input type="checkbox" checked={settings.allowCategoryStack} onChange={(event) => setSettings((current) => ({ ...current, allowCategoryStack: event.target.checked }))} /></label></section>}
    {showLevels && <section className="level-menu" aria-label="Choose level">{levels.map((item) => <button className={item.id === level.id ? 'current' : ''} key={item.id} onClick={() => chooseLevel(item)}><span>Level {item.difficulty}</span><small>{item.cardCount} cards · {item.categoryCount} categories</small></button>)}</section>}
    {isComplete && <section className="level-complete" aria-live="polite"><span className="complete-sparkle">✦</span><div><strong>Level Cleared!</strong><small>All {level.categoryCount} categories are complete · {game.moves} moves</small></div><span className="complete-sparkle">✦</span></section>}
    {isComplete && <button className="next-level-button" onClick={goToNextLevel}>{levels.findIndex((item) => item.id === level.id) === levels.length - 1 ? <>Replay<br />Level 1</> : <>Next<br />Level</>}</button>}
    <section className="stock-row" aria-label="Draw pile">
      <div className="stock-moves"><span>Moves</span><strong>{game.moves}</strong></div>
      {game.waste.at(-1) ? (() => { const card = game.waste.at(-1)!; const visual = cardVisual(card.categoryId, card.label, card.type); return <button ref={(element) => { cardRefs.current[card.id] = element; }} data-card-id={card.id} className={`waste-card ${card.type} ${visual.kind} ${labelSizeClass(card.label)} ${selectedColumn === 'waste' ? 'selected' : ''}`} onClick={() => select('waste')} disabled={isComplete} aria-label={visual.alt}><span className="card-content">{card.type === 'category' ? renderCategoryVisual(visual, card.label) : renderVisual(visual)}</span></button>; })() : <div className="waste-empty">Open a card</div>}
      <button className={`stock-card ${!game.stock.length && game.waste.length ? 'redeal-card' : ''}`} onClick={!game.stock.length && game.waste.length ? redeal : drawCard} disabled={isComplete || (!game.stock.length && !game.waste.length)} aria-label={!game.stock.length && game.waste.length ? 'Redeal waste pile' : 'Open next card'}>{!game.stock.length && game.waste.length ? <span className="redeal-label">Redeal</span> : settings.showStockCount && <span>{game.stock.length}</span>}</button>
    </section>
    <section className="foundation-row" aria-label="Category foundations">{game.foundations.map((categoryId, index) => { const category = categoryId ? categories.get(categoryId) ?? null : null; const completedWords = category ? game.completed[category.id] ?? [] : []; const latestWord = completedWords.at(-1); const latestWordClass = latestWord ? labelSizeClass(latestWord) : ''; const categoryVisual = category ? cardVisual(category.id, category.name, 'category') : null; const wordVisual = category && latestWord ? cardVisual(category.id, latestWord, 'word') : null; const celebrating = celebratingSlot === index && celebratingCategory ? categories.get(celebratingCategory) : null; return <button ref={(element) => { cardRefs.current[`foundation-${index}`] = element; }} data-foundation-index={index} className={`foundation ${category ? 'occupied' : ''} ${latestWord ? 'stacked' : ''} ${category ? labelSizeClass(category.name) : ''} ${celebrating ? 'completed' : ''}`} key={index} onClick={() => moveToFoundation(index)} disabled={isComplete}>{celebrating ? <><span>✓ {celebrating.name}</span><small>Complete!</small></> : category ? <>{latestWord && wordVisual ? <><span className={`foundation-base ${categoryVisual!.kind}`} aria-label={categoryVisual!.alt}>{renderCategoryVisual(categoryVisual!, category.name, true)}</span><span className={`foundation-top ${latestWordClass} ${wordVisual.kind}`} aria-label={wordVisual.alt}><span className="card-content">{renderVisual(wordVisual)}</span><small>{completedWords.length}/{category.words.length}</small></span></> : <span className={`foundation-alone ${categoryVisual!.kind}`} aria-label={categoryVisual!.alt}><span className="card-content">{renderCategoryVisual(categoryVisual!, category.name)}</span><small>{completedWords.length}/{category.words.length}</small></span>}</> : <span>Category</span>}</button>; })}</section>
    <section className="tableau" aria-label="Tableau cards">{game.tableau.map((column, columnIndex) => {
      const reveal = column.length < 2 ? 0 : Math.max(10, Math.min(20, 160 / (column.length - 1)));
      return <div className="word-column" key={columnIndex} onClick={() => column.length === 0 && moveToEmptyColumn(columnIndex)} role={column.length === 0 ? 'button' : undefined} tabIndex={column.length === 0 ? 0 : undefined}>{column.map((card, cardIndex) => {
        const accessible = card.faceUp;
        const active = selectedColumn === columnIndex && cardIndex >= (selectedStart ?? column.length);
        const fullyShown = cardIndex === column.length - 1;
        const lengthClass = labelSizeClass(card.label);
        const visual = cardVisual(card.categoryId, card.label, card.type);
        return <button ref={(element) => { cardRefs.current[card.id] = element; }} data-card-id={card.id} className={`word-card ${card.type} ${card.faceUp ? 'uncovered' : 'covered'} ${fullyShown ? 'full' : ''} ${lengthClass} ${visual.kind} ${active ? 'selected' : ''}`} disabled={!accessible || isComplete} key={card.id} style={{ top: cardIndex * reveal, zIndex: cardIndex }} onClick={() => select(columnIndex, cardIndex)} aria-label={visual.alt}>{card.faceUp ? <span className="card-content">{card.type === 'category' ? renderCategoryVisual(visual, card.label, !fullyShown) : renderVisual(visual)}</span> : ''}</button>;
      })}</div>;
    })}</section>
  </section></main>;
}

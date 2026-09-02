'use client';

import { useEffect, useMemo, useState } from 'react';
import categoryData from '../content/categories.json';
import levelData from '../content/levels.json';

type Category = (typeof categoryData.categories)[number];
type Card = { id: string; type: 'word' | 'category'; label: string; categoryId: string; faceUp: boolean };
type Source = number | 'waste';
type Move = { kind: 'stack' | 'foundation' | 'draw'; from: Source | 'stock'; fromIndex?: number; to?: number; cards: Card[] };
type GameState = { tableau: Card[][]; stock: Card[]; waste: Card[]; foundations: (string | null)[]; completed: Record<string, string[]>; moves: number; history: Move[] };

const categories = new Map(categoryData.categories.map((category) => [category.id, category]));
const levels = levelData.levels.map((item) => ({ ...item, categoryCount: item.categoryIds.length, cardCount: item.categoryIds.reduce((total, id) => total + 1 + (categories.get(id)?.words.length ?? 0), 0) }));
const SAVE_KEY = 'solitaire-associations.save-v4';

function shuffled<T>(items: T[], seed: number) {
  const copy = [...items]; let state = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const next = state % (index + 1);
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function makeGame(seed = 101, level = levels[0]): GameState {
  const activeCategories = level.categoryIds.map((id) => categories.get(id)!);
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
  return { tableau, stock: shuffledDeck, waste: [], foundations: Array(4).fill(null), completed: Object.fromEntries(activeCategories.map((category) => [category.id, []])), moves: 0, history: [] };
}

function revealTop(column: Card[]) {
  return column.map((card, index) => index === column.length - 1 ? { ...card, faceUp: true } : card);
}

function restoreToColumn(column: Card[], cards: Card[], fromIndex = column.length) {
  const prefix = column.slice(0, fromIndex).map((card, index, source) => index === source.length - 1 ? { ...card, faceUp: false } : card);
  return [...prefix, ...cards.map((card) => ({ ...card, faceUp: true }))];
}

function normalizeGame(candidate: Partial<GameState>, level = levels[0]): GameState {
  const activeCategories = level.categoryIds.map((id) => categories.get(id)!);
  const fresh = makeGame(101, level);
  const tableau = Array.isArray(candidate.tableau) ? candidate.tableau.map((column) => Array.isArray(column) ? column.map((card, index) => ({ ...card, faceUp: card.faceUp ?? index === column.length - 1 })) : []) : fresh.tableau;
  return {
    ...fresh,
    ...candidate,
    tableau,
    stock: Array.isArray(candidate.stock) ? candidate.stock : fresh.stock,
    waste: Array.isArray(candidate.waste) ? candidate.waste : [],
    foundations: Array.from({ length: 4 }, (_, index) => Array.isArray(candidate.foundations) ? candidate.foundations[index] ?? null : null),
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
  const [celebratingSlot, setCelebratingSlot] = useState<number | null>(null);
  const [celebratingCategory, setCelebratingCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('Move an uncovered category card to an empty foundation.');
  const [saveReady, setSaveReady] = useState(false);
  const remaining = useMemo(() => game.tableau.reduce((total, column) => total + column.length, 0) + game.stock.length + game.waste.length, [game.tableau, game.stock, game.waste]);
  const selectedCards = selectedColumn === null ? [] : selectedColumn === 'waste' ? game.waste.slice(-1) : game.tableau[selectedColumn].slice(selectedStart ?? game.tableau[selectedColumn].length - 1);
  const selected = selectedCards[0] ?? null;
  const isComplete = remaining === 0;

  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (saved?.schemaVersion === 4 && saved?.levelId === level.id && saved?.game) setGame(normalizeGame(saved.game, level)); } catch { /* Start a fresh game when an old save cannot be read. */ }
    setSaveReady(true);
  }, []);
  useEffect(() => { if (saveReady) localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 4, levelId: level.id, updatedAt: new Date().toISOString(), game })); }, [game, saveReady]);

  function select(source: Source, cardIndex?: number) {
    const column = source === 'waste' ? null : game.tableau[source];
    const index = source === 'waste' ? undefined : cardIndex;
    const card = source === 'waste' ? game.waste.at(-1) : column?.[index ?? column.length - 1];
    if (!card || isComplete) return;
    const stackStart = source === 'waste' ? null : column!.findIndex((item) => item.faceUp);
    if (selectedColumn === source) { setSelectedColumn(null); setSelectedStart(null); setMessage('Card selection cleared.'); return; }
    if (selectedCards.length > 0 && selectedCards.every((item) => item.type === 'word') && card.type === 'word' && selectedCards[0].categoryId === card.categoryId && source !== selectedColumn && source !== 'waste') { stackWord(source); return; }
    setSelectedColumn(source); setSelectedStart(stackStart); setMessage(`“${card.label}” and every open card in this stack selected.`);
  }

  function stackWord(destination: number) {
    if (selectedColumn === null || selectedCards.length === 0 || selectedCards.some((card) => card.type !== 'word') || destination === selectedColumn) return;
    const target = game.tableau[destination].at(-1);
    if (!target || target.type !== 'word' || target.categoryId !== selectedCards[0].categoryId) { setMessage('Words may only stack on a word from the same category.'); return; }
    const cards = selectedCards;
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === destination ? [...column, ...cards.map((card) => ({ ...card, faceUp: true }))] : index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
      waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
      moves: current.moves + 1, history: [...current.history, { kind: 'stack', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: destination, cards }],
    }));
    setSelectedColumn(null); setSelectedStart(null); setMessage('Matched cards stacked together — a new card is uncovered.');
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
      if (foundation) { setMessage('That foundation already holds a category card.'); return; }
      if (game.foundations.includes(selected.categoryId)) { setMessage('That category has already been placed.'); return; }
      setGame((current) => ({ ...current,
        tableau: current.tableau.map((column, index) => index === selectedColumn ? revealTop(column.slice(0, selectedStart ?? column.length - 1)) : column),
        waste: selectedColumn === 'waste' ? current.waste.slice(0, -1) : current.waste,
        foundations: current.foundations.map((id, index) => index === slot ? selected.categoryId : id), moves: current.moves + 1, history: [...current.history, { kind: 'foundation', from: selectedColumn, fromIndex: selectedStart ?? undefined, to: slot, cards: selectedCards }],
      }));
      setSelectedColumn(null); setSelectedStart(null); setMessage(`${selected.label} is ready to receive matching words.`); return;
    }
    if (selectedCards.some((card) => card.type !== 'word' || card.categoryId !== selected.categoryId) || foundation !== selected.categoryId) { setMessage('These cards need their matching category foundation first.'); return; }
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

  function undo() {
    const latest = game.history.at(-1);
    if (!latest) { setMessage('There is no move to undo yet.'); return; }
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === latest.from ? restoreToColumn(column, latest.cards, latest.fromIndex) : latest.kind === 'stack' && index === latest.to ? column.slice(0, -latest.cards.length) : column),
      stock: latest.kind === 'draw' ? [...current.stock, ...latest.cards.map((card) => ({ ...card, faceUp: false }))] : current.stock,
      waste: latest.kind === 'draw' ? current.waste.slice(0, -latest.cards.length) : latest.from === 'waste' ? [...current.waste, ...latest.cards.map((card) => ({ ...card, faceUp: true }))] : current.waste,
      foundations: latest.kind === 'foundation' ? latest.cards[0].type === 'category' ? current.foundations.map((id, index) => index === latest.to ? null : id) : current.foundations.map((id, index) => index === latest.to && id === null ? latest.cards[0].categoryId : id) : current.foundations,
      completed: latest.kind === 'foundation' && latest.cards[0].type === 'word' ? { ...current.completed, [latest.cards[0].categoryId]: current.completed[latest.cards[0].categoryId].slice(0, -latest.cards.length) } : current.completed,
      moves: Math.max(0, current.moves - 1), history: current.history.slice(0, -1),
    }));
    setSelectedColumn(null); setSelectedStart(null); setMessage('Last move undone.');
  }

  function hint() {
    const categoryColumn = game.tableau.findIndex((column) => column.at(-1)?.type === 'category');
    if (categoryColumn !== -1 && game.foundations.some((id) => id === null)) { setSelectedColumn(categoryColumn); setMessage('Hint: move this category card to an empty foundation.'); return; }
    const wordColumn = game.tableau.findIndex((column) => { const card = column.at(-1); return card?.type === 'word' && game.foundations.includes(card.categoryId); });
    if (wordColumn !== -1) { const card = game.tableau[wordColumn].at(-1)!; setSelectedColumn(wordColumn); setMessage(`Hint: “${card.label}” can move to its category foundation.`); return; }
    setMessage('Hint: look for two uncovered words that belong together and stack one on the other.');
  }

  function restart() { setGame(makeGame(Date.now(), level)); setSelectedColumn(null); setSelectedStart(null); setMessage('New deal: uncover a category card or match two related words.'); }

  function currentCompletedCount(categoryId: string) {
    return game.completed[categoryId]?.length ?? 0;
  }

  function chooseLevel(nextLevel: typeof levels[number]) {
    setLevel(nextLevel); setGame(makeGame(Date.now(), nextLevel)); setSelectedColumn(null); setSelectedStart(null); setCelebratingSlot(null); setCelebratingCategory(null); setShowLevels(false); setMessage(`Level ${nextLevel.difficulty} ready.`);
  }

  return <main className="app-shell"><section className="game-canvas" aria-label="Solitaire Associations game board">
    <header className="topbar"><div><p className="eyebrow">Solitaire Associations</p></div><button className="restart" onClick={restart} aria-label="Start level again">↻</button></header>
    <section className="progress" aria-label="Level progress"><div><span>Moves</span><strong>{game.moves}</strong></div><div><span>Cards left</span><strong>{remaining}</strong></div><div><span>Level</span><button className="level-select" onClick={() => setShowLevels((open) => !open)} aria-expanded={showLevels}>{level.difficulty} · {level.difficultyScore}</button></div></section>
    {showLevels && <section className="level-menu" aria-label="Choose level">{levels.map((item) => <button className={item.id === level.id ? 'current' : ''} key={item.id} onClick={() => chooseLevel(item)}><span>Level {item.difficulty}</span><small>{item.name} · {item.cardCount} cards · {item.categoryCount} categories</small></button>)}</section>}
    <section className="stock-row" aria-label="Draw pile">
      {game.waste.at(-1) ? <button className={`waste-card ${game.waste.at(-1)!.type} ${selectedColumn === 'waste' ? 'selected' : ''}`} onClick={() => select('waste')} disabled={isComplete}>{game.waste.at(-1)!.label}</button> : <div className="waste-empty">Open a card</div>}
      <button className="stock-card" onClick={drawCard} disabled={!game.stock.length || isComplete} aria-label="Open next card"><span>{game.stock.length}</span></button>
    </section>
    <section className="tableau" aria-label="Tableau cards">{game.tableau.map((column, columnIndex) => {
      const reveal = column.length < 2 ? 0 : Math.max(10, Math.min(20, 160 / (column.length - 1)));
      return <div className="word-column" key={columnIndex} onClick={() => column.length === 0 && moveToEmptyColumn(columnIndex)} role={column.length === 0 ? 'button' : undefined} tabIndex={column.length === 0 ? 0 : undefined}>{column.map((card, cardIndex) => {
        const accessible = card.faceUp;
        const active = selectedColumn === columnIndex && cardIndex >= (selectedStart ?? column.length);
        return <button className={`word-card ${card.type} ${card.faceUp ? 'uncovered' : 'covered'} ${active ? 'selected' : ''}`} disabled={!accessible || isComplete} key={card.id} style={{ top: cardIndex * reveal, zIndex: cardIndex }} onClick={() => select(columnIndex, cardIndex)}>{card.faceUp ? card.label : ''}</button>;
      })}</div>;
    })}</section>
    <section className="foundation-row" aria-label="Category foundations">{game.foundations.map((categoryId, index) => { const category = categoryId ? categories.get(categoryId)! : null; const celebrating = celebratingSlot === index && celebratingCategory ? categories.get(celebratingCategory) : null; return <button className={`foundation ${category ? 'occupied' : ''} ${celebrating ? 'completed' : ''}`} key={index} onClick={() => moveToFoundation(index)} disabled={isComplete}>{celebrating ? <><span>✓ {celebrating.name}</span><small>Complete!</small></> : category ? <><span>{category.name}</span><small>{game.completed[category.id].length}/{category.words.length}</small></> : <span>Category</span>}</button>; })}</section>
    <footer className="actions"><button onClick={undo} disabled={game.history.length === 0}>Undo</button><button className="hint" onClick={hint} disabled={isComplete}>Hint</button></footer>
  </section></main>;
}

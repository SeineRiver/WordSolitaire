'use client';

import { useEffect, useMemo, useState } from 'react';
import categoryData from '../content/categories.json';
import levelData from '../content/levels.json';

type Category = (typeof categoryData.categories)[number];
type Move = { column: number; categoryId: string; word: string };
type GameState = { tableau: string[][]; completed: Record<string, string[]>; moves: number; history: Move[] };

const categories = new Map(categoryData.categories.map((category) => [category.id, category]));
const level = levelData.levels[0];
const activeCategories = level.categoryIds.map((id) => categories.get(id)!);

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function makeGame(): GameState {
  const deck = shuffled(activeCategories.flatMap((category) => category.words));
  const tableau = Array.from({ length: 4 }, () => [] as string[]);
  deck.forEach((word, index) => tableau[index % tableau.length].push(word));
  return { tableau, completed: Object.fromEntries(activeCategories.map((category) => [category.id, []])), moves: 0, history: [] };
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => makeGame());
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [message, setMessage] = useState('Tap an uncovered word, then choose its category.');
  const remaining = useMemo(() => game.tableau.reduce((total, column) => total + column.length, 0), [game.tableau]);
  const selectedWord = selectedColumn === null ? null : game.tableau[selectedColumn].at(-1) ?? null;
  const isComplete = remaining === 0;

  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, []);

  function chooseCategory(category: Category) {
    if (selectedColumn === null || !selectedWord) { setMessage('Choose an uncovered word first.'); return; }
    const isCorrect = category.words.includes(selectedWord);
    setGame((current) => {
      if (!isCorrect) return { ...current, moves: current.moves + 1 };
      return {
        tableau: current.tableau.map((column, index) => index === selectedColumn ? column.slice(0, -1) : column),
        completed: { ...current.completed, [category.id]: [...current.completed[category.id], selectedWord] },
        moves: current.moves + 1,
        history: [...current.history, { column: selectedColumn, categoryId: category.id, word: selectedWord }],
      };
    });
    setSelectedColumn(null);
    setMessage(isCorrect ? `Correct — ${selectedWord} belongs in ${category.name}.` : 'Not that category. Try another one.');
  }

  function undo() {
    const latest = game.history.at(-1);
    if (!latest) { setMessage('There is no completed move to undo yet.'); return; }
    setGame((current) => ({ ...current,
      tableau: current.tableau.map((column, index) => index === latest.column ? [...column, latest.word] : column),
      completed: { ...current.completed, [latest.categoryId]: current.completed[latest.categoryId].slice(0, -1) },
      moves: Math.max(0, current.moves - 1), history: current.history.slice(0, -1),
    }));
    setSelectedColumn(null); setMessage('Last completed move undone.');
  }

  function hint() {
    const column = game.tableau.findIndex((items) => items.length > 0);
    if (column === -1) return;
    const word = game.tableau[column].at(-1)!;
    const category = activeCategories.find((item) => item.words.includes(word))!;
    setSelectedColumn(column); setMessage(`Hint: “${word}” belongs in ${category.name}.`);
  }

  function restart() { setGame(makeGame()); setSelectedColumn(null); setMessage('New board ready. Tap an uncovered word to begin.'); }

  return <main className="app-shell"><section className="game-canvas" aria-label="Solitaire Associations game board">
    <header className="topbar"><div><p className="eyebrow">Solitaire Associations</p><h1>{level.name}</h1></div><button className="restart" onClick={restart} aria-label="Start level again">↻</button></header>
    <section className="progress" aria-label="Level progress"><div><span>Moves</span><strong>{game.moves}</strong></div><div><span>Cards left</span><strong>{remaining}</strong></div><div><span>Level</span><strong>1 · {level.difficultyScore}</strong></div></section>
    <p className="message" role="status">{isComplete ? 'Level complete! Every association is solved.' : message}</p>
    <section className="tableau" aria-label="Word cards">{game.tableau.map((column, columnIndex) => <div className="word-column" key={columnIndex}>{column.map((word, cardIndex) => {
      const uncovered = cardIndex === column.length - 1; const selected = selectedColumn === columnIndex && uncovered;
      return <button className={`word-card ${uncovered ? 'uncovered' : 'covered'} ${selected ? 'selected' : ''}`} disabled={!uncovered || isComplete} key={`${word}-${cardIndex}`} onClick={() => { setSelectedColumn(columnIndex); setMessage(`“${word}” selected. Now choose its category.`); }}>{uncovered ? word : ''}</button>;
    })}</div>)}</section>
    <section className="category-grid" aria-label="Categories">{activeCategories.map((category) => <button className="category-card" key={category.id} onClick={() => chooseCategory(category)} disabled={isComplete}><span>{category.name}</span><small>{game.completed[category.id].length}/{category.words.length}</small><div className="pips" aria-hidden="true">{category.words.map((word) => <i className={game.completed[category.id].includes(word) ? 'filled' : ''} key={word} />)}</div></button>)}</section>
    <footer className="actions"><button onClick={undo} disabled={game.history.length === 0}>Undo</button><button className="hint" onClick={hint} disabled={isComplete}>Hint</button></footer>
  </section></main>;
}

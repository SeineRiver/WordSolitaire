import fs from "node:fs";

const levelsPath = new URL("../content/levels.json", import.meta.url);

function chooseCounts(categoryCount, totalCards, levelNumber) {
  const target = totalCards - categoryCount;
  const solutions = [];
  const maxAvailable = { 3: 2, 4: 3, 5: 8, 6: 13, 7: 6, 8: 5, 9: 5 };

  function visit(value, remainingCategories, remainingSum, counts) {
    if (remainingCategories === 0) {
      if (remainingSum === 0) solutions.push([...counts]);
      return;
    }
    if (value > 9) return;
    if (remainingSum < value * remainingCategories || remainingSum > 9 * remainingCategories) return;

    for (let count = 0; count <= remainingCategories; count += 1) {
      if (count > maxAvailable[value]) break;
      const nextSum = remainingSum - value * count;
      if (nextSum < 0) continue;
      visit(value + 1, remainingCategories - count, nextSum, counts.concat(Array(count).fill(value)));
    }
  }

  visit(3, categoryCount, target, []);
  if (!solutions.length) throw new Error(`No recipe for level ${levelNumber}: ${categoryCount} categories, ${totalCards} cards`);

  // Prefer recipes with more distinct category sizes and fewer repeated sizes.
  solutions.sort((a, b) => {
    const score = (values) => {
      const frequencies = Object.values(Object.groupBy(values, (v) => v)).map((group) => group.length);
      return new Set(values).size * 100 + Math.max(...values) * 10 - frequencies.reduce((sum, n) => sum + (n - 1) ** 2, 0);
    };
    return score(b) - score(a);
  });

  const highVarietySolutions = levelNumber >= 60 ? solutions.filter((values) => values.includes(9)) : solutions;
  const pool = highVarietySolutions.length ? highVarietySolutions : solutions;
  const selected = pool[(levelNumber * 17) % pool.length].sort((a, b) => a - b);
  return selected;
}

const levels = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const categoryCount = 4 + Math.floor((index * 8) / 99);
  const totalCards = 25 + Math.round((index * 50) / 99);
  return {
    id: `level-${String(number).padStart(3, "0")}`,
    name: `First Links ${number}`,
    difficulty: number,
    difficultyScore: number * 10,
    totalCards,
    categoryCount,
    wordCounts: chooseCounts(categoryCount, totalCards, number),
  };
});

fs.writeFileSync(levelsPath, `${JSON.stringify({ schemaVersion: 2, levels }, null, 2)}\n`);

// Tile-partition solver.
//
// In the consume-tile model every tile belongs to exactly one Fourge. Solo play
// knows which physical tiles a player spent, but co-op only syncs the Fourge
// *words* (not tile indices). To gray out spent tiles for everyone we recover a
// clean partition here: map each Fourge word to the four tile indices that form
// it, using every tile exactly once.

import type { Puzzle } from "./types";

const cache = new Map<number, Map<string, number[]> | null>();

/**
 * Solve the puzzle's tile partition. Returns a map from each Fourge word (as it
 * appears in `puzzle.quartiles`) to the four tile indices that spell it, with
 * every tile used exactly once. Returns null if no clean partition exists
 * (shouldn't happen for well-formed puzzles). Result is memoized per puzzle id.
 */
export function decomposePuzzle(puzzle: Puzzle): Map<string, number[]> | null {
  const hit = cache.get(puzzle.id);
  if (hit !== undefined) return hit;

  const tiles = puzzle.tiles.map((t) => t.toLowerCase());
  const used = new Array(tiles.length).fill(false);
  const result = new Map<string, number[]>();

  // Match `rem` (the unconsumed suffix of a Fourge) with `need` more tiles.
  function tryWord(rem: string, need: number, acc: number[], qi: number): boolean {
    if (rem.length === 0) {
      if (need !== 0) return false;
      result.set(puzzle.quartiles[qi], acc.slice());
      if (solve(qi + 1)) return true;
      result.delete(puzzle.quartiles[qi]);
      return false;
    }
    if (need === 0) return false;
    for (let i = 0; i < tiles.length; i++) {
      if (used[i] || !rem.startsWith(tiles[i])) continue;
      used[i] = true;
      acc.push(i);
      if (tryWord(rem.slice(tiles[i].length), need - 1, acc, qi)) return true;
      acc.pop();
      used[i] = false;
    }
    return false;
  }

  function solve(qi: number): boolean {
    if (qi === puzzle.quartiles.length) return true;
    return tryWord(puzzle.quartiles[qi], 4, [], qi);
  }

  const ok = solve(0);
  const out = ok ? result : null;
  cache.set(puzzle.id, out);
  return out;
}

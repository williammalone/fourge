// Easy-mode hints: figure out which tiles spell each Fourge, so we can reveal
// the *starting fragment* of a word and glow its starter tile on the board.
//
// The puzzle bank stores quartiles only as words (e.g. "motorcycle"), not as
// tile indices. We recover one valid decomposition by a small depth-first
// search over the tiles — exactly the inverse of `wordFromTiles`.

import type { Puzzle } from "./types";

/**
 * Find an ordered list of distinct tile indices whose text concatenates to
 * `word`, using at most `maxTiles` tiles. Returns the first decomposition
 * found, or null if the word can't be spelled from the tiles.
 */
export function decompose(
  tiles: string[],
  word: string,
  maxTiles = 4,
): number[] | null {
  const target = word.toUpperCase();
  const used: boolean[] = new Array(tiles.length).fill(false);
  const path: number[] = [];

  function dfs(pos: number): boolean {
    if (pos === target.length) return true;
    if (path.length >= maxTiles) return false;
    for (let i = 0; i < tiles.length; i++) {
      if (used[i]) continue;
      const frag = tiles[i].toUpperCase();
      if (frag.length === 0) continue;
      if (!target.startsWith(frag, pos)) continue;
      used[i] = true;
      path.push(i);
      if (dfs(pos + frag.length)) return true;
      path.pop();
      used[i] = false;
    }
    return false;
  }

  return dfs(0) ? path.slice() : null;
}

/** One Fourge's hint: the word, its first fragment, and the starter tile index. */
export interface QuartileHint {
  word: string;
  /** Text of the first tile, e.g. "MO". */
  firstFragment: string;
  /** Index of the first tile on the board (to glow it). */
  starterIndex: number;
  /** All tile indices that spell this Fourge, in order. */
  tiles: number[];
}

/**
 * Build a hint for every quartile in the puzzle. Quartiles that can't be
 * decomposed (shouldn't happen for a valid bank) are skipped.
 *
 * Distinct tile indices are reserved across quartiles when possible, so two
 * Fourges that share a fragment (e.g. two words starting "MO") glow two
 * different tiles rather than colliding on one.
 */
export function quartileHints(puzzle: Puzzle): QuartileHint[] {
  const claimed = new Set<number>();
  const hints: QuartileHint[] = [];
  for (const word of puzzle.quartiles) {
    // Prefer a decomposition whose starter tile isn't already claimed.
    const all = allDecompositions(puzzle.tiles, word);
    const pick =
      all.find((d) => !claimed.has(d[0])) ?? all[0] ?? null;
    if (!pick) continue;
    claimed.add(pick[0]);
    hints.push({
      word,
      firstFragment: puzzle.tiles[pick[0]],
      starterIndex: pick[0],
      tiles: pick,
    });
  }
  return hints;
}

/** Enumerate up to a handful of decompositions (used to avoid starter clashes). */
function allDecompositions(
  tiles: string[],
  word: string,
  maxTiles = 4,
  limit = 8,
): number[][] {
  const target = word.toUpperCase();
  const used: boolean[] = new Array(tiles.length).fill(false);
  const path: number[] = [];
  const out: number[][] = [];

  function dfs(pos: number): void {
    if (out.length >= limit) return;
    if (pos === target.length) {
      out.push(path.slice());
      return;
    }
    if (path.length >= maxTiles) return;
    for (let i = 0; i < tiles.length; i++) {
      if (used[i]) continue;
      const frag = tiles[i].toUpperCase();
      if (frag.length === 0) continue;
      if (!target.startsWith(frag, pos)) continue;
      used[i] = true;
      path.push(i);
      dfs(pos + frag.length);
      path.pop();
      used[i] = false;
    }
  }

  dfs(0);
  return out;
}

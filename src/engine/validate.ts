// Word validation and submission logic.

import type { FoundWord, Puzzle, SubmitResult } from "./types";
import { pointsForTileCount } from "./score";

/** Concatenate the selected tiles (by index) into a lowercase word. */
export function wordFromTiles(puzzle: Puzzle, tileIndices: number[]): string {
  return tileIndices.map((i) => puzzle.tiles[i]).join("").toLowerCase();
}

/**
 * Attempt to submit a selection of tile indices as a word.
 *
 * Rules:
 *  - 1..4 distinct tiles (the UI enforces distinctness, but we guard here too).
 *  - The concatenation must be a dictionary word.
 *  - A word already found cannot be scored again (counts once).
 *
 * Tiles are reusable across *different* words, so we never "consume" them.
 */
export function submit(
  puzzle: Puzzle,
  tileIndices: number[],
  dictionary: Set<string>,
  alreadyFound: ReadonlySet<string>,
): SubmitResult {
  const distinct = new Set(tileIndices);
  if (tileIndices.length < 1 || distinct.size < 1) {
    return { ok: false, reason: "too-short" };
  }
  if (tileIndices.length > 4 || distinct.size !== tileIndices.length) {
    return { ok: false, reason: "too-long" };
  }

  const word = wordFromTiles(puzzle, tileIndices);
  if (!dictionary.has(word)) {
    return { ok: false, reason: "not-a-word" };
  }
  if (alreadyFound.has(word)) {
    return { ok: false, reason: "already-found" };
  }

  const isQuartile =
    tileIndices.length === 4 && puzzle.quartiles.includes(word);

  const found: FoundWord = {
    word,
    tiles: tileIndices.slice(),
    points: pointsForTileCount(tileIndices.length),
    isQuartile,
  };
  return { ok: true, found };
}

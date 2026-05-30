// Core game types.

/** A puzzle as produced by the offline generator (public/puzzles.json). */
export interface Puzzle {
  id: number;
  /** 20 fragment tiles (2-4 uppercase letters each). */
  tiles: string[];
  /** The 5 hidden quartile words (each formed from exactly 4 tiles). */
  quartiles: string[];
  /** Total number of distinct valid words findable on this board. */
  totalWords: number;
}

/** A word the player has successfully found. */
export interface FoundWord {
  /** The word, lowercase. */
  word: string;
  /** Tile indices used, in selection order. */
  tiles: number[];
  /** Points awarded (1/2/3 for 1-3 tiles, 8 for a 4-tile quartile). */
  points: number;
  /** True if this is one of the 5 hidden quartiles. */
  isQuartile: boolean;
  /** Co-op only: stable id of the player who found it. */
  finderId?: string;
  /** Co-op only: display name of the finder. */
  finderName?: string;
}

/** Persisted per-day game state. */
export interface GameState {
  /** Day number this state belongs to (see lib/daily). */
  day: number;
  puzzleId: number;
  found: FoundWord[];
  score: number;
  /** Number of the 5 quartiles found. */
  quartilesFound: number;
  /** True once all 5 quartiles are found. */
  complete: boolean;
  /** Player's chosen display name (for sharing). */
  name?: string;
}

/** Result of attempting to submit a selection of tiles. */
export type SubmitResult =
  | { ok: true; found: FoundWord }
  | { ok: false; reason: "too-short" | "too-long" | "not-a-word" | "already-found" };

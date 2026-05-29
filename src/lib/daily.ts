// Daily puzzle selection. Deterministic from the calendar date, so everyone
// who opens the app on the same day gets the same board — no server needed.

import type { Puzzle } from "../engine/types";

/** Epoch: puzzle #0 is 2026-01-01 (local). */
const EPOCH_UTC = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

/** Day number for a given date, using the date's *local* calendar day. */
export function dayNumber(date = new Date()): number {
  const localMidnightUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return Math.floor((localMidnightUtc - EPOCH_UTC) / DAY_MS);
}

/** Map a day number to an index into the puzzle bank (wraps, handles negatives). */
export function puzzleIndexForDay(day: number, total: number): number {
  if (total <= 0) return 0;
  return ((day % total) + total) % total;
}

/** Pick the puzzle for a given day from the bank. */
export function puzzleForDay(puzzles: Puzzle[], day: number): Puzzle {
  return puzzles[puzzleIndexForDay(day, puzzles.length)];
}

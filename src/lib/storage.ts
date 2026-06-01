// localStorage persistence: resume mid-game, lock one play per day, track streak.

import type { GameState } from "../engine/types";

const STATE_PREFIX = "quartiles:state:";
const NAME_KEY = "quartiles:name";
const STREAK_KEY = "quartiles:streak";
const PID_KEY = "quartiles:pid";
const INTRO_KEY = "quartiles:intro";
const EASY_KEY = "quartiles:easy";
const TUTORIAL_KEY = "quartiles:tutorial";
const PLAYS_KEY = "quartiles:plays";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — game still works in-memory */
  }
}

export function loadState(day: number): GameState | null {
  const raw = safeGet(STATE_PREFIX + day);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveState(state: GameState): void {
  safeSet(STATE_PREFIX + state.day, JSON.stringify(state));
}

/** A stable id for this browser, so presence doesn't double-count you on reload. */
export function playerId(): string {
  let id = safeGet(PID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    safeSet(PID_KEY, id);
  }
  return id;
}

/** Whether this browser has seen the first-time intro. */
export function introSeen(): boolean {
  return safeGet(INTRO_KEY) === "1";
}
export function markIntroSeen(): void {
  safeSet(INTRO_KEY, "1");
}

/** Whether the interactive "tap here" first-word tutorial has been completed/skipped. */
export function tutorialDone(): boolean {
  return safeGet(TUTORIAL_KEY) === "1";
}
export function markTutorialDone(): void {
  safeSet(TUTORIAL_KEY, "1");
}

/**
 * Distinct calendar days this browser has played. Drives a difficulty ramp:
 * day 1 reveals answer words, days 2-3 show starter fragments, day 4+ no hints.
 */
interface Plays {
  count: number;
  lastDay: number;
}
function loadPlaysRaw(): Plays {
  const raw = safeGet(PLAYS_KEY);
  if (!raw) return { count: 0, lastDay: -99999 };
  try {
    return JSON.parse(raw) as Plays;
  } catch {
    return { count: 0, lastDay: -99999 };
  }
}
export function loadPlays(): number {
  return loadPlaysRaw().count;
}
/** Count today (once) toward the play tally and return the new total. Idempotent per day. */
export function recordPlayDay(day: number): number {
  const p = loadPlaysRaw();
  if (p.lastDay === day) return p.count;
  const next: Plays = { count: p.count + 1, lastDay: day };
  safeSet(PLAYS_KEY, JSON.stringify(next));
  return next.count;
}

/**
 * Whether "Easy mode" (hints + glowing starter tiles) is on. The default ramps
 * with experience: ON for a player's first few days (the fragment→word idea is
 * the hard part to grok), OFF once they've played enough to find it routine.
 * An explicit toggle always wins.
 */
export function loadEasy(): boolean {
  const v = safeGet(EASY_KEY);
  if (v !== null) return v === "1";
  return loadPlays() <= 3;
}
export function saveEasy(on: boolean): void {
  safeSet(EASY_KEY, on ? "1" : "0");
}

export function loadName(): string {
  return safeGet(NAME_KEY) ?? "";
}
export function saveName(name: string): void {
  safeSet(NAME_KEY, name);
}

export interface Streak {
  count: number;
  lastDay: number;
}

export function loadStreak(): Streak {
  const raw = safeGet(STREAK_KEY);
  if (!raw) return { count: 0, lastDay: -9999 };
  try {
    return JSON.parse(raw) as Streak;
  } catch {
    return { count: 0, lastDay: -9999 };
  }
}

/** Record a completion on `day` and return the updated streak. */
export function recordCompletion(day: number): Streak {
  const prev = loadStreak();
  if (prev.lastDay === day) return prev; // already counted today
  const count = prev.lastDay === day - 1 ? prev.count + 1 : 1;
  const next: Streak = { count, lastDay: day };
  safeSet(STREAK_KEY, JSON.stringify(next));
  return next;
}

// localStorage persistence: resume mid-game, lock one play per day, track streak.

import type { GameState } from "../engine/types";

const STATE_PREFIX = "quartiles:state:";
const NAME_KEY = "quartiles:name";
const STREAK_KEY = "quartiles:streak";
const PID_KEY = "quartiles:pid";

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

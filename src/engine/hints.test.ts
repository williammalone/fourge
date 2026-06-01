import { describe, it, expect } from "vitest";
import { decompose, quartileHints } from "./hints";
import type { Puzzle } from "./types";

// MO+TOR+CY+CLE = motorcycle, MO+SQ+UI+TO = mosquito (two MO tiles, idx 0 & 5).
const puzzle: Puzzle = {
  id: 0,
  tiles: ["MO", "TOR", "CY", "CLE", "MO", "SQ", "UI", "TO"],
  quartiles: ["motorcycle", "mosquito"],
  totalWords: 0,
};

describe("decompose", () => {
  it("recovers the tile indices that spell a word, in order", () => {
    expect(decompose(puzzle.tiles, "motorcycle")).toEqual([0, 1, 2, 3]);
  });

  it("returns null when the word can't be spelled from the tiles", () => {
    expect(decompose(puzzle.tiles, "banana")).toBeNull();
  });

  it("does not reuse a tile index within one word", () => {
    // "momo" would need the MO tile twice if there were only one; here there
    // are two, so it succeeds with distinct indices.
    expect(decompose(["MO", "MO"], "momo")).toEqual([0, 1]);
    expect(decompose(["MO"], "momo")).toBeNull();
  });
});

describe("quartileHints", () => {
  it("gives each Fourge a starter fragment and a distinct starter tile", () => {
    const hints = quartileHints(puzzle);
    expect(hints).toHaveLength(2);
    expect(hints.map((h) => h.firstFragment)).toEqual(["MO", "MO"]);
    // Two MO-words must claim two different MO tiles, not collide on one.
    expect(hints[0].starterIndex).not.toBe(hints[1].starterIndex);
    expect(new Set([hints[0].starterIndex, hints[1].starterIndex])).toEqual(
      new Set([0, 4]),
    );
  });
});

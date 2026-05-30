import { describe, it, expect } from "vitest";
import { pointsForTileCount, isQuartileLength } from "./score";
import { parseDictionary } from "./dictionary";
import { submit, wordFromTiles } from "./validate";
import type { Puzzle } from "./types";

describe("score", () => {
  it("awards 1/2/3 points for 1/2/3 tiles and 8 for a quartile", () => {
    expect(pointsForTileCount(1)).toBe(1);
    expect(pointsForTileCount(2)).toBe(2);
    expect(pointsForTileCount(3)).toBe(3);
    expect(pointsForTileCount(4)).toBe(8);
  });

  it("gives 0 points for illegal tile counts", () => {
    expect(pointsForTileCount(0)).toBe(0);
    expect(pointsForTileCount(5)).toBe(0);
  });

  it("recognizes a quartile by length", () => {
    expect(isQuartileLength(4)).toBe(true);
    expect(isQuartileLength(3)).toBe(false);
  });
});

describe("dictionary", () => {
  it("parses, lowercases, and trims", () => {
    const d = parseDictionary("Apple\n  beta \n\nGAMMA\n");
    expect(d.has("apple")).toBe(true);
    expect(d.has("beta")).toBe(true);
    expect(d.has("gamma")).toBe(true);
    expect(d.size).toBe(3);
  });
});

// A tiny synthetic puzzle. "mumbling" = MU+MB+LI+NG is the quartile.
const puzzle: Puzzle = {
  id: 0,
  tiles: ["MU", "MB", "LI", "NG", "AT", "ON"],
  quartiles: ["mumbling"],
  totalWords: 0,
};
const dict = parseDictionary(
  ["mumbling", "mu", "at", "on", "ton", "li", "muon"].join("\n"),
);

describe("wordFromTiles", () => {
  it("concatenates selected tiles in order, lowercased", () => {
    expect(wordFromTiles(puzzle, [0, 1, 2, 3])).toBe("mumbling");
    expect(wordFromTiles(puzzle, [5, 4])).toBe("onat"); // order matters
  });
});

describe("submit", () => {
  const none = new Set<string>();

  it("accepts a valid 4-tile quartile and scores 8", () => {
    const r = submit(puzzle, [0, 1, 2, 3], dict, none);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.found.word).toBe("mumbling");
      expect(r.found.isQuartile).toBe(true);
      expect(r.found.points).toBe(8);
    }
  });

  it("accepts a valid 1-tile word for 1 point", () => {
    const r = submit(puzzle, [4], dict, none); // "at"
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.found.points).toBe(1);
      expect(r.found.isQuartile).toBe(false);
    }
  });

  it("rejects a non-word", () => {
    const r = submit(puzzle, [0, 4], dict, none); // "muat"
    expect(r).toEqual({ ok: false, reason: "not-a-word" });
  });

  it("rejects a word already found", () => {
    const r = submit(puzzle, [4], dict, new Set(["at"]));
    expect(r).toEqual({ ok: false, reason: "already-found" });
  });

  it("rejects more than 4 tiles", () => {
    const r = submit(puzzle, [0, 1, 2, 3, 4], dict, none);
    expect(r).toEqual({ ok: false, reason: "too-long" });
  });

  it("rejects an empty selection", () => {
    const r = submit(puzzle, [], dict, none);
    expect(r).toEqual({ ok: false, reason: "too-short" });
  });

  it("rejects a repeated tile index within one word", () => {
    const r = submit(puzzle, [0, 0], dict, none);
    expect(r).toEqual({ ok: false, reason: "too-long" });
  });
});

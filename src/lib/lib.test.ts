import { describe, it, expect } from "vitest";
import { dayNumber, puzzleIndexForDay } from "./daily";
import { encodeResult, decodeResult, readFromUrl, gemBar } from "./share";

describe("daily", () => {
  it("puzzle #0 is 2026-01-01", () => {
    expect(dayNumber(new Date(2026, 0, 1, 9, 30))).toBe(0);
  });

  it("advances by one per calendar day", () => {
    expect(dayNumber(new Date(2026, 0, 2))).toBe(1);
    expect(dayNumber(new Date(2026, 0, 31))).toBe(30);
    expect(dayNumber(new Date(2026, 1, 1))).toBe(31);
  });

  it("same date -> same day regardless of time", () => {
    expect(dayNumber(new Date(2026, 5, 29, 0, 1))).toBe(
      dayNumber(new Date(2026, 5, 29, 23, 59)),
    );
  });

  it("index wraps and handles negative days", () => {
    expect(puzzleIndexForDay(0, 10)).toBe(0);
    expect(puzzleIndexForDay(13, 10)).toBe(3);
    expect(puzzleIndexForDay(-1, 10)).toBe(9);
  });
});

describe("share encoding", () => {
  it("round-trips a result", () => {
    const r = { n: "William", d: 12, s: 34, q: 4, w: 18 };
    const token = encodeResult(r);
    expect(decodeResult(token)).toEqual(r);
  });

  it("rejects garbage tokens", () => {
    expect(decodeResult("not-base64!!")).toBeNull();
  });

  it("reads day + friend from a url", () => {
    const token = encodeResult({ n: "Sam", d: 7, s: 41, q: 5, w: 22 });
    const { day, friend } = readFromUrl(`?d=7&r=${token}`);
    expect(day).toBe(7);
    expect(friend?.n).toBe("Sam");
    expect(friend?.q).toBe(5);
  });

  it("gem bar is spoiler-free counts only", () => {
    expect([...gemBar(3)]).toHaveLength(5);
  });
});

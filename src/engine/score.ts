// Scoring rules. Pure functions — the most-tested part of the engine.

/** Points for a word made of `tileCount` tiles. */
export function pointsForTileCount(tileCount: number): number {
  switch (tileCount) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 8; // a "quartile" — the jackpot
    default:
      return 0; // 0 tiles or >4 tiles is not a legal word
  }
}

/** A 4-tile word is a quartile. */
export function isQuartileLength(tileCount: number): boolean {
  return tileCount === 4;
}

import type { FoundWord } from "../engine/types";

interface QuartileSlotsProps {
  /** The 5 Fourge words in canonical (puzzle) order. */
  quartiles: string[];
  found: FoundWord[];
  justFound: string | null; // word to animate
  /** Easy mode: reveal the words and make unfound ones tappable to be guided. */
  easy?: boolean;
  /** The Fourge currently being guided (highlighted). */
  guideWord?: string | null;
  /** Tap an unfound Fourge → start the tile-by-tile guide for it. */
  onPick?: (word: string) => void;
}

export default function QuartileSlots({
  quartiles,
  found,
  justFound,
  easy,
  guideWord,
  onPick,
}: QuartileSlotsProps) {
  const foundWords = new Set(found.filter((f) => f.isQuartile).map((f) => f.word));
  const foundCount = quartiles.filter((w) => foundWords.has(w)).length;

  return (
    <div className="gems">
      <div className="gems__label">
        Fourges <span className="gems__count">{foundCount}/5</span>
      </div>
      <div className="gems__row">
        {quartiles.map((word) => {
          const isFound = foundWords.has(word);
          const isNew = isFound && word === justFound;
          const isGuiding = !!easy && word === guideWord;

          if (isFound) {
            return (
              <div key={word} className={`gem gem--filled ${isNew ? "gem--pop" : ""}`}>
                <span className="gem__word">{word}</span>
              </div>
            );
          }
          if (easy) {
            return (
              <button
                key={word}
                type="button"
                className={`gem gem--pick ${isGuiding ? "gem--guiding" : ""}`}
                onClick={() => onPick?.(word)}
                aria-label={`Guide me through ${word}`}
                title="Tap to be guided"
              >
                <span className="gem__word">{word}</span>
              </button>
            );
          }
          return (
            <div key={word} className="gem gem--empty">
              <span className="gem__dot">◆</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

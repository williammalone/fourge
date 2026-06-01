import type { FoundWord } from "../engine/types";

interface QuartileSlotsProps {
  total: number; // always 5
  found: FoundWord[];
  justFound: string | null; // word to animate
  /**
   * Easy mode hints for the *unfound* Fourges, in order. Either starter
   * fragments (e.g. "MO") or — on a player's first day — the full answer words.
   */
  hints?: string[];
  /** True when `hints` are full answer words (render whole, no ellipsis). */
  hintsAreWords?: boolean;
}

export default function QuartileSlots({ total, found, justFound, hints, hintsAreWords }: QuartileSlotsProps) {
  const quartileWords = found.filter((f) => f.isQuartile).map((f) => f.word);
  const slots = [];
  for (let i = 0; i < total; i++) {
    const word = quartileWords[i];
    const isNew = word && word === justFound;
    // Empty slots are indexed 0..n after the filled ones; map each to the next hint.
    const hint = !word && hints ? hints[i - quartileWords.length] : undefined;
    slots.push(
      <div
        key={i}
        className={`gem ${word ? "gem--filled" : "gem--empty"} ${isNew ? "gem--pop" : ""} ${hint ? "gem--hint" : ""}`}
      >
        {word ? (
          <span className="gem__word">{word}</span>
        ) : hint ? (
          hintsAreWords ? (
            <span className="gem__hint-word">{hint}</span>
          ) : (
            <span className="gem__hint">{hint.toUpperCase()}…</span>
          )
        ) : (
          <span className="gem__dot">◆</span>
        )}
      </div>,
    );
  }
  return (
    <div className="gems">
      <div className="gems__label">
        Fourges <span className="gems__count">{quartileWords.length}/5</span>
      </div>
      <div className="gems__row">{slots}</div>
    </div>
  );
}

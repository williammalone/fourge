import type { FoundWord } from "../engine/types";

interface QuartileSlotsProps {
  total: number; // always 5
  found: FoundWord[];
  justFound: string | null; // word to animate
}

export default function QuartileSlots({ total, found, justFound }: QuartileSlotsProps) {
  const quartileWords = found.filter((f) => f.isQuartile).map((f) => f.word);
  const slots = [];
  for (let i = 0; i < total; i++) {
    const word = quartileWords[i];
    const isNew = word && word === justFound;
    slots.push(
      <div
        key={i}
        className={`gem ${word ? "gem--filled" : "gem--empty"} ${isNew ? "gem--pop" : ""}`}
      >
        {word ? <span className="gem__word">{word}</span> : <span className="gem__dot">◆</span>}
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

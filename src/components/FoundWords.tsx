import type { FoundWord } from "../engine/types";

interface FoundWordsProps {
  found: FoundWord[];
}

export default function FoundWords({ found }: FoundWordsProps) {
  // Non-quartile words only; quartiles get the hero treatment elsewhere.
  const words = found.filter((f) => !f.isQuartile).sort((a, b) => b.points - a.points || a.word.localeCompare(b.word));
  if (words.length === 0) {
    return (
      <div className="found">
        <div className="found__head">Words found</div>
        <p className="found__empty">No words yet — every valid word counts.</p>
      </div>
    );
  }
  return (
    <div className="found">
      <div className="found__head">
        Words found <span className="found__count">{words.length}</span>
      </div>
      <ul className="found__list">
        {words.map((w) => (
          <li key={w.word} className="found__item">
            <span className="found__word">{w.word}</span>
            <span className="found__pts">+{w.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

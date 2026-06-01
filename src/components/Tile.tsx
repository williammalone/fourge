interface TileProps {
  text: string;
  index: number;
  selected: boolean;
  order: number | null; // 1-based position in the current selection, or null
  used: boolean; // dimmed: helped form a found Fourge (still reusable)
  starter?: boolean; // easy mode: starts an unfound Fourge — glow it
  onClick: (index: number) => void;
}

export default function Tile({ text, index, selected, order, used, starter, onClick }: TileProps) {
  const cls = ["tile"];
  if (selected) cls.push("tile--selected");
  if (used && !selected) cls.push("tile--used");
  if (starter && !selected) cls.push("tile--starter");
  return (
    <button
      type="button"
      className={cls.join(" ")}
      onClick={() => onClick(index)}
      aria-pressed={selected}
      aria-label={`tile ${text}${used && !selected ? " (in a Fourge)" : ""}`}
    >
      <span className="tile__text">{text}</span>
      {order != null && <span className="tile__order">{order}</span>}
    </button>
  );
}

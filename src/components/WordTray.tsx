interface WordTrayProps {
  tiles: string[];
  selection: number[];
  status: "idle" | "shake";
  onRemove: (index: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  onShuffle: () => void;
}

export default function WordTray({
  tiles,
  selection,
  status,
  onRemove,
  onClear,
  onSubmit,
  onShuffle,
}: WordTrayProps) {
  const empty = selection.length === 0;
  return (
    <div className="tray-wrap">
      <div className={`tray ${status === "shake" ? "tray--shake" : ""}`}>
        {empty ? (
          <span className="tray__hint">Tap tiles to build a word</span>
        ) : (
          selection.map((idx, i) => (
            <button
              type="button"
              key={`${idx}-${i}`}
              className="tray__frag"
              onClick={() => onRemove(idx)}
              aria-label={`remove ${tiles[idx]}`}
            >
              {tiles[idx]}
            </button>
          ))
        )}
      </div>
      <div className="tray__actions">
        <button type="button" className="btn btn--ghost" onClick={onShuffle} aria-label="shuffle tiles">
          ⤮ Shuffle
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClear} disabled={empty}>
          Clear
        </button>
        <button type="button" className="btn btn--primary" onClick={onSubmit} disabled={empty}>
          Enter
        </button>
      </div>
    </div>
  );
}

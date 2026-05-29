import Tile from "./Tile";

interface GridProps {
  tiles: string[];
  /** display order: array of tile indices (for shuffle) */
  order: number[];
  selection: number[];
  usedTiles: Set<number>;
  onTileClick: (index: number) => void;
}

export default function Grid({ tiles, order, selection, usedTiles, onTileClick }: GridProps) {
  return (
    <div className="grid" role="group" aria-label="puzzle tiles">
      {order.map((idx) => {
        const pos = selection.indexOf(idx);
        return (
          <Tile
            key={idx}
            index={idx}
            text={tiles[idx]}
            selected={pos !== -1}
            order={pos === -1 ? null : pos + 1}
            used={usedTiles.has(idx)}
            onClick={onTileClick}
          />
        );
      })}
    </div>
  );
}

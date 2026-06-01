import Tile from "./Tile";

interface GridProps {
  tiles: string[];
  /** display order: array of tile indices (for shuffle) */
  order: number[];
  selection: number[];
  usedTiles: Set<number>;
  /** Easy mode: tiles that start an as-yet-unfound Fourge (glow them). */
  starterTiles?: Set<number>;
  /** Tutorial: the single tile to tap next (everything else dims). */
  coachTile?: number | null;
  onTileClick: (index: number) => void;
}

export default function Grid({ tiles, order, selection, usedTiles, starterTiles, coachTile, onTileClick }: GridProps) {
  const coaching = coachTile != null;
  return (
    <div className={`grid ${coaching ? "grid--coaching" : ""}`} role="group" aria-label="puzzle tiles">
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
            starter={starterTiles?.has(idx)}
            coach={coachTile === idx}
            onClick={onTileClick}
          />
        );
      })}
    </div>
  );
}

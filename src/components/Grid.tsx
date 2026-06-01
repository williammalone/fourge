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
  /** Tutorial: true while a wrong tap is being nudged (wiggle the coach tile). */
  coachNudge?: boolean;
  /** Tutorial: bumps on each wrong tap so the coach tile remounts and re-wiggles. */
  coachNudgeKey?: number;
  onTileClick: (index: number) => void;
}

export default function Grid({
  tiles,
  order,
  selection,
  usedTiles,
  starterTiles,
  coachTile,
  coachNudge,
  coachNudgeKey,
  onTileClick,
}: GridProps) {
  const coaching = coachTile != null;
  return (
    <div className={`grid ${coaching ? "grid--coaching" : ""}`} role="group" aria-label="puzzle tiles">
      {order.map((idx) => {
        const pos = selection.indexOf(idx);
        const isCoach = coachTile === idx;
        return (
          <Tile
            // Remount the coach tile on each wrong tap so its wiggle restarts.
            key={isCoach && coachNudge ? `${idx}-n${coachNudgeKey}` : idx}
            index={idx}
            text={tiles[idx]}
            selected={pos !== -1}
            order={pos === -1 ? null : pos + 1}
            used={usedTiles.has(idx)}
            starter={starterTiles?.has(idx)}
            coach={isCoach}
            coachNudge={isCoach && coachNudge}
            onClick={onTileClick}
          />
        );
      })}
    </div>
  );
}

import type { PresencePlayer } from "../lib/presence";
import type { ShareResult } from "../lib/share";

interface CompanionStripProps {
  /** Live players currently on this board (self excluded). */
  online: PresencePlayer[];
  /** Whether live presence is configured at all. */
  presenceEnabled: boolean;
  /** Async snapshot from a share link, if the user arrived via one. */
  friend: ShareResult | null;
  myQuartiles: number;
  myScore: number;
}

function gems(n: number) {
  const filled = Math.max(0, Math.min(5, n));
  return (
    <span className="strip__gems" aria-hidden>
      {"◆".repeat(filled)}
      <span className="strip__gems-empty">{"◇".repeat(5 - filled)}</span>
    </span>
  );
}

function ago(ts?: number): string {
  if (!ts) return "shared";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return "earlier";
}

export default function CompanionStrip({
  online,
  presenceEnabled,
  friend,
  myQuartiles,
  myScore,
}: CompanionStripProps) {
  // Don't double-show the async friend if they're currently online (match by name).
  const onlineNames = new Set(
    online.map((o) => o.name.trim().toLowerCase()).filter(Boolean),
  );
  const showAsyncFriend =
    friend && !(friend.n && onlineNames.has(friend.n.trim().toLowerCase()));

  const hasAnyone = online.length > 0 || showAsyncFriend;

  // Best companion score, for the verdict line.
  const bestScore = Math.max(
    ...online.map((o) => o.score),
    showAsyncFriend ? friend!.s : -1,
  );

  if (!hasAnyone) {
    if (!presenceEnabled) return null; // no link, no live layer → nothing to show
    return (
      <div className="strip strip--empty">
        <span className="strip__pulse strip__pulse--idle" />
        Share to invite a friend — you'll see them here the moment they join.
      </div>
    );
  }

  return (
    <div className="strip">
      {/* You */}
      <div className="strip__row strip__row--you">
        <span className="strip__name">You</span>
        {gems(myQuartiles)}
        <span className="strip__stat">
          {myQuartiles}/5 · {myScore} pts
        </span>
      </div>

      {/* Live players */}
      {online.map((p) => (
        <div className="strip__row" key={p.id}>
          <span className="strip__name">{p.name || "A friend"}</span>
          {gems(p.quartilesFound)}
          <span className="strip__live">
            <span className={`strip__pulse ${p.complete ? "strip__pulse--done" : ""}`} />
            {p.complete ? "finished" : "playing now"}
          </span>
          <span className="strip__stat">
            {p.quartilesFound}/5 · {p.score} pts
          </span>
        </div>
      ))}

      {/* Async snapshot (only when that friend isn't live) */}
      {showAsyncFriend && (
        <div className="strip__row strip__row--async" key="async">
          <span className="strip__name">{friend!.n?.trim() || "Your friend"}</span>
          {gems(friend!.q)}
          <span className="strip__seen">{ago(friend!.t)}</span>
          <span className="strip__stat">
            {friend!.q}/5 · {friend!.s} pts
          </span>
        </div>
      )}

      {bestScore >= 0 && (
        <div className="strip__verdict">
          {myScore > bestScore
            ? "You're ahead \u{1F525}"
            : myScore === bestScore
              ? "Neck and neck \u{1F91D}"
              : "Catch up!"}
        </div>
      )}
    </div>
  );
}

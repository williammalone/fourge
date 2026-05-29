import type { ShareResult } from "../lib/share";

interface FriendStripProps {
  friend: ShareResult;
  myQuartiles: number;
  myScore: number;
}

function gems(n: number) {
  return (
    <span className="strip__gems" aria-hidden>
      {"◆".repeat(Math.min(5, n))}
      <span className="strip__gems-empty">{"◇".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

export default function FriendStrip({ friend, myQuartiles, myScore }: FriendStripProps) {
  const name = friend.n?.trim() || "Your friend";
  const youAhead = myScore > friend.s;
  const tied = myScore === friend.s;
  return (
    <div className="strip">
      <div className="strip__row">
        <span className="strip__name">{name}</span>
        {gems(friend.q)}
        <span className="strip__stat">{friend.q}/5 · {friend.s} pts</span>
      </div>
      <div className="strip__row strip__row--you">
        <span className="strip__name">You</span>
        {gems(myQuartiles)}
        <span className="strip__stat">{myQuartiles}/5 · {myScore} pts</span>
      </div>
      <div className="strip__verdict">
        {tied ? "Neck and neck \u{1F91D}" : youAhead ? "You're ahead \u{1F525}" : `${name} is ahead — catch up!`}
      </div>
    </div>
  );
}

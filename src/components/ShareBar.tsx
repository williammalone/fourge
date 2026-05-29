import { useState } from "react";
import { buildShareText, buildShareUrl, type ShareResult } from "../lib/share";

interface ShareBarProps {
  result: ShareResult;
  streak: number;
  complete: boolean;
}

export default function ShareBar({ result, streak, complete }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(result);
  const text = buildShareText(result, streak, url);

  async function share() {
    const shareData = { title: "Fourge", text };
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your result:", text);
    }
  }

  return (
    <div className="share">
      <button type="button" className="btn btn--share" onClick={share}>
        {copied ? "Copied! ✓" : complete ? "Share your result \u{1F389}" : "Challenge a friend \u{1F517}"}
      </button>
      <p className="share__hint">
        Spoiler-free — your friend gets the <strong>same board</strong> and sees your score, never your words.
      </p>
    </div>
  );
}

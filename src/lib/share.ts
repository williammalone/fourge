// Spoiler-free sharing + the zero-backend async "shared lane".
//
// We never share the words themselves — only counts/score — so a friend who
// opens your link plays the SAME board (pinned by day) and sees how you did,
// without any answers being spoiled.

export interface ShareResult {
  /** Display name (optional). */
  n?: string;
  /** Day number (pins the friend to the same board). */
  d: number;
  /** Score. */
  s: number;
  /** Quartiles found (0-5). */
  q: number;
  /** Total words found. */
  w: number;
  /** Timestamp (epoch ms) when shared — for "played Xm ago". */
  t?: number;
}

// ---- URL-safe base64 -------------------------------------------------------
function b64encode(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64decode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeResult(r: ShareResult): string {
  return b64encode(JSON.stringify(r));
}

export function decodeResult(token: string): ShareResult | null {
  try {
    const obj = JSON.parse(b64decode(token));
    if (typeof obj.d !== "number" || typeof obj.s !== "number") return null;
    return obj as ShareResult;
  } catch {
    return null;
  }
}

/** Read a friend's result and the pinned day from the current URL. */
export function readFromUrl(search = window.location.search): {
  day: number | null;
  friend: ShareResult | null;
} {
  const params = new URLSearchParams(search);
  const d = params.get("d");
  const r = params.get("r");
  const friend = r ? decodeResult(r) : null;
  const day = d != null ? parseInt(d, 10) : friend ? friend.d : null;
  return { day: Number.isFinite(day as number) ? (day as number) : null, friend };
}

/** Build the shareable URL that pins the day and carries your result. */
export function buildShareUrl(result: ShareResult, origin = window.location.origin + window.location.pathname): string {
  const token = encodeResult(result);
  return `${origin}?d=${result.d}&r=${token}`;
}

/** The five-gem progress bar, spoiler-free. */
export function gemBar(quartilesFound: number): string {
  const filled = "\u{1F7EA}".repeat(Math.max(0, Math.min(5, quartilesFound)));
  const empty = "⬜".repeat(Math.max(0, 5 - quartilesFound));
  return filled + empty;
}

/** Build the Wordle-style share text (no words revealed). */
export function buildShareText(
  result: ShareResult,
  streak: number,
  url: string,
): string {
  const lines = [
    `Fourge #${result.d}`,
    `${gemBar(result.q)}  ${result.q}/5 fourges`,
    `⭐ ${result.s} pts · ${result.w} words${streak > 1 ? ` · \u{1F525} ${streak}` : ""}`,
    url,
  ];
  return lines.join("\n");
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Puzzle } from "../engine/types";
import { submit as validateSubmit } from "../engine/validate";
import { puzzleForDay } from "../lib/daily";
import { playerId, loadName, saveName } from "../lib/storage";
import { useCoop } from "../lib/useCoop";
import { playerColor, playerInitial } from "../lib/colors";
import Grid from "./Grid";
import WordTray from "./WordTray";

interface CoopGameProps {
  puzzles: Puzzle[];
  dict: Set<string>;
  roomId: string;
  todayDay: number;
}

const EMPTY = new Set<number>();

export default function CoopGame({ puzzles, dict, roomId, todayDay }: CoopGameProps) {
  const selfId = playerId();
  const [name, setName] = useState(loadName());
  const [selection, setSelection] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [trayStatus, setTrayStatus] = useState<"idle" | "shake">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const coop = useCoop({
    roomId,
    todayDay,
    self: { id: selfId, name },
    onFriendFourge: (who) => {
      flashToast(`${who} found a Fourge! 🟪`);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
    },
  });

  const puzzle: Puzzle | null =
    coop.day != null ? puzzleForDay(puzzles, coop.day) : null;

  useEffect(() => {
    if (puzzle && order.length === 0) setOrder(puzzle.tiles.map((_, i) => i));
  }, [puzzle, order.length]);

  const foundWordSet = useMemo(() => new Set(coop.found.map((f) => f.word)), [coop.found]);
  const score = coop.found.reduce((s, f) => s + f.points, 0);
  const quartiles = coop.found.filter((f) => f.isQuartile);
  const complete = quartiles.length >= 5;

  const toggleTile = useCallback(
    (idx: number) => {
      if (complete) return;
      setSelection((sel) => {
        if (sel.includes(idx)) return sel.filter((i) => i !== idx);
        if (sel.length >= 4) return sel;
        return [...sel, idx];
      });
    },
    [complete],
  );

  const doSubmit = useCallback(() => {
    if (!puzzle || selection.length === 0 || complete) return;
    const res = validateSubmit(puzzle, selection, dict, foundWordSet);
    if (!res.ok) {
      setTrayStatus("shake");
      window.setTimeout(() => setTrayStatus("idle"), 420);
      flashToast(
        res.reason === "already-found"
          ? "Already on the board"
          : res.reason === "not-a-word"
            ? "Not a word"
            : "Too short",
      );
      return;
    }
    const fw = res.found;
    coop.submit({
      word: fw.word,
      player_id: selfId,
      player_name: name || null,
      points: fw.points,
      is_quartile: fw.isQuartile,
    });
    if (fw.isQuartile) {
      flashToast(`Fourge! +8 — ${fw.word}`);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
    } else {
      flashToast(`+${fw.points}`);
    }
    setSelection([]);
  }, [puzzle, selection, complete, dict, foundWordSet, coop, selfId, name, flashToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") doSubmit();
      else if (e.key === "Backspace") setSelection((s) => s.slice(0, -1));
      else if (e.key === "Escape") setSelection([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSubmit]);

  const shuffle = useCallback(() => {
    setOrder((ord) => {
      const a = ord.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  }, []);

  function onNameChange(v: string) {
    setName(v);
    saveName(v);
  }

  async function shareRoom() {
    const url = `${window.location.origin}${window.location.pathname}?coop=${roomId}&d=${todayDay}`;
    const text = `Let's solve today's Fourge together 🤝\n${url}`;
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: "Fourge — Co-op", text });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      flashToast("Invite link copied!");
    } catch {
      window.prompt("Share this link:", url);
    }
  }

  if (!coop.enabled) {
    return (
      <div className="app app--center">
        <p>Co-op needs live mode configured. Falling back to solo — open the base link.</p>
      </div>
    );
  }
  if (!coop.ready || !puzzle) {
    return (
      <div className="app app--center">
        <div className="loader">
          <div className="loader__spin" />
          <p>Joining your team's board…</p>
        </div>
      </div>
    );
  }

  // Roster: me + everyone online, deduped by id.
  const roster = [
    { id: selfId, name: name || "You", you: true },
    ...coop.online.map((o) => ({ id: o.id, name: o.name, you: false })),
  ].filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i);

  return (
    <div className={`app ${flash ? "app--flash" : ""}`}>
      <header className="header">
        <div className="header__title">
          <img className="header__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={34} height={34} />
          <h1>Fourge</h1>
          <span className="header__day header__day--coop">co-op #{coop.day}</span>
        </div>
        <div className="header__score">
          <span className="score">{score}</span>
          <span className="score__label">team pts</span>
        </div>
      </header>

      {/* Team roster + presence */}
      <div className="team">
        {roster.map((p) => (
          <span className="team__chip" key={p.id} style={{ "--pc": playerColor(p.id) } as CSSProperties}>
            <span className="team__dot" />
            {p.name}
            {p.you ? " (you)" : ""}
          </span>
        ))}
        <button type="button" className="team__invite" onClick={shareRoom}>
          ＋ Invite
        </button>
      </div>

      {/* Shared Fourge gems, colored by finder */}
      <div className="gems">
        <div className="gems__label">
          Fourges <span className="gems__count">{quartiles.length}/5</span>{" "}
          <span className="gems__sub">— solve together</span>
        </div>
        <div className="gems__row">
          {Array.from({ length: 5 }).map((_, i) => {
            const q = quartiles[i];
            const color = q?.finderId ? playerColor(q.finderId) : undefined;
            return (
              <div
                key={i}
                className={`gem ${q ? "gem--filled gem--coop" : "gem--empty"}`}
                style={q ? ({ "--pc": color } as CSSProperties) : undefined}
              >
                {q ? <span className="gem__word">{q.word}</span> : <span className="gem__dot">◆</span>}
              </div>
            );
          })}
        </div>
      </div>

      <main className="board">
        <Grid tiles={puzzle.tiles} order={order} selection={selection} usedTiles={EMPTY} onTileClick={toggleTile} />
        <WordTray
          tiles={puzzle.tiles}
          selection={selection}
          status={trayStatus}
          onRemove={(idx) => setSelection((s) => s.filter((i) => i !== idx))}
          onClear={() => setSelection([])}
          onSubmit={doSubmit}
          onShuffle={shuffle}
        />
      </main>

      {toast && <div className="toast">{toast}</div>}

      {complete && (
        <div className="banner banner--coop">
          <h2>Solved together! 🔥</h2>
          <p>
            You + {roster.filter((p) => !p.you).map((p) => p.name).join(", ") || "your team"} forged all 5 — {score} team pts.
          </p>
        </div>
      )}

      <div className="name-row">
        <label htmlFor="coop-name">Your name (for your teammate)</label>
        <input
          id="coop-name"
          type="text"
          value={name}
          maxLength={16}
          placeholder="optional"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      {/* Shared found-words list with finder attribution */}
      <div className="found">
        <div className="found__head">
          On the board <span className="found__count">{coop.found.length}</span>
        </div>
        {coop.found.length === 0 ? (
          <p className="found__empty">Empty board — find the first word together.</p>
        ) : (
          <ul className="found__list">
            {[...coop.found]
              .sort((a, b) => b.points - a.points || a.word.localeCompare(b.word))
              .map((w) => (
                <li key={w.word} className="found__item">
                  <span
                    className="found__finder"
                    style={{ background: w.finderId ? playerColor(w.finderId) : "#888" }}
                    title={w.finderName || "teammate"}
                  >
                    {playerInitial(w.finderName, w.finderId ?? "?")}
                  </span>
                  <span className="found__word">{w.word}</span>
                  <span className="found__pts">+{w.points}</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <footer className="footer">
        <details>
          <summary>How co-op works</summary>
          <ul>
            <li>One <strong>shared board</strong> — words either of you find count for the team.</li>
            <li>Progress is <strong>saved</strong>: play across the day, refresh, come back — it's all here.</li>
            <li>Finish by finding all <strong>5 Fourges together</strong>.</li>
            <li>Tap <strong>Invite</strong> to bring in your teammate.</li>
          </ul>
        </details>
      </footer>
    </div>
  );
}

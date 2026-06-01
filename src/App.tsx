import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Puzzle } from "./engine/types";
import { loadDictionary } from "./engine/dictionary";
import { submit } from "./engine/validate";
import { dayNumber, puzzleForDay } from "./lib/daily";
import { readFromUrl, type ShareResult } from "./lib/share";
import { quartileHints } from "./engine/hints";
import {
  loadState,
  saveState,
  loadName,
  saveName,
  loadStreak,
  recordCompletion,
  introSeen,
  markIntroSeen,
  loadEasy,
  saveEasy,
  tutorialDone,
  markTutorialDone,
  recordPlayDay,
} from "./lib/storage";
import Grid from "./components/Grid";
import WordTray from "./components/WordTray";
import QuartileSlots from "./components/QuartileSlots";
import FoundWords from "./components/FoundWords";
import ShareBar from "./components/ShareBar";
import CompanionStrip from "./components/CompanionStrip";
import CoopGame from "./components/CoopGame";
import FourgeWordmark from "./components/FourgeWordmark";
import ThemeToggle from "./components/ThemeToggle";
import { usePresence } from "./lib/usePresence";
import type { PresenceState } from "./lib/presence";
import { coopConfigured, newRoomId } from "./lib/coop";

// Optional "support / tip" link. Set this to your Ko-fi or Buy Me a Coffee URL
// (e.g. "https://ko-fi.com/yourname") to show a Support button. Empty = hidden.
const SUPPORT_URL = "";

/** Read the co-op room id from the URL, if any. */
function coopRoomFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("coop");
  } catch {
    return null;
  }
}

type Phase = "loading" | "ready" | "error";

export default function App() {
  const coopRoom = coopRoomFromUrl();
  const [phase, setPhase] = useState<Phase>("loading");
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [day, setDay] = useState(0);
  const [friend, setFriend] = useState<ShareResult | null>(null);

  const [state, setState] = useState<GameState | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [trayStatus, setTrayStatus] = useState<"idle" | "shake">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [justFoundQuartile, setJustFoundQuartile] = useState<string | null>(null);
  const [name, setName] = useState<string>(loadName());
  const [streak, setStreak] = useState(loadStreak().count);
  const [boardFlash, setBoardFlash] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  // Count today toward the play tally before `easy` initializes, so loadEasy()'s
  // default ramp (easy on for a player's first few days) sees today's count.
  useState(() => recordPlayDay(dayNumber()));
  const [easy, setEasy] = useState(() => loadEasy());
  // Guided mode (easy): pick a Fourge and we walk you through its tiles, one at
  // a time. `guideWord` = the Fourge being guided; `coachStep` = 0-3 (which tile
  // to tap next) or 4 (tap Enter). `coachWrong` drives the escalating nudge.
  const [guideWord, setGuideWord] = useState<string | null>(null);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const [coachWrong, setCoachWrong] = useState(0);

  const toastTimer = useRef<number | undefined>(undefined);
  const coachStartedRef = useRef(false);

  const dismissIntro = useCallback(() => {
    markIntroSeen();
    setShowIntro(false);
  }, []);

  const toggleEasy = useCallback(() => {
    setEasy((on) => {
      const next = !on;
      saveEasy(next);
      if (!next) {
        // Turning easy off cancels any in-progress guide.
        setGuideWord(null);
        setCoachStep(null);
        setCoachWrong(0);
        setSelection([]);
      }
      return next;
    });
  }, []);

  // ---- Load assets + resolve today's puzzle --------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromUrl = readFromUrl();
        const resolvedDay = fromUrl.day ?? dayNumber();
        const [d, puzzlesRes] = await Promise.all([
          loadDictionary(),
          fetch(`${import.meta.env.BASE_URL}puzzles.json`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const puzzles = puzzlesRes as Puzzle[];
        const p = puzzleForDay(puzzles, resolvedDay);
        const saved = loadState(resolvedDay);
        const initial: GameState =
          saved ?? {
            day: resolvedDay,
            puzzleId: p.id,
            found: [],
            score: 0,
            quartilesFound: 0,
            complete: false,
            name: loadName() || undefined,
          };
        setDict(d);
        setPuzzles(puzzles);
        setPuzzle(p);
        setDay(resolvedDay);
        setFriend(fromUrl.friend);
        setState(initial);
        setOrder(p.tiles.map((_, i) => i));
        setStreak(loadStreak().count);
        setPhase("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const foundWordSet = useMemo(
    () => new Set(state?.found.map((f) => f.word) ?? []),
    [state],
  );
  // Tiles to dim: only those that helped form a completed Fourge. Smaller words
  // never dim their tiles, and dimmed tiles stay fully usable for other words.
  const usedTiles = useMemo(() => {
    const s = new Set<number>();
    state?.found.forEach((f) => {
      if (f.isQuartile) f.tiles.forEach((t) => s.add(t));
    });
    return s;
  }, [state]);

  // ---- Easy mode = guided mode ---------------------------------------------
  // Each Fourge's tile decomposition (the guide's data). With unique tiles the
  // decomposition is unambiguous, so a guide can light the exact next tile.
  const hints = useMemo(
    () => (puzzle ? quartileHints(puzzle) : []),
    [puzzle],
  );
  const unfoundHints = useMemo(
    () => hints.filter((h) => !foundWordSet.has(h.word)),
    [hints, foundWordSet],
  );
  // The Fourge currently being guided, and where we are in it.
  const coachTarget = useMemo(
    () => (guideWord ? hints.find((h) => h.word === guideWord) ?? null : null),
    [guideWord, hints],
  );
  const coaching = easy && coachStep != null && coachTarget != null;
  const coachTileIndex =
    coaching && coachStep! < 4 ? coachTarget!.tiles[coachStep!] : null;
  const coachEnter = coaching && coachStep === 4;

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  // ---- Live presence (no-op unless Supabase env keys are configured) -------
  const presenceState: PresenceState = {
    name,
    quartilesFound: state?.quartilesFound ?? 0,
    score: state?.score ?? 0,
    wordsFound: state?.found.length ?? 0,
    complete: state?.complete ?? false,
  };
  const { online: livePlayers, enabled: presenceEnabled } = usePresence({
    day,
    ready: phase === "ready" && !coopRoom, // co-op manages its own room presence
    state: presenceState,
    onFriendFourge: (p) => flashToast(`${p.name || "A friend"} found a Fourge! 🟪`),
  });

  // ---- Tile interactions ----------------------------------------------------
  const toggleTile = useCallback(
    (idx: number) => {
      if (!state || state.complete) return;
      // During the tutorial, only the highlighted tile advances the lesson.
      // A wrong tap pops open an (escalating) hint instead of doing nothing.
      if (coaching) {
        if (idx !== coachTileIndex) {
          setCoachWrong((w) => w + 1);
          return;
        }
        setCoachWrong(0);
        setSelection((sel) => (sel.includes(idx) ? sel : [...sel, idx]));
        setCoachStep((s) => (s == null ? s : s + 1));
        return;
      }
      // Dimmed (Fourge) tiles stay selectable — they're reusable for other words.
      setSelection((sel) => {
        if (sel.includes(idx)) return sel.filter((i) => i !== idx);
        if (sel.length >= 4) return sel; // max 4 tiles per word
        return [...sel, idx];
      });
    },
    [state, coaching, coachTileIndex],
  );

  const removeTile = useCallback(
    (idx: number) => {
      if (coaching) return; // don't let tutorial taps undo the guided word
      setSelection((sel) => sel.filter((i) => i !== idx));
    },
    [coaching],
  );

  const endGuide = useCallback(() => {
    markTutorialDone();
    setGuideWord(null);
    setCoachStep(null);
    setCoachWrong(0);
    setSelection([]);
  }, []);

  // Begin guiding a specific Fourge: light its first tile and walk tile by tile.
  const startGuide = useCallback((word: string) => {
    markTutorialDone();
    setGuideWord(word);
    setCoachStep(0);
    setCoachWrong(0);
    setSelection([]);
  }, []);

  const clear = useCallback(() => setSelection([]), []);

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

  const doSubmit = useCallback(() => {
    if (!state || !puzzle || !dict || state.complete) return;
    if (selection.length === 0) return;
    const res = submit(puzzle, selection, dict, foundWordSet);
    if (!res.ok) {
      setTrayStatus("shake");
      window.setTimeout(() => setTrayStatus("idle"), 420);
      const msg =
        res.reason === "already-found"
          ? "Already found"
          : res.reason === "not-a-word"
            ? "Not a word"
            : "Too short";
      flashToast(msg);
      return;
    }
    const fw = res.found;
    setState((prev) => {
      if (!prev) return prev;
      const found = [...prev.found, fw];
      const score = prev.score + fw.points;
      const quartilesFound = found.filter((f) => f.isQuartile).length;
      const complete = quartilesFound >= 5;
      const next: GameState = {
        ...prev,
        found,
        score,
        quartilesFound,
        complete,
        name: name || prev.name,
        // Sticky: once hints helped find a word, the game is flagged easy.
        easyUsed: prev.easyUsed || easy,
      };
      saveState(next);
      if (complete) {
        const s = recordCompletion(next.day);
        setStreak(s.count);
      }
      return next;
    });
    if (fw.isQuartile) {
      setJustFoundQuartile(fw.word);
      setBoardFlash(true);
      window.setTimeout(() => setBoardFlash(false), 900);
      window.setTimeout(() => setJustFoundQuartile(null), 1200);
      flashToast(coaching ? `🎉 ${fw.word} — forged! +8` : `Fourge! +8 — ${fw.word}`);
    } else {
      flashToast(`+${fw.points}`);
    }
    setSelection([]);
    if (coaching) endGuide(); // guided word submitted — done; pick another
  }, [state, puzzle, dict, selection, foundWordSet, flashToast, name, easy, coaching, endGuide]);

  // keyboard: Enter submits, Backspace removes last, Esc clears
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (coaching) {
        // Only let Enter through, and only at the final step — keep the lesson on rails.
        if (e.key === "Enter" && coachEnter) doSubmit();
        return;
      }
      if (e.key === "Enter") doSubmit();
      else if (e.key === "Backspace") setSelection((s) => s.slice(0, -1));
      else if (e.key === "Escape") setSelection([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSubmit, coaching, coachEnter]);

  // Auto-guide the first Fourge once, for a first-timer on a fresh board (right
  // after they dismiss the intro) so they discover the guide. Then they tap any
  // Fourge to guide the rest. Returning players never see it.
  useEffect(() => {
    if (coachStartedRef.current) return;
    if (phase !== "ready" || showIntro || !easy) return;
    if (tutorialDone() || !state || state.found.length > 0) return;
    const first = unfoundHints[0];
    if (!first) return;
    coachStartedRef.current = true;
    startGuide(first.word);
  }, [phase, showIntro, easy, unfoundHints, state, startGuide]);

  function onNameChange(v: string) {
    setName(v);
    saveName(v);
    setState((prev) => (prev ? { ...prev, name: v || undefined } : prev));
  }

  // ---- Render ---------------------------------------------------------------
  // Co-op mode: a shared room link takes over with its own screen.
  if (coopRoom && phase === "ready" && puzzles && dict) {
    return <CoopGame puzzles={puzzles} dict={dict} roomId={coopRoom} todayDay={dayNumber()} />;
  }
  if (phase === "loading") {
    return (
      <div className="app app--center">
        <div className="loader">
          <div className="loader__spin" />
          <p>Dealing today's board…</p>
        </div>
      </div>
    );
  }
  if (phase === "error" || !puzzle || !state) {
    return (
      <div className="app app--center">
        <p>Couldn't load the puzzle. Please refresh.</p>
      </div>
    );
  }

  const shareResult: ShareResult = {
    n: name || undefined,
    d: day,
    s: state.score,
    q: state.quartilesFound,
    w: state.found.length,
    e: state.easyUsed ? 1 : undefined,
  };

  return (
    <div className={`app ${boardFlash ? "app--flash" : ""}`}>
      {showIntro && (
        <div className="intro" role="dialog" aria-modal="true" aria-label="How to play Fourge" onClick={dismissIntro}>
          <div className="intro__card" onClick={(e) => e.stopPropagation()}>
            <div className="intro__logo">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={40} height={40} />
              <span>Fourge</span>
            </div>
            <p className="intro__lead">
              The tiles aren't letters — they're <strong>fragments</strong> of words.
              Snap them together to spell.
            </p>
            <div className="intro__demo" aria-hidden>
              <div className="intro__frags">
                <span className="intro__frag">MO</span>
                <span className="intro__plus">+</span>
                <span className="intro__frag">TOR</span>
                <span className="intro__plus">+</span>
                <span className="intro__frag">CY</span>
                <span className="intro__plus">+</span>
                <span className="intro__frag">CLE</span>
              </div>
              <div className="intro__arrow">↓</div>
              <div className="intro__result">MOTORCYCLE</div>
            </div>
            <ul className="intro__steps">
              <li><strong>Tap up to 4 tiles</strong> to build a word, then <strong>Enter</strong>.</li>
              <li>A <strong>4-tile word is a Fourge</strong> — 8 pts. Each board hides <strong>5</strong>.</li>
              <li>Tiles are <strong>reusable</strong>. Every valid English word scores.</li>
            </ul>
            <button
              type="button"
              className={`intro__easy ${easy ? "intro__easy--on" : ""}`}
              onClick={() => toggleEasy()}
              role="switch"
              aria-checked={easy}
            >
              <span className="intro__easy-text">
                <strong>💡 Easy mode</strong>
                <span className="intro__easy-sub">
                  {easy
                    ? "Tap a Fourge and we'll guide you tile by tile"
                    : "No hints — full challenge"}
                </span>
              </span>
              <span className={`easy-toggle__knob ${easy ? "easy-toggle__knob--on" : ""}`} aria-hidden />
            </button>
            <button type="button" className="btn btn--share intro__go" onClick={dismissIntro}>
              {friend ? "Take the challenge \u{2694}\u{FE0F}" : "Play today's Fourge \u{1F7EA}"}
            </button>
          </div>
        </div>
      )}
      <header className="header">
        <div className="header__title">
          <img className="header__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={34} height={34} />
          <FourgeWordmark />
          <span className="header__day">#{day}</span>
        </div>
        <div className="header__right">
          <div className="header__score">
            <span className="score">{state.score}</span>
            <span className="score__label">pts{streak > 1 ? ` · \u{1F525}${streak}` : ""}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {friend && !state.complete && state.found.length === 0 && (
        <div className="challenge" role="status">
          <span className="challenge__spark" aria-hidden>⚔️</span>
          <span className="challenge__text">
            <strong>{friend.n?.trim() || "A friend"}</strong> challenged you ·{" "}
            {friend.q === 5 ? "found all 5 fourges" : `${friend.q}/5 fourges`}
            {friend.e ? " 💡" : ""} ·{" "}
            <span className="challenge__target">beat {friend.s} pts</span>
          </span>
        </div>
      )}

      <CompanionStrip
        online={livePlayers}
        presenceEnabled={presenceEnabled}
        friend={friend}
        myQuartiles={state.quartilesFound}
        myScore={state.score}
      />

      <QuartileSlots
        quartiles={puzzle.quartiles}
        found={state.found}
        justFound={justFoundQuartile}
        easy={easy}
        guideWord={guideWord}
        onPick={startGuide}
      />

      {coaching ? (
        <div className="coach" role="status" aria-live="polite">
          <div className="coach__body">
            <p className="coach__lead">
              {coachStep! < 4 ? (
                <>Spell <strong>{coachTarget!.word.toUpperCase()}</strong> — one piece at a time.</>
              ) : (
                <>Nice — <strong>{coachTarget!.word.toUpperCase()}</strong> is ready!</>
              )}
            </p>
            <div className="coach__pieces" aria-hidden>
              {coachTarget!.tiles.map((tIdx, i) => (
                <span
                  key={i}
                  className={`coach__piece ${i < coachStep! ? "coach__piece--done" : i === coachStep! ? "coach__piece--now" : "coach__piece--todo"}`}
                >
                  {puzzle.tiles[tIdx]}
                </span>
              ))}
            </div>
            <p className="coach__step">
              {coachStep! < 4 ? (
                <>👇 Tap the glowing <strong>{puzzle.tiles[coachTileIndex!]}</strong> tile below</>
              ) : (
                <>👇 Now tap <strong>Enter</strong> to forge it</>
              )}
            </p>
            {coachWrong > 0 && (
              <div className="coach__nudge" key={coachWrong} role="alert">
                {coachStep! >= 4
                  ? "👇 Tap the Enter button below to forge your word."
                  : coachWrong === 1
                    ? "Not that tile — tap the one glowing gold 👆"
                    : `Tap “${puzzle.tiles[coachTileIndex!]}” — it's the gold glowing tile 👆`}
              </div>
            )}
          </div>
          <button type="button" className="coach__skip" onClick={endGuide}>
            Stop
          </button>
        </div>
      ) : (
        <>
          <div className="easy-row">
            <span className="easy-row__text">
              {easy ? "💡 Easy mode — guided" : "Hints off — full challenge"}
            </span>
            <button
              type="button"
              className={`easy-toggle ${easy ? "easy-toggle--on" : ""}`}
              onClick={toggleEasy}
              role="switch"
              aria-checked={easy}
              aria-label="Easy mode"
            >
              <span className="easy-toggle__knob" aria-hidden />
              <span className="easy-toggle__label">Easy</span>
            </button>
          </div>
          {easy && !state.complete && (
            <p className="easy-hint-note">
              👆 <strong>Tap a Fourge above</strong> — we'll walk you through its tiles, one tap at a time.
            </p>
          )}
        </>
      )}

      <main className="board">
        <Grid
          tiles={puzzle.tiles}
          order={order}
          selection={selection}
          usedTiles={usedTiles}
          coachTile={coachTileIndex}
          coachNudge={coachWrong > 0}
          coachNudgeKey={coachWrong}
          onTileClick={toggleTile}
        />
        <WordTray
          tiles={puzzle.tiles}
          selection={selection}
          status={trayStatus}
          coachEnter={coachEnter}
          onRemove={removeTile}
          onClear={clear}
          onSubmit={doSubmit}
          onShuffle={shuffle}
        />
      </main>

      {toast && <div className="toast">{toast}</div>}

      {state.complete && (
        <div className="banner">
          <h2>Solved! 🎉</h2>
          <p>
            All 5 fourges · {state.score} pts · {state.found.length} words
            {streak > 1 ? ` · \u{1F525} ${streak}-day streak` : ""}
          </p>
        </div>
      )}

      <div className="name-row">
        <label htmlFor="name">Your name (for sharing)</label>
        <input
          id="name"
          type="text"
          value={name}
          maxLength={16}
          placeholder="optional"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <ShareBar result={shareResult} streak={streak} complete={state.complete} />

      {coopConfigured && (
        <button
          type="button"
          className="btn btn--coop"
          onClick={() => {
            const id = newRoomId();
            window.location.href = `${window.location.pathname}?coop=${id}&d=${dayNumber()}`;
          }}
        >
          🤝 Play together (co-op)
        </button>
      )}

      <FoundWords found={state.found} />

      <footer className="footer">
        <details>
          <summary>How to play</summary>
          <ul>
            <li>Tap up to <strong>4 tiles</strong> to build a word, then <strong>Enter</strong>.</li>
            <li>1/2/3 tiles score 1/2/3 pts. A <strong>4-tile Fourge is 8 pts</strong>.</li>
            <li>Find all <strong>5 Fourges</strong> to solve. Tiles can be reused across words.</li>
            <li>Fourge tiles <strong>dim once found</strong> — but stay usable for smaller words (motorbike → bike).</li>
            <li><strong>💡 Easy mode</strong> glows each Fourge's starting tile and shows its first fragment — toggle it above the board.</li>
            <li>New puzzle every day. Same board for everyone.</li>
          </ul>
        </details>
        <nav className="footer__nav">
          {!state.complete && unfoundHints[0] && (
            <button
              type="button"
              className="footer__link"
              onClick={() => {
                if (!easy) {
                  setEasy(true);
                  saveEasy(true);
                }
                startGuide(unfoundHints[0].word);
              }}
            >
              💡 Guide me through a Fourge
            </button>
          )}
          <a href={`${import.meta.env.BASE_URL}archive/`}>Past puzzles →</a>
          {SUPPORT_URL && (
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              ♥ Support Fourge
            </a>
          )}
        </nav>
      </footer>
    </div>
  );
}

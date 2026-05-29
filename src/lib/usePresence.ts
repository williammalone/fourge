import { useEffect, useRef, useState } from "react";
import {
  joinPresence,
  presenceConfigured,
  type PresenceHandle,
  type PresencePlayer,
  type PresenceState,
} from "./presence";
import { playerId } from "./storage";

interface UsePresenceArgs {
  day: number;
  /** Only join once the puzzle is loaded. */
  ready: boolean;
  state: PresenceState;
  /** Called when another player's quartile count goes up (for a toast). */
  onFriendFourge?: (player: PresencePlayer) => void;
}

/**
 * Live roster of *other* players on today's board. Empty (and inert) when
 * presence isn't configured — the app then relies on the async strip.
 */
export function usePresence({ day, ready, state, onFriendFourge }: UsePresenceArgs): {
  online: PresencePlayer[];
  enabled: boolean;
} {
  const [online, setOnline] = useState<PresencePlayer[]>([]);
  const handleRef = useRef<PresenceHandle | null>(null);
  const prevCounts = useRef<Map<string, number>>(new Map());
  const onFourgeRef = useRef(onFriendFourge);
  onFourgeRef.current = onFriendFourge;

  // Keep the latest self-state available to the async join without re-joining.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Join once per day (after the puzzle is ready).
  useEffect(() => {
    if (!presenceConfigured || !ready) return;
    let cancelled = false;
    const id = playerId();

    joinPresence(day, id, stateRef.current, (others) => {
      // Detect fresh quartiles for a friendly toast.
      for (const p of others) {
        const prev = prevCounts.current.get(p.id) ?? 0;
        if (p.quartilesFound > prev && onFourgeRef.current) {
          onFourgeRef.current(p);
        }
        prevCounts.current.set(p.id, p.quartilesFound);
      }
      // Drop anyone who left.
      const liveIds = new Set(others.map((o) => o.id));
      for (const key of [...prevCounts.current.keys()]) {
        if (!liveIds.has(key)) prevCounts.current.delete(key);
      }
      setOnline(others);
    }).then((handle) => {
      if (cancelled) handle?.leave();
      else handleRef.current = handle;
    });

    return () => {
      cancelled = true;
      handleRef.current?.leave();
      handleRef.current = null;
      prevCounts.current.clear();
      setOnline([]);
    };
  }, [day, ready]);

  // Push my updated state whenever it changes.
  useEffect(() => {
    handleRef.current?.update(state);
  }, [state.name, state.quartilesFound, state.score, state.wordsFound, state.complete]);

  return { online, enabled: presenceConfigured };
}

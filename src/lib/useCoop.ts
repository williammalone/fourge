import { useEffect, useRef, useState } from "react";
import {
  coopConfigured,
  joinCoop,
  type CoopHandle,
  type CoopWord,
} from "./coop";
import type { PresencePlayer } from "./presence";
import type { FoundWord } from "../engine/types";

interface UseCoopArgs {
  roomId: string;
  todayDay: number;
  self: { id: string; name: string };
  /** Fired when the OTHER player lands a quartile (for a toast). */
  onFriendFourge?: (player_name: string) => void;
}

export interface CoopView {
  ready: boolean;
  enabled: boolean;
  day: number | null;
  found: FoundWord[];
  online: PresencePlayer[];
  submit: (w: CoopWord) => void;
}

function toFound(w: CoopWord): FoundWord {
  return {
    word: w.word,
    tiles: [],
    points: w.points,
    isQuartile: w.is_quartile,
    finderId: w.player_id,
    finderName: w.player_name ?? undefined,
  };
}

export function useCoop({ roomId, todayDay, self, onFriendFourge }: UseCoopArgs): CoopView {
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [words, setWords] = useState<CoopWord[]>([]);
  const [online, setOnline] = useState<PresencePlayer[]>([]);
  const handleRef = useRef<CoopHandle | null>(null);
  const seenQuartiles = useRef<Set<string>>(new Set());
  const onFourgeRef = useRef(onFriendFourge);
  onFourgeRef.current = onFriendFourge;
  const selfRef = useRef(self);
  selfRef.current = self;

  useEffect(() => {
    if (!coopConfigured || !roomId) return;
    let cancelled = false;

    joinCoop(roomId, selfRef.current, todayDay, {
      onWords: (all) => {
        // Toast when the OTHER player lands a fresh quartile.
        for (const w of all) {
          if (w.is_quartile && !seenQuartiles.current.has(w.word)) {
            seenQuartiles.current.add(w.word);
            if (w.player_id !== selfRef.current.id && onFourgeRef.current) {
              onFourgeRef.current(w.player_name ?? "A friend");
            }
          }
        }
        setWords(all);
      },
      onPresence: setOnline,
    }).then((res) => {
      if (cancelled) {
        res?.handle.leave();
        return;
      }
      if (res) {
        handleRef.current = res.handle;
        setDay(res.day);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      handleRef.current?.leave();
      handleRef.current = null;
      seenQuartiles.current.clear();
      setReady(false);
      setWords([]);
      setOnline([]);
    };
  }, [roomId, todayDay]);

  return {
    ready,
    enabled: coopConfigured,
    day,
    found: words.map(toFound),
    online,
    submit: (w) => handleRef.current?.submitWord(w),
  };
}

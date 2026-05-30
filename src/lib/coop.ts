// Co-op mode: ONE shared, durable board. Words found by either player are
// inserted into Postgres (so progress survives refreshes and late joins) and
// streamed to everyone via Realtime. Presence on the same channel shows who's
// online right now. Reuses the same Supabase project/key as live presence.

import type { PresencePlayer } from "./presence";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const coopConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** A found word as stored/shared in a co-op room. */
export interface CoopWord {
  word: string;
  player_id: string;
  player_name: string | null;
  points: number;
  is_quartile: boolean;
}

export interface CoopHandle {
  submitWord(w: CoopWord): Promise<void>;
  leave(): void;
}

export interface CoopCallbacks {
  onWords(all: CoopWord[]): void;
  onPresence(online: PresencePlayer[]): void;
}

/** Generate a short, unguessable room id. */
export function newRoomId(): string {
  const rnd = () => Math.random().toString(36).slice(2, 8);
  return `${rnd()}${rnd()}`.slice(0, 10);
}

/**
 * Join (creating if needed) a co-op room for `todayDay`. Returns a handle plus
 * the room's authoritative day (so both players load the same board), or null
 * if co-op isn't configured.
 */
export async function joinCoop(
  roomId: string,
  self: { id: string; name: string },
  todayDay: number,
  cb: CoopCallbacks,
): Promise<{ handle: CoopHandle; day: number } | null> {
  if (!coopConfigured) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  // Resolve the room's day (create the room on first visit).
  let day = todayDay;
  const existing = await client
    .from("coop_rooms")
    .select("day")
    .eq("id", roomId)
    .maybeSingle();
  if (existing.data && typeof existing.data.day === "number") {
    day = existing.data.day;
  } else {
    await client.from("coop_rooms").insert({ id: roomId, day: todayDay });
    // Re-read in case of a creation race; fall back to todayDay.
    const after = await client
      .from("coop_rooms")
      .select("day")
      .eq("id", roomId)
      .maybeSingle();
    day = after.data?.day ?? todayDay;
  }

  // Local merge of all known words (keyed by word for dedup).
  const words = new Map<string, CoopWord>();
  const emit = () => cb.onWords([...words.values()]);
  const add = (w: Partial<CoopWord> & { word?: string }) => {
    if (!w.word || words.has(w.word)) return;
    words.set(w.word, {
      word: w.word,
      player_id: w.player_id ?? "",
      player_name: w.player_name ?? null,
      points: w.points ?? 0,
      is_quartile: Boolean(w.is_quartile),
    });
  };

  // Existing words already on the board.
  const initial = await client
    .from("coop_found_words")
    .select("word, player_id, player_name, points, is_quartile")
    .eq("room_id", roomId);
  (initial.data ?? []).forEach(add);
  emit();

  const channel = client.channel(`coop:${roomId}`, {
    config: { presence: { key: self.id } },
  });

  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "coop_found_words", filter: `room_id=eq.${roomId}` },
    (payload) => {
      add(payload.new as CoopWord);
      emit();
    },
  );

  channel.on("presence", { event: "sync" }, () => {
    const raw = channel.presenceState() as Record<string, Array<Partial<PresencePlayer>>>;
    const online: PresencePlayer[] = [];
    for (const id of Object.keys(raw)) {
      if (id === self.id) continue;
      const m = raw[id][raw[id].length - 1] ?? {};
      online.push({
        id,
        name: typeof m.name === "string" ? m.name : "A friend",
        quartilesFound: m.quartilesFound ?? 0,
        score: m.score ?? 0,
        wordsFound: m.wordsFound ?? 0,
        complete: Boolean(m.complete),
      });
    }
    cb.onPresence(online);
  });

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: self.name, quartilesFound: 0, score: 0 }).then(() => resolve());
      }
    });
  });

  return {
    day,
    handle: {
      async submitWord(w: CoopWord) {
        add(w); // optimistic
        emit();
        const { error } = await client.from("coop_found_words").insert({
          room_id: roomId,
          word: w.word,
          player_id: w.player_id,
          player_name: w.player_name,
          points: w.points,
          is_quartile: w.is_quartile,
        });
        // Duplicate (already found by the other player) is fine — ignore.
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
          console.warn("coop insert error:", error.message);
        }
      },
      leave() {
        void channel.untrack();
        void client.removeChannel(channel);
      },
    },
  };
}

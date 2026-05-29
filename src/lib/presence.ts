// Live presence via Supabase Realtime — NO database, just an ephemeral channel.
//
// Spoiler-safe by construction: we only ever broadcast counts/score, never the
// words a player has found. The whole feature is gated on two env vars; with no
// keys present, `presenceConfigured` is false and the app falls back to the
// async companion strip with zero network calls (Supabase is dynamically
// imported, so it isn't even in the main bundle when disabled).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const presenceConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** What each player broadcasts. Counts only — never the actual words. */
export interface PresenceState {
  name: string;
  quartilesFound: number;
  score: number;
  wordsFound: number;
  complete: boolean;
}

export interface PresencePlayer extends PresenceState {
  id: string;
}

export interface PresenceHandle {
  update(state: PresenceState): void;
  leave(): void;
}

/**
 * Join the presence channel for a given day. Returns a handle to push updates
 * and leave, or null if presence isn't configured. `onSync` is called with the
 * list of *other* players currently online (self excluded) whenever it changes.
 */
export async function joinPresence(
  day: number,
  selfId: string,
  initial: PresenceState,
  onSync: (others: PresencePlayer[]) => void,
): Promise<PresenceHandle | null> {
  if (!presenceConfigured) return null;

  // Dynamic import keeps Supabase out of the main bundle when disabled.
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  const channel = client.channel(`fourge:${day}`, {
    config: { presence: { key: selfId } },
  });

  let current: PresenceState = initial;

  channel.on("presence", { event: "sync" }, () => {
    const raw = channel.presenceState() as Record<string, Array<Partial<PresenceState>>>;
    const others: PresencePlayer[] = [];
    for (const id of Object.keys(raw)) {
      if (id === selfId) continue;
      const metas = raw[id];
      const m = metas[metas.length - 1] ?? {};
      others.push({
        id,
        name: typeof m.name === "string" ? m.name : "A friend",
        quartilesFound: m.quartilesFound ?? 0,
        score: m.score ?? 0,
        wordsFound: m.wordsFound ?? 0,
        complete: Boolean(m.complete),
      });
    }
    onSync(others);
  });

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track(current).then(() => resolve());
      }
    });
  });

  return {
    update(state: PresenceState) {
      current = state;
      void channel.track(current);
    },
    leave() {
      void channel.untrack();
      void client.removeChannel(channel);
    },
  };
}

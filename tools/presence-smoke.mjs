// Direct Supabase Realtime Presence smoke test (no UI).
// Spins up TWO clients, joins the same `fourge:<day>` channel, tracks state,
// and verifies each sees the other. Proves the project + key + realtime work.
// Run: node tools/presence-smoke.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const DAY = 148; // any shared channel id
const CH = `fourge:${DAY}`;

function makeClient(label, selfId, name) {
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const channel = client.channel(CH, { config: { presence: { key: selfId } } });
  const seen = new Set();
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    for (const id of Object.keys(state)) {
      if (id !== selfId) seen.add(state[id]?.[0]?.name ?? id);
    }
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} subscribe timeout`)), 12000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(t);
        channel.track({ name, quartilesFound: 0, score: 0 }).then(() =>
          resolve({ client, channel, seen }),
        );
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(t);
        reject(new Error(`${label} status: ${status}`));
      }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  console.log(`Connecting two clients to channel "${CH}" ...`);
  const a = await makeClient("A", "alice-id", "Alice");
  const b = await makeClient("B", "bob-id", "Bob");
  await sleep(2500); // let presence sync settle
  console.log("Alice sees:", [...a.seen]);
  console.log("Bob sees:  ", [...b.seen]);
  const ok = a.seen.has("Bob") && b.seen.has("Alice");
  await a.channel.unsubscribe();
  await b.channel.unsubscribe();
  console.log(ok ? "\nPRESENCE OK ✓  both clients see each other" : "\nFAIL ✗  they did not see each other");
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(2);
}

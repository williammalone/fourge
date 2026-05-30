// Co-op DB smoke test — run AFTER applying supabase/coop.sql.
// Verifies: room insert, word insert, RLS/grants (select), and realtime feed.
// Run: node tools/coop-smoke.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const A = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const B = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const room = `smoke_${Math.random().toString(36).slice(2, 9)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = true;
const check = (label, ok, extra = "") => { console.log(`${ok ? "✓" : "✗"} ${label}${extra ? "  " + extra : ""}`); if (!ok) pass = false; };

try {
  // 1. create room
  const r1 = await A.from("coop_rooms").insert({ id: room, day: 148 });
  check("insert coop_rooms", !r1.error, r1.error?.message ?? "");

  // 2. insert a found word
  const w1 = await A.from("coop_found_words").insert({
    room_id: room, word: "testalpha", player_id: "a", player_name: "Alice", points: 3, is_quartile: false,
  });
  check("insert coop_found_words", !w1.error, w1.error?.message ?? "");

  // 3. read it back (RLS select + grant)
  const sel = await B.from("coop_found_words").select("word").eq("room_id", room);
  check("select words back", !sel.error && (sel.data ?? []).some((x) => x.word === "testalpha"), sel.error?.message ?? `got ${JSON.stringify(sel.data)}`);

  // 4. realtime: B subscribes, A inserts, B should receive
  let got = false;
  const ch = B.channel(`coop:${room}`);
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "coop_found_words", filter: `room_id=eq.${room}` },
    (p) => { if (p.new?.word === "testbeta") got = true; });
  await new Promise((res) => ch.subscribe((s) => s === "SUBSCRIBED" && res()));
  await sleep(800);
  await A.from("coop_found_words").insert({ room_id: room, word: "testbeta", player_id: "a", points: 2, is_quartile: false });
  await sleep(2500);
  check("realtime INSERT received", got);
  await ch.unsubscribe();

  console.log(pass ? "\nCO-OP DB OK ✓  (room/word insert, select, realtime all working)" : "\nFAIL ✗  see above — did you run supabase/coop.sql?");
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(2);
}

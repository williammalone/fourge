# Fourge — a daily word puzzle (Apple Quartiles–style)

**Fourge** is a daily word game: a 5×4 grid of 20 fragment tiles. Combine up to
4 tiles to spell words. The jackpot is a **Fourge** — a 4-tile word worth 8 pts —
and each board hides **5 of them**. Same board for everyone each day. Share with
a friend and play head-to-head. (You _forge_ four fragments into a word → a Fourge.)

## How it works

- **Daily, deterministic puzzle** — the board is chosen by the calendar date
  (`puzzles[daysSince(2026-01-01) % bankSize]`), so everyone who opens it on the
  same day gets the same 20 tiles. No server needed.
- **Full-dictionary scoring** — any valid English word you build from the tiles
  scores (1/2/3 tiles → 1/2/3 pts; a 4-tile word → 8 pts). Tiles are *reusable*
  across different words.
- **Spoiler-free async sharing** — finish (or stop anytime) and tap *Challenge a
  friend*. You get a Wordle-style result + a link. The link pins your friend to
  the **same board** and shows them your score & quartile count — never your
  words. Zero backend.

## Stack

- Vite + React + TypeScript, hand-written CSS (no UI framework)
- Dictionary: **ENABLE1** (~172k words), shipped as a static asset and validated
  entirely on the client
- Offline puzzle generator (`tools/generate.mjs`) — pure Node, no deps

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + lib unit tests (vitest)
npm run build      # typecheck + production build -> dist/
```

## Regenerate the puzzle bank

The generator needs two word lists in `/tmp` (download once):

```bash
curl -sL -o /tmp/enable1.txt https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
curl -sL -o /tmp/en_50k.txt   https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/en/en_50k.txt

npm run generate -- 120        # writes public/puzzles.json + public/dictionary.txt
```

The generator: picks 5 frequent source words → fragments each into 4 chunks of
2–4 letters (20 tiles) → a solver enumerates every ≤4-tile combination against
the dictionary → accepts only boards with **exactly 5** quartiles (rejects any
accidental 6th) and a fair spread of shorter words. A blocklist keeps slurs and
crude words from being *featured* as quartile answers (they still score if found).

## Live presence (optional)

See when an invited friend is **playing right now** — a pulsing "playing now"
indicator, their live quartile count, and a toast when they land a Fourge. It's
built on **Supabase Realtime Presence** — an ephemeral channel, *no database,
no tables, no migrations*. Only counts/score are broadcast, never the words.

It's an enhancement layered on the async strip: when keys are configured and a
friend is online you see them live; otherwise the strip gracefully shows their
last shared result (or nothing). The app works fully without it.

To enable:

1. Create a free project at https://supabase.com
2. Project Settings → API: copy the **Project URL** and the **anon/public key**
3. Local dev: put them in `.env` (see `.env.example`)
4. Deployed build: add both as GitHub Actions repository secrets
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — the deploy workflow injects
   them at build time. Re-run the workflow and presence goes live.

Caveats (by design): presence is best-effort (a closed tab lingers until the
heartbeat times out), and the anon key is public in the client — fine for a
play-with-friends game with no sensitive data.

## Roadmap (not built yet)

- **Durable history / leaderboard** — would add Supabase Postgres tables + RLS
  for persistent standings across days. Presence above is stateless; this isn't.

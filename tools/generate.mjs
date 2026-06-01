#!/usr/bin/env node
// Offline puzzle generator for the Quartiles clone.
// Pure Node, no dependencies. Run: node tools/generate.mjs [count]
//
// Algorithm (Winston's whiteboard, made concrete):
//   1. Load ENABLE1 as the validation dictionary.
//   2. Build a pool of candidate "quartile" source words: length 8-12, each
//      splittable into exactly 4 fragments of 2-4 letters. Bias toward
//      recognizable words by intersecting with the macOS system dictionary.
//   3. Seeded-randomly pick 5 source words -> 20 fragments.
//   4. SOLVER: enumerate every ordered selection of 1..4 DISTINCT tiles,
//      concatenate, test against the dictionary.
//   5. Gates: exactly 5 four-tile words (== our intended 5, no accidental 6th),
//      and a healthy number of shorter words so the board is fair.
//   6. Emit JSON: { id, tiles[20], quartiles[5], totalWords }.
//
// Tiles are REUSABLE across words (a fragment can feed many words) but each
// word uses distinct tile positions. The client validates live against the
// shipped dictionary, so we only ship tiles + the 5 quartiles + a word count.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ENABLE_PATH = "/tmp/enable1.txt";
const SYSTEM_DICT = "/usr/share/dict/words";
const FREQ_PATH = "/tmp/en_50k.txt";
const FREQ_TOP_N = 22000; // source words drawn from the N most frequent words
const OUT_DICT = path.join(ROOT, "public", "dictionary.txt");
const OUT_PUZZLES = path.join(ROOT, "public", "puzzles.json");

const COUNT = parseInt(process.argv[2] || "60", 10);

// ---- Seeded RNG (mulberry32) so generation is reproducible -----------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x51A57); // fixed seed: a stable calendar of puzzles
const randInt = (n) => Math.floor(rng() * n);
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Load dictionaries ------------------------------------------------------
function loadList(p) {
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w));
}

console.log("Loading ENABLE1 ...");
const enableWords = loadList(ENABLE_PATH).filter((w) => w.length >= 2);
const DICT = new Set(enableWords);
console.log(`  dictionary: ${DICT.size} words`);

// Frequency-ranked common words — used to bias source words toward
// recognizable quartiles. Validation still uses the full ENABLE1 dictionary.
let common = new Set();
try {
  const freq = fs
    .readFileSync(FREQ_PATH, "utf8")
    .split("\n")
    .map((line) => line.split(/\s+/)[0]?.trim().toLowerCase())
    .filter((w) => w && /^[a-z]+$/.test(w))
    .slice(0, FREQ_TOP_N);
  common = new Set(freq);
  console.log(`  frequency pool (for source bias): top ${common.size} words`);
} catch {
  try {
    common = new Set(loadList(SYSTEM_DICT));
    console.log(`  system dict (for source bias): ${common.size} words`);
  } catch {
    console.log("  no source-bias list; using ENABLE1 for source words too");
  }
}

// ---- Write the shipped dictionary (cleaned, sorted) ------------------------
fs.writeFileSync(OUT_DICT, enableWords.slice().sort().join("\n") + "\n");
console.log(`Wrote ${OUT_DICT} (${enableWords.length} words)`);

// ---- Build candidate source words + their fragmentations -------------------
// A source word must be length 8-12 and splittable into exactly 4 fragments
// each 2-4 chars. We enumerate all such fragmentations.
function fragmentations(word) {
  const L = word.length;
  const out = [];
  for (let a = 2; a <= 4; a++)
    for (let b = 2; b <= 4; b++)
      for (let c = 2; c <= 4; c++) {
        const d = L - a - b - c;
        if (d < 2 || d > 4) continue;
        out.push([
          word.slice(0, a),
          word.slice(a, a + b),
          word.slice(a + b, a + b + c),
          word.slice(a + b + c),
        ]);
      }
  return out;
}

// Words that should never be *featured* as a daily quartile answer. Players can
// still find them for points (full dictionary validation), but we won't put them
// on the board as one of the five highlighted goals of a shareable daily puzzle.
const BLOCKLIST = new Set([
  "fuck", "fucked", "fucker", "fucking", "shit", "shitted", "shitting",
  "bullshit", "asshole", "assholes", "bastard", "bastards", "bitch",
  "bitches", "bitching", "cunt", "cunts", "nigger", "niggers", "faggot",
  "faggots", "retard", "retards", "retarded", "whore", "whores", "slut",
  "sluts", "cocaine", "heroin", "rapist", "rapists", "molester",
  "homosexual", "homosexuals", "wetback", "wetbacks", "spastic",
]);

console.log("Building candidate source-word pool ...");
const candidates = [];
for (const w of enableWords) {
  if (w.length < 8 || w.length > 12) continue;
  if (BLOCKLIST.has(w)) continue; // never feature as a quartile answer
  if (common.size && !common.has(w)) continue; // bias to recognizable words
  const frags = fragmentations(w);
  if (frags.length) candidates.push({ word: w, frags });
}
console.log(`  candidate source words: ${candidates.length}`);

// ---- Solver: all valid words formable from a set of 20 tiles ---------------
// Ordered selection of 1..4 distinct tile indices, concatenated, tested.
function solve(tiles) {
  const n = tiles.length;
  const found = new Map(); // word -> tile count (best/longest doesn't matter; word counts once)
  const quartiles = new Set();

  // depth-first over distinct indices, up to length 4
  const used = new Array(n).fill(false);
  function recur(prefix, depth, startSet) {
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const w = prefix + tiles[i];
      used[i] = true;
      const k = depth + 1;
      if (DICT.has(w)) {
        const prev = found.get(w);
        if (prev === undefined || k < prev) found.set(w, k);
        if (k === 4) quartiles.add(w);
      }
      if (k < 4) recur(w, k, startSet);
      used[i] = false;
    }
  }
  recur("", 0, null);
  return { found, quartiles };
}

// ---- Generation loop --------------------------------------------------------
function pickFragmentation(c) {
  return c.frags[randInt(c.frags.length)];
}

function buildCandidatePuzzle() {
  // pick 5 distinct source words
  const chosen = [];
  const usedWords = new Set();
  let guard = 0;
  while (chosen.length < 5 && guard++ < 50) {
    const c = candidates[randInt(candidates.length)];
    if (usedWords.has(c.word)) continue;
    usedWords.add(c.word);
    chosen.push(c);
  }
  if (chosen.length < 5) return null;

  const tiles = [];
  const intended = [];
  for (const c of chosen) {
    const frag = pickFragmentation(c);
    tiles.push(...frag);
    intended.push(c.word);
  }
  if (tiles.length !== 20) return null;

  const { found, quartiles } = solve(tiles);

  // Gate 1: every intended quartile must be present (it is, by construction)
  for (const w of intended) if (!quartiles.has(w)) return null;
  // Gate 2: no accidental 6th quartile
  if (quartiles.size !== 5) return null;
  // Gate 3: fairness — enough shorter words to explore
  if (found.size < 18) return null;
  // Gate 4: tiles must NEVER repeat — every one of the 20 fragments is distinct.
  // (Two source words sharing a fragment, e.g. both yielding "PR", is rejected.)
  const uniqTiles = new Set(tiles.map((t) => t.toUpperCase()));
  if (uniqTiles.size !== 20) return null;

  return {
    tiles: shuffle(tiles).map((t) => t.toUpperCase()),
    quartiles: intended.slice().sort(),
    totalWords: found.size,
  };
}

console.log(`Generating ${COUNT} puzzles ...`);
const puzzles = [];
let attempts = 0;
const seenSignature = new Set();
while (puzzles.length < COUNT && attempts < COUNT * 4000) {
  attempts++;
  const p = buildCandidatePuzzle();
  if (!p) continue;
  const sig = p.quartiles.join("|");
  if (seenSignature.has(sig)) continue; // no duplicate puzzles
  seenSignature.add(sig);
  puzzles.push({ id: puzzles.length, ...p });
  if (puzzles.length % 10 === 0)
    console.log(`  ${puzzles.length}/${COUNT} (attempts: ${attempts})`);
}

console.log(`Done: ${puzzles.length} puzzles in ${attempts} attempts.`);
fs.writeFileSync(OUT_PUZZLES, JSON.stringify(puzzles, null, 0) + "\n");
console.log(`Wrote ${OUT_PUZZLES}`);

// Print a sample so we can eyeball quality
const sample = puzzles[0];
if (sample) {
  console.log("\nSample puzzle #0:");
  console.log("  tiles:", sample.tiles.join(" "));
  console.log("  quartiles:", sample.quartiles.join(", "));
  console.log("  total findable words:", sample.totalWords);
}

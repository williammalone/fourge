// Post-build SEO surface generator.
//
// Fourge is a free, Quartiles-style daily word game. Apple's "Quartiles" is
// paywalled behind Apple News+, so there's real, underserved search demand for
// a free version. This script turns every past daily puzzle into its own
// statically-rendered, indexable page (no answers revealed), plus an archive
// hub and a full sitemap — dozens of long-tail entry points that pull organic
// search traffic into the game every day, with zero backend.
//
// Runs after `vite build`, operating on dist/. Pure Node, no deps.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const SITE = "https://williammalone.github.io/fourge";
const OG_IMAGE = `${SITE}/og-image.png`;

const EPOCH_UTC = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

function dayToDate(day) {
  return new Date(EPOCH_UTC + day * DAY_MS);
}
function fmtDate(d) {
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function todayDay() {
  const n = new Date();
  const localMidnightUtc = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.floor((localMidnightUtc - EPOCH_UTC) / DAY_MS);
}
function puzzleIndex(day, total) {
  return ((day % total) + total) % total;
}

const SHARED_CSS = `
  :root{--bg:#0f1226;--panel:#1e2244;--panel2:#262b54;--ink:#eef0ff;--dim:#a6abda;--muted:#6f76ab;--accent:#7c5cff;--accent2:#5b8cff;--gold:#ffcd4d;--gold2:#f5a623}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 800px at 50% -10%,#20264f 0%,var(--bg) 55%);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.55}
  .wrap{max-width:640px;margin:0 auto;padding:28px 20px 60px}
  a{color:var(--accent2);text-decoration:none}
  a:hover{text-decoration:underline}
  .brand{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:800;margin-bottom:22px}
  .brand b{background:linear-gradient(120deg,var(--gold),#ffe49b);-webkit-background-clip:text;background-clip:text;color:transparent}
  .mark{width:36px;height:36px;border-radius:9px;background:linear-gradient(160deg,#20264f,#0f1226);display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:6px}
  .mark i{border-radius:3px;background:linear-gradient(160deg,var(--accent),var(--accent2))}
  .mark i.g{background:linear-gradient(160deg,#ffd86b,var(--gold2))}
  h1{font-size:30px;margin:0 0 6px}
  .sub{color:var(--dim);margin:0 0 20px}
  .card{background:linear-gradient(160deg,var(--panel),var(--panel2));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px 20px;margin:0 0 20px}
  .stats{display:flex;gap:22px;margin:8px 0 0;color:var(--dim);font-size:14px}
  .stats b{color:var(--gold);font-size:20px;display:block}
  .cta{display:inline-block;margin:18px 0 4px;background:linear-gradient(160deg,#46d39a,#37b985);color:#06281c;font-weight:800;font-size:17px;padding:13px 26px;border-radius:12px}
  .nav{display:flex;justify-content:space-between;gap:10px;margin:24px 0 0;font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:9px;margin:14px 0 0}
  .grid a{display:block;text-align:center;background:var(--panel);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:11px 6px;color:var(--ink);font-weight:700}
  .grid a:hover{border-color:var(--accent);text-decoration:none}
  footer{margin-top:34px;color:var(--muted);font-size:13px}
  footer a{color:var(--dim)}
`;

function head(title, desc, canonical) {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#0f1226"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="${canonical}"/>
<link rel="icon" type="image/svg+xml" href="${SITE}/favicon.svg"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${OG_IMAGE}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${OG_IMAGE}"/>
<style>${SHARED_CSS}</style>
</head><body><div class="wrap">
<a class="brand" href="${SITE}/"><span class="mark"><i></i><i class="g"></i><i></i><i></i></span><b>Fourge</b></a>`;
}

const BRAND_FOOTER = `<footer>
<p><strong>Fourge</strong> is a free, Quartiles-style daily word puzzle — a 5×4 grid of 20 letter-fragment tiles you forge into words to uncover the 5 hidden "fourges." A free alternative to Apple's Quartiles, playable in any browser with no app and no signup.</p>
<p><a href="${SITE}/">Play today's puzzle</a> · <a href="${SITE}/archive/">Puzzle archive</a></p>
</footer></div></body></html>`;

function puzzlePage(day, puzzle, latest) {
  const date = fmtDate(dayToDate(day));
  const title = `Fourge #${day} — free daily word puzzle (Quartiles-style)`;
  const desc = `Play Fourge puzzle #${day} from ${date}: a free Quartiles-style word game. Forge 20 fragment tiles into words and find the 5 hidden fourges. No app, no signup.`;
  const canonical = `${SITE}/p/${day}/`;
  const prev = day > 0 ? `<a href="${SITE}/p/${day - 1}/">← #${day - 1}</a>` : `<span></span>`;
  const next = day < latest ? `<a href="${SITE}/p/${day + 1}/">#${day + 1} →</a>` : `<a href="${SITE}/">Today's puzzle →</a>`;
  return `${head(title, desc, canonical)}
<h1>Fourge #${day}</h1>
<p class="sub">The free Quartiles-style daily word puzzle from ${date}.</p>
<div class="card">
  <p>Forge the 20 letter-fragment tiles into words. A four-tile word is a <strong>fourge</strong> (worth 8 points) — and this board hides exactly five of them. Every valid English word scores, and tiles are reusable.</p>
  <div class="stats">
    <span><b>5</b> hidden fourges</span>
    <span><b>${puzzle.totalWords}</b> words to find</span>
    <span><b>20</b> tiles</span>
  </div>
  <a class="cta" href="${SITE}/?d=${day}">▶ Play puzzle #${day}</a>
</div>
<div class="nav">${prev}${next}</div>
${BRAND_FOOTER}`;
}

function archivePage(days, latest) {
  const title = `Fourge puzzle archive — every free daily Quartiles-style word puzzle`;
  const desc = `Browse and play every past Fourge puzzle — a free, Quartiles-style daily word game. ${days.length} puzzles, all playable in your browser with no app and no signup.`;
  const canonical = `${SITE}/archive/`;
  const links = days
    .slice()
    .reverse()
    .map((d) => `<a href="${SITE}/p/${d}/">#${d}</a>`)
    .join("");
  return `${head(title, desc, canonical)}
<h1>Puzzle archive</h1>
<p class="sub">Every Fourge daily puzzle — a free, Quartiles-style word game. Pick any day and play.</p>
<p><a class="cta" href="${SITE}/">▶ Play today's puzzle (#${latest})</a></p>
<div class="grid">${links}</div>
${BRAND_FOOTER}`;
}

function sitemap(days) {
  const urls = [
    `${SITE}/`,
    `${SITE}/archive/`,
    ...days.map((d) => `${SITE}/p/${d}/`),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u}</loc><changefreq>${u.endsWith("/archive/") || u === SITE + "/" ? "daily" : "monthly"}</changefreq></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ---- run -------------------------------------------------------------------
const puzzles = JSON.parse(readFileSync(join(ROOT, "public", "puzzles.json"), "utf8"));
const today = todayDay();
const latest = Math.max(0, today - 1); // newest archived puzzle = yesterday
const days = [];
for (let d = 0; d <= latest; d++) days.push(d);

for (const d of days) {
  const p = puzzles[puzzleIndex(d, puzzles.length)];
  const dir = join(DIST, "p", String(d));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), puzzlePage(d, p, latest));
}

mkdirSync(join(DIST, "archive"), { recursive: true });
writeFileSync(join(DIST, "archive", "index.html"), archivePage(days, today));
writeFileSync(join(DIST, "sitemap.xml"), sitemap(days));

console.log(`[archive] generated ${days.length} puzzle pages + archive + sitemap (today=#${today})`);

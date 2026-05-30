// Rasterize the brand SVGs to the PNGs the app ships, using the system Chrome
// in headless mode (no extra dependencies). Run from the repo root:
//   node tools/render-assets.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const jobs = [
  { svg: "public/favicon.svg", out: "public/favicon-32.png", w: 32, h: 32 },
  { svg: "tools/icon-touch.svg", out: "public/apple-touch-icon.png", w: 180, h: 180 },
  { svg: "tools/icon-touch.svg", out: "public/icon-512.png", w: 512, h: 512 },
  { svg: "tools/og-image.svg", out: "public/og-image.png", w: 1200, h: 630 },
];

for (const j of jobs) {
  const svg = readFileSync(j.svg, "utf8");
  const html =
    `<!doctype html><meta charset="utf8">` +
    `<style>*{margin:0;padding:0}html,body{width:${j.w}px;height:${j.h}px;overflow:hidden;background:transparent}` +
    `svg{display:block;width:${j.w}px;height:${j.h}px}</style>${svg}`;
  const tmp = join(tmpdir(), `fourge-render-${j.w}x${j.h}.html`);
  writeFileSync(tmp, html);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${j.w},${j.h}`,
      `--screenshot=${resolve(j.out)}`,
      `file://${tmp}`,
    ],
    { stdio: "ignore" },
  );
  rmSync(tmp, { force: true });
  console.log(`rendered ${j.out} (${j.w}x${j.h})`);
}

// Deterministic per-player accent colors for co-op attribution.
// Each player gets a stable color + initial from their id, like handwriting.

const PALETTE = [
  "#ffb84d", // amber
  "#3fc7c7", // teal
  "#ff7a9c", // rose
  "#8a7bff", // violet
  "#6fd36f", // green
  "#ffd24d", // gold
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function playerColor(id: string): string {
  return PALETTE[hash(id) % PALETTE.length];
}

export function playerInitial(name: string | undefined, id: string): string {
  const n = (name ?? "").trim();
  if (n) return n[0]!.toUpperCase();
  return id.slice(0, 1).toUpperCase();
}

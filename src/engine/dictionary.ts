// Dictionary loader. The full ENABLE1 word list is shipped as a static asset
// and validated entirely on the client — no per-word server round-trips.

let cache: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

/** Build a dictionary Set from raw newline-separated text. */
export function parseDictionary(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split("\n")) {
    const w = line.trim().toLowerCase();
    if (w) set.add(w);
  }
  return set;
}

/** Load (and cache) the shipped dictionary. */
export async function loadDictionary(
  url = `${import.meta.env.BASE_URL}dictionary.txt`,
): Promise<Set<string>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`dictionary fetch failed: ${r.status}`);
      return r.text();
    })
    .then((text) => {
      cache = parseDictionary(text);
      return cache;
    });
  return loading;
}

/** For tests: inject a dictionary directly. */
export function setDictionaryForTesting(set: Set<string> | null): void {
  cache = set;
  loading = null;
}

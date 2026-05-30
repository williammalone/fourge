// Light / dark theme. Respects the OS preference until the player explicitly
// picks one, then persists that choice. Applied via a data-theme attribute on
// <html> (see the no-flash init script in index.html).

export type Theme = "light" | "dark";

const KEY = "fourge-theme";
export const THEME_COLOR: Record<Theme, string> = {
  light: "#f7f3e9",
  dark: "#14120e",
};

export function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** The theme in effect right now: the player's choice, else the OS preference. */
export function resolvedTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

/** Persist and apply an explicit choice. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore quota / private-mode errors */
  }
  applyTheme(theme);
}

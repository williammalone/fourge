import { useState } from "react";
import { resolvedTheme, setTheme, type Theme } from "../lib/theme";

/** Small header button that flips between light and dark, persisting the choice. */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "light" : resolvedTheme(),
  );

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

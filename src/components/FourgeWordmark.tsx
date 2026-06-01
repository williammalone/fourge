import { memo, useEffect, useMemo, useState, type CSSProperties, type ComponentType } from "react";

// The "Fourge" hero wordmark, drawn as a tegaki handwriting animation.
// tegaki (+ its font bundle, ~480KB) is lazy-loaded as a separate chunk, so the
// initial paint shows a lightweight, non-clipping gradient fallback and then
// upgrades to the self-drawing handwriting once loaded.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

interface FourgeWordmarkProps {
  /** Font size in px. */
  size?: number;
}

// Play the handwriting draw at 2.2× the bundled speed — snappier, and a fixed
// multiplier means the same deterministic draw time on every load. A stable
// module-level constant (not an inline object) so its reference never changes
// across renders; passing a fresh object would restart the draw on every parent
// re-render (which, with the score updating constantly, looked inconsistent).
const DRAW_TIME = { mode: "uncontrolled", speed: 2.2 } as const;

function FourgeWordmark({ size = 30 }: FourgeWordmarkProps) {
  const [lib, setLib] = useState<{ Renderer: AnyComponent; font: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("tegaki/react"), import("tegaki/fonts/caveat")])
      .then(([react, caveat]) => {
        if (cancelled) return;
        const font = (caveat as { default?: unknown }).default ?? caveat;
        setLib({ Renderer: react.TegakiRenderer as AnyComponent, font });
      })
      .catch(() => {
        /* keep the fallback if tegaki fails to load */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const style: CSSProperties = useMemo(
    () => ({ fontSize: size, color: "var(--gold-deep)", lineHeight: 1.05 }),
    [size],
  );

  // Escape hatch: ?wmstatic renders the finished wordmark with no animation
  // (used for reduced-motion-style static rendering and visual verification).
  const renderStatic =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("wmstatic");

  return (
    <h1 className="wordmark" aria-label="Fourge">
      {lib ? (
        <lib.Renderer
          as="span"
          font={lib.font}
          style={style}
          time={renderStatic ? "100%" : DRAW_TIME}
          aria-hidden
        >
          Fourge
        </lib.Renderer>
      ) : (
        <span className="wordmark__fallback" style={{ fontSize: size }} aria-hidden>
          Fourge
        </span>
      )}
    </h1>
  );
}

// Memoized: its only prop (`size`) is stable, so the wordmark never re-renders
// (and never restarts its draw) when the parent updates on score/tile changes.
export default memo(FourgeWordmark);

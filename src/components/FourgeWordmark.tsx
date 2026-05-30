import { useEffect, useState, type CSSProperties, type ComponentType } from "react";

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

export default function FourgeWordmark({ size = 30 }: FourgeWordmarkProps) {
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

  const style: CSSProperties = { fontSize: size, color: "var(--gold-deep)", lineHeight: 1.05 };
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
          time={renderStatic ? "100%" : undefined}
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

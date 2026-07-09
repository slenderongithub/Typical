"use client";

/**
 * Gooey SVG filter provider. Render once near the root, then apply
 * `style={{ filter: "url(#nolook-gooey)" }}` to a container whose children
 * should visually merge (used for playful CTA clusters).
 */
export function GooeyFilter() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none absolute size-0"
      aria-hidden
    >
      <defs>
        <filter id="nolook-gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.4" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}

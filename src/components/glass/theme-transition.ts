"use client";

/**
 * View Transitions API theme switch — a polygon reveal sweeping from the
 * top-left corner, no blur. Falls back to a plain apply() when the API is
 * unavailable (Firefox/Safari < VT support) or reduced motion is preferred.
 * Client-only: uses flushSync + document.startViewTransition + matchMedia.
 */

import { flushSync } from "react-dom";

const STYLE_ID = "theme-transition-styles";
const KEYFRAMES = "nolook-theme-reveal";

const TRANSITION_CSS = `
::view-transition-group(root) {
  animation-duration: 1.15s;
  animation-timing-function: var(--expo-out);
}
::view-transition-new(root) {
  animation-name: ${KEYFRAMES};
}
::view-transition-old(root) {
  animation: none;
  z-index: -1;
}
@keyframes ${KEYFRAMES} {
  from {
    clip-path: polygon(50% -71%, -50% 71%, -50% 71%, 50% -71%);
  }
  to {
    clip-path: polygon(50% -71%, -50% 71%, 50% 171%, 171% 50%);
  }
}
`;

/** Swap (replace, not append) the transition stylesheet so repeat calls stay idempotent. */
function injectTransitionStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = TRANSITION_CSS;
  document.head.appendChild(style);
}

/**
 * Run `apply` (e.g. `() => setTheme("dawn")`) inside a view transition with the
 * top-left polygon reveal. Plain synchronous apply when unsupported.
 */
export function startThemeTransition(apply: () => void): void {
  if (typeof document === "undefined") {
    apply();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => unknown;
  };
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (typeof doc.startViewTransition !== "function" || reduceMotion) {
    apply();
    return;
  }
  injectTransitionStyles();
  // flushSync forces React (next-themes' setTheme) to commit the new theme class
  // to the DOM synchronously inside the transition callback, so the View
  // Transition captures the *new* theme as its end state. Without it the sweep
  // animates the old theme over itself and the theme snaps in afterward.
  doc.startViewTransition(() => flushSync(apply));
}

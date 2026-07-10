/**
 * Integrity scoring — the penalty a camera-verified run pays for looking away
 * from the screen. Pure functions, no DOM: shared by the results screen, the
 * share card, and tests.
 *
 * Philosophy: raw WPM is a factual typing-speed measurement and is never
 * altered. The *verified score* is a separate metric that only exists when the
 * user opted into camera verification — it docks that WPM for every keyboard
 * glance so honesty is rewarded and looking down is not.
 */

import type { IntegrityStatus } from "@/lib/types";

export interface IntegrityPenaltyInput {
  integrity: IntegrityStatus;
  /** discrete "looked down at the keyboard" events */
  peekCount: number;
  /** total time spent looking down, ms */
  peekTotalMs: number;
  /** time the camera lost the face mid-test, ms */
  trackingLostMs: number;
}

/** Each discrete keyboard glance. */
const PER_PEEK = 0.06;
/** Each second spent looking down (compounds the per-peek hit). */
const PER_LOOKAWAY_SEC = 0.02;
/** Each second the face was lost — softer, it can be a camera hiccup. */
const PER_LOST_SEC = 0.015;
/** Never zero out a real run entirely, even for egregious looking-away. */
const MAX_PENALTY = 0.75;

/**
 * Fraction in `[0, MAX_PENALTY]` to dock from a camera-verified run for looking
 * away from the screen. Untracked runs (camera off) are never penalized — you
 * only get scored on integrity if you opted into being watched.
 */
export function integrityPenalty(r: IntegrityPenaltyInput): number {
  if (r.integrity === "untracked") return 0;
  const raw =
    PER_PEEK * r.peekCount +
    PER_LOOKAWAY_SEC * (r.peekTotalMs / 1000) +
    PER_LOST_SEC * (r.trackingLostMs / 1000);
  return Math.min(MAX_PENALTY, Math.max(0, raw));
}

/** The penalty as a whole-number percentage, for display. */
export function integrityPenaltyPct(r: IntegrityPenaltyInput): number {
  return Math.round(integrityPenalty(r) * 100);
}

/**
 * WPM after the looking-away penalty — the "verified score". Equal to the raw
 * WPM for a clean run, lower for an assisted one.
 */
export function verifiedWpm(wpm: number, r: IntegrityPenaltyInput): number {
  return Math.round(wpm * (1 - integrityPenalty(r)) * 100) / 100;
}

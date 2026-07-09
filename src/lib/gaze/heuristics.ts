/**
 * Gaze-integrity heuristics — honesty first: this is a HEAD-POSE + EYE-STATE
 * heuristic, not precise gaze-point tracking. We only estimate whether the
 * user is looking below the bottom edge of their screen (i.e. at the
 * keyboard), normalized against a per-user two-point calibration.
 *
 * Pure functions, no DOM — shared by the controller (main thread) and tests.
 */

import type { CalibrationData, GazeFrameResult } from "@/lib/types";

/**
 * Score how far below the screen the user appears to be looking.
 *
 * Direction-normalized so camera mounting / Euler sign conventions don't
 * matter: we only care about movement *from* the calibrated screen-center
 * pose *towards and past* the calibrated bottom-edge pose.
 *
 *   0   → at or above the calibrated bottom edge (still on screen)
 *   ≥ 1 → looking clearly below the screen bottom, i.e. at the keyboard
 *
 * Blink-hold: eyelid closure mimics the eyeLookDown blendshape, so while
 * `frame.eyeBlink > 0.6` we return `prevScore` unchanged — a blink must
 * never start (or end) a peek. Callers pass the previous frame's score.
 */
export function computeDownScore(
  frame: GazeFrameResult,
  cal: CalibrationData,
  prevScore = 0,
): number {
  if (frame.eyeBlink > 0.6) return prevScore;

  // sign of "downward" in this user's pitch axis
  const dir = Math.sign(cal.bottomPitch - cal.neutralPitch);

  const pitchScore =
    (dir * (frame.pitch - cal.bottomPitch)) /
    Math.max(6, dir * (cal.bottomPitch - cal.neutralPitch));

  const lookScore =
    (frame.eyeLookDown - cal.bottomLookDown) /
    Math.max(0.08, cal.bottomLookDown - cal.neutralLookDown);

  return Math.max(
    0,
    0.65 * Math.max(0, pitchScore) + 0.65 * Math.max(0, lookScore),
  );
}

/** Median of a sample window — robust to landmark jitter and outliers. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Hysteresis / debounce constants shared with the controller. */
export const DOWN_ENTER_SCORE = 1; // score ≥ 1 → candidate peek
export const DOWN_EXIT_SCORE = 0.7; // score < 0.7 → candidate recovery
export const DOWN_DEBOUNCE_MS = 400; // sustained look-down before "down"
export const UP_DEBOUNCE_MS = 300; // sustained recovery before peek ends
export const LOST_DEBOUNCE_MS = 600; // no face / low confidence before "lost"
export const MIN_CONFIDENCE = 0.5;

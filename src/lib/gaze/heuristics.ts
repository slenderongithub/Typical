/**
 * Gaze-integrity heuristics — honesty first: this is a HEAD-POSE + EYE-STATE
 * heuristic, not precise gaze-point tracking. We only estimate whether the
 * user is looking below the bottom edge of their screen (i.e. at the
 * keyboard), normalized against a per-user two-point calibration.
 *
 * Pure functions, no DOM — shared by the controller (main thread) and tests.
 */

import type { CalibrationData, GazeFrameResult } from "@/lib/types";

/** Minimum bottom-edge → keyboard spans, so a sloppy calibration can't make jitter fire. */
const MIN_PITCH_SPAN = 8; // degrees
const MIN_LOOK_SPAN = 0.1; // eyeLookDown units

/**
 * Score how far the user has moved from the calibrated screen-bottom pose
 * towards the calibrated keyboard pose. Head and eyes are scored separately
 * and the larger wins — touch typists peek with their eyes alone, others
 * nod their head, both count.
 *
 *   0   → at or above the screen's bottom edge (eyes on screen)
 *   1   → halfway from the bottom edge to the keyboard — the decision line
 *   2   → at the calibrated keyboard pose
 *
 * Direction-normalized against the center → keyboard pitch delta, so camera
 * mounting / Euler sign conventions don't matter.
 */
export function computeDownScore(
  frame: GazeFrameResult,
  cal: CalibrationData,
): number {
  // sign of "downward" in this user's pitch axis
  const dir = Math.sign(cal.keyboardPitch - cal.neutralPitch) || 1;

  const pitchT =
    (dir * (frame.pitch - cal.bottomPitch)) /
    Math.max(MIN_PITCH_SPAN, dir * (cal.keyboardPitch - cal.bottomPitch));

  const lookT =
    (frame.eyeLookDown - cal.bottomLookDown) /
    Math.max(MIN_LOOK_SPAN, cal.keyboardLookDown - cal.bottomLookDown);

  return Math.max(0, 2 * pitchT, 2 * lookT);
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

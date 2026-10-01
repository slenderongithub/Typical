/**
 * Gaze-integrity classifier — honesty first: this is HEAD-POSE + EYE-DIRECTION
 * classification, not precise gaze-point tracking. The only question asked is
 * "eyes on the screen, or on the keyboard?", answered by a tiny per-user
 * logistic regression trained on the calibration frames.
 *
 * Pure functions, no DOM — shared by the controller (main thread) and tests.
 */

import type { CalibrationData, GazeFrameResult } from "@/lib/types";

/** Feature vector for one frame. Order is load-bearing — matches MIN_SCALE. */
export function gazeFeatures(f: GazeFrameResult): number[] {
  return [
    f.pitch,
    f.irisDownL,
    f.irisDownR,
    f.lookDownL,
    f.lookDownR,
    f.lookUpL,
    f.lookUpR,
  ];
}

/**
 * Floor on each feature's standardization scale — a feature that barely moved
 * during calibration must not turn later jitter into a huge z-score.
 * Calibration knob: degrees, eye-widths, blendshape units.
 */
const MIN_SCALE = [2, 0.02, 0.02, 0.05, 0.05, 0.05, 0.05];
const MIN_FRAMES_PER_CLASS = 8;
const L2 = 0.01;
const LEARNING_RATE = 0.5;
const ITERATIONS = 500;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Fit a class-balanced, L2-regularized logistic regression by batch gradient
 * descent. ~150 frames × 7 features — trains in well under a millisecond.
 */
export function trainGaze(x: number[][], y: number[]): CalibrationData {
  const n = x.length;
  const d = MIN_SCALE.length;
  const pos = y.filter((v) => v === 1).length;
  const neg = n - pos;
  const valid = pos >= MIN_FRAMES_PER_CLASS && neg >= MIN_FRAMES_PER_CLASS;
  if (!valid) {
    return { weights: Array(d).fill(0), bias: 0, mean: Array(d).fill(0), scale: [...MIN_SCALE], valid };
  }

  const mean = MIN_SCALE.map((_, j) => x.reduce((a, r) => a + r[j], 0) / n);
  const scale = MIN_SCALE.map((min, j) =>
    Math.max(min, Math.sqrt(x.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / n)),
  );
  const z = x.map((r) => r.map((v, j) => (v - mean[j]) / scale[j]));
  // each class carries half the total weight, however many frames it has
  const sw = y.map((v) => (v === 1 ? n / (2 * pos) : n / (2 * neg)));

  const w = Array(d).fill(0);
  let b = 0;
  for (let it = 0; it < ITERATIONS; it++) {
    const gw = w.map((wj) => L2 * wj);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const err = sw[i] * (sigmoid(b + dot(w, z[i])) - y[i]);
      for (let j = 0; j < d; j++) gw[j] += (err * z[i][j]) / n;
      gb += err / n;
    }
    for (let j = 0; j < d; j++) w[j] -= LEARNING_RATE * gw[j];
    b -= LEARNING_RATE * gb;
  }
  return { weights: w, bias: b, mean, scale, valid };
}

/** Probability (0–1) that this frame is a look at the keyboard. */
export function keyboardProbability(
  frame: GazeFrameResult,
  cal: CalibrationData,
): number {
  const f = gazeFeatures(frame);
  let logit = cal.bias;
  for (let j = 0; j < f.length; j++) {
    logit += (cal.weights[j] * (f[j] - cal.mean[j])) / cal.scale[j];
  }
  return sigmoid(logit);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Hysteresis / debounce constants shared with the controller. */
export const DOWN_ENTER_SCORE = 0.8; // P(keyboard) ≥ 0.8 → candidate peek
export const DOWN_EXIT_SCORE = 0.5; // P(keyboard) < 0.5 → candidate recovery
export const DOWN_DEBOUNCE_MS = 400; // sustained look-down before "down"
export const UP_DEBOUNCE_MS = 300; // sustained recovery before peek ends
export const LOST_DEBOUNCE_MS = 600; // no face / low confidence before "lost"
export const MIN_CONFIDENCE = 0.5;

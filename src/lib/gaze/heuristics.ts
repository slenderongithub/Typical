/**
 * Gaze-integrity classifier — honesty first: this is HEAD-POSE + EYE-DIRECTION
 * classification, not precise gaze-point tracking. The only question asked is
 * "eyes on the screen, or on the keyboard?", answered by a tiny per-user
 * logistic regression trained on the calibration frames.
 *
 * Pure functions, no DOM — shared by the controller (main thread), the
 * calibration overlay, and tests.
 */

import type { CalibrationData, GazeFrameResult } from "@/lib/types";

/** Column names for `gazeFeatures()` — used by the gaze-lab CSV export. */
export const FEATURE_NAMES = [
  "pitch",
  "yaw",
  "irisDownL",
  "irisDownR",
  "lookDownL",
  "lookDownR",
  "lookUpL",
  "lookUpR",
  "openL",
  "openR",
];

/** Feature vector for one frame. Order is load-bearing — matches MIN_SCALE. */
export function gazeFeatures(f: GazeFrameResult): number[] {
  return [
    f.pitch,
    f.yaw,
    f.irisDownL,
    f.irisDownR,
    f.lookDownL,
    f.lookDownR,
    f.lookUpL,
    f.lookUpR,
    f.openL,
    f.openR,
  ];
}

/**
 * Floor on each feature's standardization scale — a feature that barely moved
 * during calibration must not turn later jitter into a huge z-score.
 * Calibration knob: degrees, eye-widths, blendshape units, eye-widths.
 */
const MIN_SCALE = [2, 2, 0.02, 0.02, 0.05, 0.05, 0.05, 0.05, 0.02, 0.02];
const MIN_FRAMES_PER_CLASS = 8;
const L2 = 0.01;
const LEARNING_RATE = 0.5;
const ITERATIONS = 500;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Fit a class-balanced, L2-regularized logistic regression by batch gradient
 * descent. A few hundred frames × 10 features — trains in a few milliseconds.
 */
export function trainGaze(x: number[][], y: number[]): CalibrationData {
  const n = x.length;
  const d = MIN_SCALE.length;
  const pos = y.filter((v) => v === 1).length;
  const neg = n - pos;
  const valid = pos >= MIN_FRAMES_PER_CLASS && neg >= MIN_FRAMES_PER_CLASS;
  const zeros = () => Array<number>(d).fill(0);
  if (!valid) {
    return { weights: zeros(), bias: 0, mean: zeros(), scale: [...MIN_SCALE], screenMean: zeros(), valid };
  }

  const colMean = (rows: number[][]) =>
    MIN_SCALE.map((_, j) => rows.reduce((a, r) => a + r[j], 0) / rows.length);
  const mean = colMean(x);
  const screenMean = colMean(x.filter((_, i) => y[i] === 0));
  const scale = MIN_SCALE.map((min, j) =>
    Math.max(min, Math.sqrt(x.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / n)),
  );
  const z = x.map((r) => r.map((v, j) => (v - mean[j]) / scale[j]));
  // each class carries half the total weight, however many frames it has
  const sw = y.map((v) => (v === 1 ? n / (2 * pos) : n / (2 * neg)));

  const w = zeros();
  let b = 0;
  for (let it = 0; it < ITERATIONS; it++) {
    const gw = w.map((wj) => L2 * wj);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let logit = b;
      for (let j = 0; j < d; j++) logit += w[j] * z[i][j];
      const err = sw[i] * (sigmoid(logit) - y[i]);
      for (let j = 0; j < d; j++) gw[j] += (err * z[i][j]) / n;
      gb += err / n;
    }
    for (let j = 0; j < d; j++) w[j] -= LEARNING_RATE * gw[j];
    b -= LEARNING_RATE * gb;
  }
  return { weights: w, bias: b, mean, scale, screenMean, valid };
}

/**
 * Probability (0–1) that a feature vector is a look at the keyboard. `drift`
 * is the posture correction from `updateDrift` — subtracted before scoring.
 */
export function keyboardProbability(
  f: number[],
  cal: CalibrationData,
  drift?: number[],
): number {
  let logit = cal.bias;
  for (let j = 0; j < f.length; j++) {
    const v = f[j] - (drift?.[j] ?? 0);
    logit += (cal.weights[j] * (v - cal.mean[j])) / cal.scale[j];
  }
  return sigmoid(logit);
}

/* ── runtime smoothing + posture drift ─────────────────────────────── */

/** EMA weight on the previous score — ~3-frame smoothing against flicker. */
export const SMOOTHING = 0.5;
export const smooth = (prev: number, p: number) =>
  SMOOTHING * prev + (1 - SMOOTHING) * p;

/** Only frames this confidently on-screen may move the posture baseline. */
export const DRIFT_UPDATE_BELOW = 0.2;
/** Per-frame EMA rate (~40s time constant at 12.5fps). */
const DRIFT_RATE = 0.002;
/** Max correction per feature, in scale units — caps any slow-creep exploit. */
const DRIFT_MAX = 1.5;

/**
 * Track how the user's on-screen pose has moved since calibration (slouching,
 * leaning back). Returns the new drift vector; call only on confident
 * on-screen frames so the baseline can never be trained toward the keyboard.
 */
export function updateDrift(
  drift: number[],
  f: number[],
  cal: CalibrationData,
): number[] {
  return drift.map((dj, j) => {
    const next = dj + DRIFT_RATE * (f[j] - cal.screenMean[j] - dj);
    const cap = DRIFT_MAX * cal.scale[j];
    return Math.max(-cap, Math.min(cap, next));
  });
}

/* ── calibration fit + self-validation ─────────────────────────────── */

export type CalStepKind = "sweep" | "keys" | "type" | "drill";

export interface CalSample {
  f: number[];
  label: 0 | 1;
  kind: CalStepKind;
  /** ms timestamp — validation needs real durations */
  ts: number;
  /** drill glance index for keyboard-labelled drill frames, else -1 */
  glance: number;
}

/** Did the smoothed score stay ≥ the enter line for a full debounce window? */
function sustained(rows: CalSample[], cal: CalibrationData): boolean {
  let score = 0;
  let since = -1;
  for (let i = 0; i < rows.length; i++) {
    const p = keyboardProbability(rows[i].f, cal);
    score = i === 0 ? p : smooth(score, p);
    if (score >= DOWN_ENTER_SCORE) {
      if (since < 0) since = rows[i].ts;
      if (rows[i].ts - since >= DOWN_DEBOUNCE_MS) return true;
    } else {
      since = -1;
    }
  }
  return false;
}

/**
 * Train on the screen sweep + keyboard sweep + typing, then test that model
 * on the glance drill before trusting it. Typing frames the first model is
 * already sure are glances were real peeks, so they're not taught as
 * "screen". A passing fit is retrained on everything, drill included.
 */
export function fitCalibration(samples: CalSample[]): {
  cal: CalibrationData;
  problem: string | null;
} {
  const train = (rows: CalSample[]) =>
    trainGaze(rows.map((r) => r.f), rows.map((r) => r.label));
  const of = (kind: CalStepKind) => samples.filter((s) => s.kind === kind);

  const base = [...of("sweep"), ...of("keys")];
  const first = train(base);
  if (!first.valid) {
    return { cal: first, problem: "couldn't see your face clearly — check your lighting" };
  }
  const typing = of("type");
  const model = train([
    ...base,
    ...typing.filter((s) => keyboardProbability(s.f, first) < 0.9),
  ]);

  const drill = of("drill");
  const glances = Math.max(-1, ...drill.map((s) => s.glance)) + 1;
  let caught = 0;
  for (let g = 0; g < glances; g++) {
    if (sustained(drill.filter((s) => s.glance === g), model)) caught++;
  }
  // on-screen drill frames, split into runs wherever a glance cut them apart
  const drillScreenRuns: CalSample[][] = [];
  for (const s of drill.filter((r) => r.label === 0)) {
    const last = drillScreenRuns.at(-1);
    if (last && s.ts - last[last.length - 1].ts < 300) last.push(s);
    else drillScreenRuns.push([s]);
  }
  if (sustained(typing, model) || drillScreenRuns.some((r) => sustained(r, model))) {
    return { cal: model, problem: "it saw a glance while your eyes were up — keep them on the screen and try again" };
  }
  if (glances > 0 && caught < glances - 1) {
    return { cal: model, problem: "it missed your glances — look all the way down at the keys" };
  }
  return { cal: train([...base, ...typing, ...drill]), problem: null };
}

/** Hysteresis / debounce constants shared with the controller. */
export const DOWN_ENTER_SCORE = 0.8; // P(keyboard) ≥ 0.8 → candidate peek
export const DOWN_EXIT_SCORE = 0.5; // P(keyboard) < 0.5 → candidate recovery
export const DOWN_DEBOUNCE_MS = 400; // sustained look-down before "down"
export const UP_DEBOUNCE_MS = 300; // sustained recovery before peek ends
export const LOST_DEBOUNCE_MS = 600; // no face / low confidence before "lost"
export const MIN_CONFIDENCE = 0.5;

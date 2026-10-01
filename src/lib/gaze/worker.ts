/**
 * Gaze worker — runs MediaPipe FaceLandmarker off the main thread.
 *
 * Module Web Worker: created by GazeController via
 * `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`.
 * No DOM access in here. All assets are local (wasm + model paths arrive in
 * the init message), so nothing is ever fetched from a third party and no
 * pixel data leaves the browser — frames arrive as transferred ImageBitmaps
 * and are closed as soon as they are processed.
 */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type {
  Category,
  FaceLandmarkerResult,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { GazeWorkerRequest, GazeWorkerResponse } from "@/lib/types";

/** tsconfig lib is DOM-only; type the worker global surface we actually use. */
const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<GazeWorkerRequest>) => void) | null;
  postMessage(message: GazeWorkerResponse): void;
  close(): void;
};

let landmarker: FaceLandmarker | null = null;
let initializing = false;
/** detectForVideo requires strictly increasing timestamps. */
let lastVideoTs = 0;

async function createLandmarker(
  wasmBase: string,
  modelPath: string,
  delegate: "GPU" | "CPU",
): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

async function handleInit(wasmBase: string, modelPath: string): Promise<void> {
  if (landmarker || initializing) return;
  initializing = true;
  try {
    try {
      landmarker = await createLandmarker(wasmBase, modelPath, "GPU");
    } catch {
      // GPU delegate can fail in workers without WebGL — CPU handles 12fps fine.
      landmarker = await createLandmarker(wasmBase, modelPath, "CPU");
    }
    ctx.postMessage({ type: "ready" });
  } catch (err) {
    ctx.postMessage({
      type: "error",
      message:
        err instanceof Error ? err.message : "failed to load the face model",
    });
  } finally {
    initializing = false;
  }
}

/**
 * Extract Euler angles (degrees) from the rotation block of the column-major
 * 4x4 facial transformation matrix. Absolute sign conventions are not
 * load-bearing — heuristics.ts direction-normalizes against calibration —
 * but we flip pitch so "positive = head tilted downward" matches the
 * GazeFrameResult doc for typical MediaPipe camera setups.
 */
function eulerFromColumnMajor(d: number[]): {
  pitch: number;
  yaw: number;
  roll: number;
} {
  const el = (row: number, col: number) => d[col * 4 + row];
  const r00 = el(0, 0);
  const r10 = el(1, 0);
  const r20 = el(2, 0);
  const toDeg = 180 / Math.PI;
  const sy = Math.hypot(r00, r10);
  let pitch: number;
  let roll: number;
  if (sy > 1e-6) {
    pitch = Math.atan2(el(2, 1), el(2, 2));
    roll = Math.atan2(r10, r00);
  } else {
    // gimbal lock — pitch from the alternate block, roll indeterminate
    pitch = Math.atan2(-el(1, 2), el(1, 1));
    roll = 0;
  }
  const yaw = Math.atan2(-r20, sy);
  return { pitch: -pitch * toDeg, yaw: yaw * toDeg, roll: roll * toDeg };
}

/** Score of the named blendshape category (0 when absent). */
function blend(categories: Category[] | undefined, name: string): number {
  return categories?.find((c) => c.categoryName === name)?.score ?? 0;
}

/** Pixel-space point for a landmark — keeps the eye geometry isotropic. */
const px = (lm: NormalizedLandmark[], i: number, w: number, h: number) => ({
  x: lm[i].x * w,
  y: lm[i].y * h,
});

/** Lid gap (upper → lower lid) ÷ eye width (corner → corner). */
function eyeOpen(
  lm: NormalizedLandmark[],
  cornerA: number,
  cornerB: number,
  upper: number,
  lower: number,
  w: number,
  h: number,
): number {
  const a = px(lm, cornerA, w, h);
  const b = px(lm, cornerB, w, h);
  const u = px(lm, upper, w, h);
  const l = px(lm, lower, w, h);
  return Math.hypot(u.x - l.x, u.y - l.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
}

/**
 * How far the iris centre sits below the line through the eye's two corners,
 * in eye-widths. Corners are fixed to the skull, so this isolates eye
 * rotation from head pose, and measuring perpendicular to the corner line
 * cancels head roll. Pixel space (w×h) keeps the geometry isotropic.
 */
function irisDown(
  lm: NormalizedLandmark[],
  cornerA: number,
  cornerB: number,
  iris: number,
  w: number,
  h: number,
): number {
  const p = (i: number) => px(lm, i, w, h);
  let a = p(cornerA);
  let b = p(cornerB);
  if (b.x < a.x) [a, b] = [b, a];
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = Math.hypot(vx, vy) || 1;
  const c = p(iris);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // (-vy, vx) is the corner line's normal pointing down in image space
  return ((c.x - mx) * -vy + (c.y - my) * vx) / (len * len);
}

function handleFrame(bitmap: ImageBitmap, timestamp: number): void {
  if (!landmarker) {
    bitmap.close();
    return;
  }
  const { width, height } = bitmap;
  let result: FaceLandmarkerResult;
  try {
    const ts = Math.max(timestamp, lastVideoTs + 1);
    lastVideoTs = ts;
    result = landmarker.detectForVideo(bitmap, ts);
  } catch (err) {
    bitmap.close();
    ctx.postMessage({
      type: "error",
      message:
        err instanceof Error ? err.message : "face detection failed",
    });
    return;
  }
  bitmap.close();

  const faces = result.faceLandmarks.length;
  let pitch = 0;
  let yaw = 0;
  let roll = 0;
  const matrix = result.facialTransformationMatrixes[0];
  if (faces > 0 && matrix && matrix.data.length >= 16) {
    ({ pitch, yaw, roll } = eulerFromColumnMajor(matrix.data));
  }
  const categories = result.faceBlendshapes[0]?.categories;
  const lm = result.faceLandmarks[0];
  // 478-point mesh: iris centres 468 (subject's right) / 473 (left)
  const hasIris = !!lm && lm.length >= 478;
  ctx.postMessage({
    type: "result",
    timestamp,
    faces,
    pitch,
    yaw,
    roll,
    irisDownL: hasIris ? irisDown(lm, 362, 263, 473, width, height) : 0,
    irisDownR: hasIris ? irisDown(lm, 33, 133, 468, width, height) : 0,
    lookDownL: blend(categories, "eyeLookDownLeft"),
    lookDownR: blend(categories, "eyeLookDownRight"),
    lookUpL: blend(categories, "eyeLookUpLeft"),
    lookUpR: blend(categories, "eyeLookUpRight"),
    // lid landmarks: 386/374 (subject's left), 159/145 (right)
    openL: lm ? eyeOpen(lm, 362, 263, 386, 374, width, height) : 0,
    openR: lm ? eyeOpen(lm, 33, 133, 159, 145, width, height) : 0,
    confidence: faces > 0 ? 1 : 0,
  });
}

ctx.onmessage = (ev: MessageEvent<GazeWorkerRequest>) => {
  const msg = ev.data;
  switch (msg.type) {
    case "init":
      void handleInit(msg.wasmBase, msg.modelPath);
      break;
    case "frame":
      handleFrame(msg.bitmap, msg.timestamp);
      break;
    case "close":
      landmarker?.close();
      landmarker = null;
      ctx.close();
      break;
  }
};

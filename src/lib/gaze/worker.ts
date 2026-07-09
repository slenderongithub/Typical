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

/** Mean score of the named blendshape categories (0 when absent). */
function blendMean(categories: Category[] | undefined, names: string[]): number {
  if (!categories) return 0;
  let sum = 0;
  let n = 0;
  for (const c of categories) {
    if (names.includes(c.categoryName)) {
      sum += c.score;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

function handleFrame(bitmap: ImageBitmap, timestamp: number): void {
  if (!landmarker) {
    bitmap.close();
    return;
  }
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
  ctx.postMessage({
    type: "result",
    timestamp,
    faces,
    pitch,
    yaw,
    roll,
    eyeLookDown: blendMean(categories, ["eyeLookDownLeft", "eyeLookDownRight"]),
    eyeBlink: blendMean(categories, ["eyeBlinkLeft", "eyeBlinkRight"]),
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

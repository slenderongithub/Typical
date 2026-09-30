/**
 * GazeController — main-thread orchestration of the gaze-integrity system.
 *
 * Owns the camera stream, the inference worker (~12fps frame loop), the
 * peek/lost debouncing state machine, and per-test integrity sessions.
 * Honesty contract: head-pose + eye-state heuristics only; frames never leave
 * the browser; calibration lives in memory for the tab's lifetime.
 */

import {
  type CalibrationData,
  type GazeFrameResult,
  type GazeStatusKind,
  type GazeWorkerResponse,
  type IntegrityReport,
  type PeekEvent,
} from "@/lib/types";

import {
  computeDownScore,
  DOWN_DEBOUNCE_MS,
  DOWN_ENTER_SCORE,
  DOWN_EXIT_SCORE,
  LOST_DEBOUNCE_MS,
  median,
  MIN_CONFIDENCE,
  UP_DEBOUNCE_MS,
} from "./heuristics";

export type GazeEvent =
  | { type: "status"; status: GazeStatusKind }
  | { type: "peek-start"; at: number }
  | { type: "peek-end"; at: number; durationMs: number }
  | { type: "frame"; frame: GazeFrameResult };

const FRAME_INTERVAL_MS = 80; // ~12.5fps — plenty for head pose, easy on battery
const WORKER_INIT_TIMEOUT_MS = 20000;

export class GazeController {
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private status: GazeStatusKind = "inactive";
  private lastFrame: GazeFrameResult | null = null;
  private calibration: CalibrationData | null = null;
  private listeners = new Set<(e: GazeEvent) => void>();

  // debounced peek/lost state
  private score = 0;
  private downSince = 0;
  private upSince = 0;
  private lostSince = 0;
  private peeking = false;
  private peekStartTs = 0;

  // calibration sampling
  private samples: { pitch: number[]; lookDown: number[] } | null = null;
  private centerSample: { pitch: number; lookDown: number } | null = null;
  private bottomSample: { pitch: number; lookDown: number } | null = null;

  // integrity session
  private sessionActive = false;
  private sessionStart = 0;
  private sessionTracked = false;
  private peeks: PeekEvent[] = [];
  private trackingLostMs = 0;
  private lostAccumStart = 0;
  private focusLost = false;

  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof Worker !== "undefined" &&
      typeof createImageBitmap === "function" &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  /* ── lifecycle ──────────────────────────────────────────────────── */

  async start(video: HTMLVideoElement): Promise<void> {
    if (this.stream) return;
    this.setStatus("initializing");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
    } catch (err) {
      this.setStatus("error");
      const name = err instanceof DOMException ? err.name : "";
      throw new Error(
        name === "NotAllowedError"
          ? "camera access denied"
          : name === "NotFoundError"
            ? "no camera found"
            : "camera failed to start",
      );
    }

    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    try {
      await video.play();
    } catch {
      // autoplay quirks — the frame loop still reads the element
    }
    this.video = video;

    try {
      await this.initWorker();
    } catch (err) {
      this.stop();
      this.setStatus("error");
      throw err instanceof Error ? err : new Error("face tracking failed to load");
    }

    this.startLoop();
    this.setStatus(this.calibration ? "ok" : "uncertain");
  }

  stop(): void {
    if (this.frameTimer !== null) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    this.worker?.postMessage({ type: "close" });
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.inFlight = false;
    this.peeking = false;
    this.downSince = this.upSince = this.lostSince = 0;
    if (this.sessionActive) this.sessionTracked = false; // camera died mid-test
    this.setStatus("inactive");
  }

  getStatus(): GazeStatusKind {
    return this.status;
  }

  getLastFrame(): GazeFrameResult | null {
    return this.lastFrame;
  }

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  on(fn: (e: GazeEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /* ── calibration ────────────────────────────────────────────────── */

  /** Collect median pitch/lookDown over a window while the user holds a target. */
  collectCalibration(
    step: "center" | "bottom",
    ms = 1200,
  ): Promise<{ pitch: number; lookDown: number }> {
    this.samples = { pitch: [], lookDown: [] };
    return new Promise((resolve) => {
      setTimeout(() => {
        const s = this.samples;
        this.samples = null;
        const sample = {
          pitch: median(s?.pitch ?? []),
          lookDown: median(s?.lookDown ?? []),
        };
        if (step === "center") this.centerSample = sample;
        else this.bottomSample = sample;
        resolve(sample);
      }, ms);
    });
  }

  /** Build CalibrationData from the two collected steps. */
  finishCalibration(): CalibrationData {
    const center = this.centerSample ?? { pitch: 0, lookDown: 0 };
    const bottom = this.bottomSample ?? { pitch: 8, lookDown: 0.35 };
    const data: CalibrationData = {
      neutralPitch: center.pitch,
      bottomPitch: bottom.pitch,
      neutralLookDown: center.lookDown,
      bottomLookDown: bottom.lookDown,
      valid: this.centerSample !== null && this.bottomSample !== null,
    };
    this.setCalibration(data);
    return data;
  }

  setCalibration(c: CalibrationData): void {
    this.calibration = c;
    if (this.status === "uncertain" && this.stream) this.setStatus("ok");
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  /* ── integrity session ──────────────────────────────────────────── */

  beginSession(): void {
    this.sessionActive = true;
    this.sessionStart = performance.now();
    this.sessionTracked = this.stream !== null && this.calibration !== null;
    this.peeks = [];
    this.trackingLostMs = 0;
    this.lostAccumStart = 0;
    this.focusLost = false;
    // a peek already in progress at test start counts from second zero
    if (this.peeking) this.peekStartTs = this.sessionStart;
  }

  endSession(): IntegrityReport {
    const now = performance.now();
    if (this.sessionActive) {
      if (this.peeking) {
        this.peeks.push({
          startMs: Math.max(0, this.peekStartTs - this.sessionStart),
          durationMs: now - Math.max(this.peekStartTs, this.sessionStart),
        });
      }
      if (this.lostAccumStart > 0) {
        this.trackingLostMs += now - this.lostAccumStart;
        this.lostAccumStart = 0;
      }
    }
    this.sessionActive = false;

    const peekTotalMs = this.peeks.reduce((a, p) => a + p.durationMs, 0);
    return {
      status: !this.sessionTracked
        ? "untracked"
        : this.peeks.length > 0
          ? "assisted"
          : "clean",
      peeks: [...this.peeks],
      peekCount: this.peeks.length,
      peekTotalMs: Math.round(peekTotalMs),
      trackingLostMs: Math.round(this.trackingLostMs),
      focusLost: this.focusLost,
    };
  }

  markFocusLost(): void {
    this.focusLost = true;
  }

  /* ── internals ──────────────────────────────────────────────────── */

  private initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker = worker;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("face tracking timed out"));
        }
      }, WORKER_INIT_TIMEOUT_MS);

      worker.onmessage = (ev: MessageEvent<GazeWorkerResponse>) => {
        const msg = ev.data;
        if (msg.type === "ready") {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
          return;
        }
        if (msg.type === "error") {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            // raw worker/MediaPipe text is too long for a toast
            console.error("[gaze] worker error:", msg.message);
            reject(new Error("face tracking failed to load"));
          } else {
            this.inFlight = false;
          }
          return;
        }
        this.inFlight = false;
        this.onResult(msg);
      };
      worker.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error("face tracking failed to start"));
        }
      };

      worker.postMessage({
        type: "init",
        wasmBase: "/mediapipe/wasm",
        modelPath: "/models/face_landmarker.task",
      });
    });
  }

  private startLoop(): void {
    if (this.frameTimer !== null) return;
    this.frameTimer = setInterval(() => {
      void this.captureFrame();
    }, FRAME_INTERVAL_MS);
  }

  private async captureFrame(): Promise<void> {
    const video = this.video;
    const worker = this.worker;
    if (!video || !worker || this.inFlight) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    this.inFlight = true;
    try {
      const bitmap = await createImageBitmap(video);
      worker.postMessage(
        { type: "frame", bitmap, timestamp: performance.now() },
        [bitmap],
      );
    } catch {
      this.inFlight = false; // decode hiccup — skip the frame
    }
  }

  private onResult(frame: GazeFrameResult): void {
    this.lastFrame = frame;
    const now = performance.now();

    if (this.samples && frame.faces > 0) {
      this.samples.pitch.push(frame.pitch);
      this.samples.lookDown.push(frame.eyeLookDown);
    }

    const tracked = frame.faces > 0 && frame.confidence >= MIN_CONFIDENCE;

    if (!tracked) {
      if (this.lostSince === 0) this.lostSince = now;
      if (now - this.lostSince >= LOST_DEBOUNCE_MS) {
        // a peek can't survive losing the face — close it honestly at lost time
        if (this.peeking) this.endPeek(this.lostSince);
        if (this.sessionActive && this.lostAccumStart === 0) {
          this.lostAccumStart = this.lostSince;
        }
        this.setStatus("lost");
      }
      this.emit({ type: "frame", frame });
      return;
    }

    // face is back
    if (this.lostSince !== 0) {
      if (this.sessionActive && this.lostAccumStart > 0) {
        this.trackingLostMs += now - this.lostAccumStart;
        this.lostAccumStart = 0;
      }
      this.lostSince = 0;
    }

    if (frame.faces > 1) {
      this.setStatus("multiple");
      this.emit({ type: "frame", frame });
      return;
    }

    if (!this.calibration || !this.calibration.valid) {
      this.setStatus("uncertain");
      this.emit({ type: "frame", frame });
      return;
    }

    this.score = computeDownScore(frame, this.calibration, this.score);

    if (this.score >= DOWN_ENTER_SCORE) {
      this.upSince = 0;
      if (this.downSince === 0) this.downSince = now;
      if (!this.peeking && now - this.downSince >= DOWN_DEBOUNCE_MS) {
        this.peeking = true;
        this.peekStartTs = this.downSince;
        this.setStatus("down");
        this.emit({
          type: "peek-start",
          at: Math.max(0, this.downSince - this.sessionStart),
        });
      } else if (this.peeking) {
        this.setStatus("down");
      } else {
        this.setStatus("uncertain");
      }
    } else if (this.score < DOWN_EXIT_SCORE) {
      this.downSince = 0;
      if (this.peeking) {
        if (this.upSince === 0) this.upSince = now;
        if (now - this.upSince >= UP_DEBOUNCE_MS) {
          this.endPeek(this.upSince);
          this.setStatus("ok");
        }
      } else {
        this.setStatus("ok");
      }
    } else {
      // hysteresis mid-zone: not enough to enter, not enough to exit
      this.downSince = 0;
      if (!this.peeking) this.setStatus("uncertain");
      else this.upSince = 0;
    }

    this.emit({ type: "frame", frame });
  }

  private endPeek(endTs: number): void {
    if (!this.peeking) return;
    this.peeking = false;
    this.upSince = 0;
    const start = this.sessionActive
      ? Math.max(this.peekStartTs, this.sessionStart)
      : this.peekStartTs;
    const durationMs = Math.max(0, endTs - start);
    if (this.sessionActive) {
      this.peeks.push({
        startMs: Math.max(0, start - this.sessionStart),
        durationMs,
      });
    }
    this.emit({
      type: "peek-end",
      at: Math.max(0, endTs - this.sessionStart),
      durationMs,
    });
  }

  private setStatus(status: GazeStatusKind): void {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: "status", status });
  }

  private emit(e: GazeEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

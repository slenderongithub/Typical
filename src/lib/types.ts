/**
 * Shared types for Typical — the single source of truth all modules code against.
 * Do not duplicate these shapes elsewhere; import from "@/lib/types".
 */

/* ───────────────────────── Test configuration ───────────────────────── */

export type TestMode = "time" | "words" | "quote" | "zen" | "custom";
export type Difficulty = "normal" | "expert" | "master";
export type QuoteLength = "short" | "medium" | "long" | "all";

export interface TestConfig {
  mode: TestMode;
  /** seconds — used in time mode (15/30/60/120 or custom) */
  duration: number;
  /** used in words mode (10/25/50/100 or custom) */
  wordCount: number;
  quoteLength: QuoteLength;
  punctuation: boolean;
  numbers: boolean;
  difficulty: Difficulty;
  /** user-provided passage for custom mode */
  customText?: string;
}

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  quoteLength: "all",
  punctuation: false,
  numbers: false,
  difficulty: "normal",
};

/** Stable key used to bucket personal bests, e.g. "time-30-p0-n0-normal" */
export function configKey(c: TestConfig): string {
  const base =
    c.mode === "time"
      ? `time-${c.duration}`
      : c.mode === "words"
        ? `words-${c.wordCount}`
        : c.mode === "quote"
          ? `quote-${c.quoteLength}`
          : c.mode; // zen | custom
  return `${base}-p${c.punctuation ? 1 : 0}-n${c.numbers ? 1 : 0}-${c.difficulty}`;
}

/* ───────────────────────── Engine state ───────────────────────── */

export type CharState = "pending" | "correct" | "incorrect" | "extra";

export interface WordState {
  /** target word (no trailing space) */
  target: string;
  /** what the user has typed for this word so far */
  typed: string;
  /**
   * Per-character states. Length = max(target.length, typed.length).
   * Indices beyond target.length are "extra". Indices beyond typed.length are "pending".
   */
  states: CharState[];
  /** user pressed space and moved past this word */
  committed: boolean;
  /** committed and fully correct */
  correct: boolean;
}

export type EngineStatus = "idle" | "running" | "paused" | "finished" | "failed";
export type PauseReason = "blur" | "peek" | "manual";
export type FinishReason = "completed" | "time" | "failed" | "aborted";

export interface TickSample {
  /** seconds since start, 1-indexed (1 = first elapsed second) */
  second: number;
  /** net wpm over the whole test so far */
  wpm: number;
  /** raw wpm over this one-second window */
  raw: number;
  /** incorrect keystrokes during this one-second window */
  errors: number;
}

export interface EngineSnapshot {
  status: EngineStatus;
  /** Only mutated word objects get new identity — memo-friendly */
  words: WordState[];
  currentWordIndex: number;
  /** caret position within current word's typed text */
  currentCharIndex: number;
  elapsedMs: number;
  /** remaining seconds in time mode (ceil), else elapsed seconds */
  clockSeconds: number;
  liveWpm: number;
  liveRaw: number;
  liveAccuracy: number;
  /** increments on every state change */
  version: number;
}

export interface CharTotals {
  correct: number;
  incorrect: number;
  extra: number;
  /** target chars never typed in committed words */
  missed: number;
}

export interface KeyStat {
  hits: number;
  misses: number;
}

export interface EngineResult {
  reason: FinishReason;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  /** 0–100, kogasa-mapped coefficient of variation of per-second raw wpm */
  consistency: number;
  chars: CharTotals;
  durationMs: number;
  timeline: TickSample[];
  /** per intended-target-character stats, keyed by lowercase char */
  keyStats: Record<string, KeyStat>;
  /** target words that were committed with errors */
  missedWords: string[];
  wordCount: number;
}

/* ───────────────────────── Gaze / integrity ───────────────────────── */

export type GazeStatusKind =
  | "inactive" // camera off / not consented
  | "initializing" // loading model / opening camera
  | "calibrating"
  | "ok" // eyes on screen
  | "uncertain" // borderline signal
  | "down" // looking down at keyboard
  | "lost" // no face / low confidence
  | "multiple" // more than one face
  | "error"; // camera or model failure

export interface GazeFrameResult {
  timestamp: number;
  faces: number;
  /** degrees; positive pitch = head tilted downward */
  pitch: number;
  yaw: number;
  roll: number;
  /** 0–1 mean of eyeLookDownLeft/Right blendshapes */
  eyeLookDown: number;
  /** 0–1 mean blink blendshape — used to ignore blinks */
  eyeBlink: number;
  /** 0–1 face presence confidence */
  confidence: number;
}

/** main thread → worker */
export type GazeWorkerRequest =
  | { type: "init"; wasmBase: string; modelPath: string }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number }
  | { type: "close" };

/** worker → main thread */
export type GazeWorkerResponse =
  | { type: "ready" }
  | { type: "error"; message: string }
  | ({ type: "result" } & GazeFrameResult);

export interface CalibrationData {
  /** median pitch while looking at screen center */
  neutralPitch: number;
  /** median pitch while looking at bottom edge of screen */
  bottomPitch: number;
  neutralLookDown: number;
  bottomLookDown: number;
  /** completed successfully */
  valid: boolean;
}

export interface PeekEvent {
  /** ms since test start */
  startMs: number;
  durationMs: number;
}

export type IntegrityStatus = "clean" | "assisted" | "untracked";

export interface IntegrityReport {
  status: IntegrityStatus;
  peeks: PeekEvent[];
  peekCount: number;
  peekTotalMs: number;
  /** ms during the test where tracking was lost/uncertain */
  trackingLostMs: number;
  /** tab lost focus during the test */
  focusLost: boolean;
}

/* ───────────────────────── Saved results / stats ───────────────────────── */

export interface SavedResult {
  id: string;
  mode: TestMode;
  config: TestConfig;
  configKey: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  chars: CharTotals;
  durationMs: number;
  timeline: TickSample[];
  integrity: IntegrityStatus;
  peekCount: number;
  peekTotalMs: number;
  trackingLostMs: number;
  keyStats: Record<string, KeyStat>;
  missedWords: string[];
  /** epoch ms */
  createdAt: number;
  /** pushed to server (when signed in) */
  synced: boolean;
}

export interface PersonalBest {
  configKey: string;
  wpm: number;
  accuracy: number;
  resultId: string;
  achievedAt: number;
}

export interface StreakInfo {
  current: number;
  best: number;
  /** yyyy-mm-dd of last practice day */
  lastDay: string;
}

/* ───────────────────────── Quotes ───────────────────────── */

export interface Quote {
  text: string;
  source: string;
  /** short < 150 chars, medium 150–300, long > 300 */
  length: "short" | "medium" | "long";
}

/* ───────────────────────── Settings ───────────────────────── */

export interface AppSettings {
  theme: string;
  /** show live wpm/accuracy during test */
  liveStats: boolean;
  /** smooth caret animation */
  smoothCaret: boolean;
  /** tab alone restarts (true) or tab+enter (false) */
  quickRestart: boolean;
  /** pause the test while looking down (expert integrity mode) */
  pauseOnPeek: boolean;
  /** show the small camera preview */
  showCameraPreview: boolean;
  soundEnabled: boolean;
  defaultConfig: TestConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "midnight",
  liveStats: true,
  smoothCaret: true,
  quickRestart: true,
  pauseOnPeek: false,
  showCameraPreview: true,
  soundEnabled: false,
  defaultConfig: DEFAULT_CONFIG,
};

/* ───────────────────────── Leaderboard / API ───────────────────────── */

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  integrity: IntegrityStatus;
  createdAt: number;
}

export interface SubmitResultPayload {
  result: Omit<SavedResult, "id" | "synced">;
  /** coarse keystroke-interval fingerprint for bot detection */
  timingFingerprint: number[];
}

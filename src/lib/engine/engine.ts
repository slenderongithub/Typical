/**
 * TypingEngine — the pure-TS hot path of the typing test. No React, no DOM.
 *
 * Render-performance contract: `getSnapshot()` returns the same object until
 * something changes; on change a new snapshot is produced and ONLY the mutated
 * WordState objects get new identity, so a memoized word list re-renders one
 * word per keystroke.
 */

import {
  type CharTotals,
  type EngineResult,
  type EngineSnapshot,
  type EngineStatus,
  type FinishReason,
  type KeyStat,
  type PauseReason,
  type TestConfig,
  type TickSample,
  type WordState,
} from "@/lib/types";

import { computeConsistency, wpmFromChars } from "./stats";

const MAX_EXTRA = 8;
const CLOCK_INTERVAL_MS = 250;
const MIN_WORDS_AHEAD = 40;

function makeWord(target: string): WordState {
  return {
    target,
    typed: "",
    states: new Array<WordState["states"][number]>(target.length).fill(
      "pending",
    ),
    committed: false,
    correct: false,
  };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class TypingEngine {
  readonly config: TestConfig;

  private words: WordState[];
  private wordIndex = 0;
  private status: EngineStatus = "idle";
  private version = 0;
  private snapshot: EngineSnapshot;

  // clock — all elapsed math excludes paused time
  private startTs = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  /** elapsed at the last input, measured when it happened — a pause opened
   *  after it (blur while idle, then "end session") must not eat into it */
  private lastEventElapsed = 0;
  /** Elapsed shown while NOT running (frozen at pause, or the final duration at finish). */
  private frozenElapsed = 0;
  private clock: ReturnType<typeof setInterval> | null = null;

  // keystroke accounting (backspace excluded everywhere)
  private keystrokes = 0;
  private correctKeystrokes = 0;
  private keyStats: Record<string, KeyStat> = {};
  private intervals: number[] = [];
  private lastKeystrokeTs = 0;

  // per-second buckets indexed by floor(elapsed/1000)
  private typedBySecond: number[] = [];
  private errorsBySecond: number[] = [];
  private timeline: TickSample[] = [];
  private emittedSeconds = 0;

  private listeners = new Set<() => void>();
  private tickListeners = new Set<(t: TickSample) => void>();
  private finishListeners = new Set<(r: EngineResult) => void>();
  private finished = false;

  constructor(opts: { config: TestConfig; words: string[] }) {
    this.config = opts.config;
    this.words = opts.words.map(makeWord);
    this.snapshot = this.buildSnapshot(0);
  }

  /* ── public api ─────────────────────────────────────────────────── */

  getSnapshot(): EngineSnapshot {
    return this.snapshot;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribeTick(fn: (t: TickSample) => void): () => void {
    this.tickListeners.add(fn);
    return () => this.tickListeners.delete(fn);
  }

  subscribeFinish(fn: (r: EngineResult) => void): () => void {
    this.finishListeners.add(fn);
    return () => this.finishListeners.delete(fn);
  }

  /** key: printable char | " " | "Backspace" | "Backspace:word" */
  input(key: string, timestampMs: number): void {
    if (this.finished || this.status === "paused") return;
    if (this.status === "idle") this.begin(timestampMs);

    const elapsed = this.elapsed(timestampMs);
    this.lastEventElapsed = elapsed;

    if (key === "Backspace" || key === "Backspace:word") {
      this.backspace(key === "Backspace:word");
      this.emit();
      return;
    }

    // inter-keystroke timing (anti-cheat fingerprint) — printable keys only
    if (this.lastKeystrokeTs > 0) {
      this.intervals.push(timestampMs - this.lastKeystrokeTs);
    }
    this.lastKeystrokeTs = timestampMs;

    if (key === " ") {
      this.space(elapsed);
    } else if (key.length === 1) {
      this.typeChar(key, elapsed);
    } else {
      return;
    }
    this.emit();
  }

  pause(reason: PauseReason): void {
    void reason;
    if (this.status !== "running") return;
    this.frozenElapsed = this.elapsed(); // freeze the clock at the pause moment
    this.status = "paused";
    this.pausedAt = now();
    this.stopClock();
    this.emit();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.pausedTotal += now() - this.pausedAt;
    this.pausedAt = 0;
    this.status = "running";
    this.startClock();
    this.emit();
  }

  finish(reason: FinishReason = "completed"): void {
    if (this.finished) return;
    this.finished = true;
    this.stopClock();
    if (this.status === "paused") {
      // close the open pause segment so it stays excluded from duration
      this.pausedTotal += now() - this.pausedAt;
      this.pausedAt = 0;
    }
    this.status = reason === "failed" ? "failed" : "finished";

    // keystroke-driven finishes end at the last keystroke, not at wall-clock
    // "now" — the last event is the honest end of the run
    const durationMs =
      this.config.mode === "time" && reason === "time"
        ? this.config.duration * 1000
        : this.lastEventElapsed;

    // the finished snapshot shows the honest final clock (0 at the end of a
    // time run, elapsed at the completing keystroke otherwise)
    this.frozenElapsed = durationMs;
    const result = this.buildResult(reason, Math.max(durationMs, 1));
    this.emit();
    for (const fn of this.finishListeners) fn(result);
  }

  appendWords(words: string[]): void {
    if (words.length === 0) return;
    this.words = [...this.words, ...words.map(makeWord)];
    this.emit();
  }

  needsMoreWords(): boolean {
    return (
      this.config.mode === "time" &&
      this.words.length - this.wordIndex < MIN_WORDS_AHEAD
    );
  }

  getKeystrokeIntervals(): number[] {
    return [...this.intervals];
  }

  dispose(): void {
    this.stopClock();
    this.listeners.clear();
    this.tickListeners.clear();
    this.finishListeners.clear();
  }

  /* ── clock ──────────────────────────────────────────────────────── */

  private begin(ts: number): void {
    this.status = "running";
    this.startTs = ts;
    this.pausedTotal = 0;
    this.startClock();
  }

  private startClock(): void {
    this.stopClock();
    this.clock = setInterval(() => this.onClock(), CLOCK_INTERVAL_MS);
  }

  private stopClock(): void {
    if (this.clock !== null) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private elapsed(ts?: number): number {
    if (this.startTs === 0) return 0;
    const at = ts ?? now();
    return Math.max(0, at - this.startTs - this.pausedTotal);
  }

  private onClock(): void {
    if (this.status !== "running") return;
    const elapsed = this.elapsed();

    // emit one TickSample per completed second
    const fullSeconds = Math.floor(elapsed / 1000);
    let ticked = false;
    while (this.emittedSeconds < fullSeconds) {
      const s = this.emittedSeconds + 1;
      const sample: TickSample = {
        second: s,
        wpm: wpmFromChars(this.correctChars(), s * 1000),
        raw: wpmFromChars(this.typedBySecond[s - 1] ?? 0, 1000),
        errors: this.errorsBySecond[s - 1] ?? 0,
      };
      this.timeline.push(sample);
      this.emittedSeconds = s;
      for (const fn of this.tickListeners) fn(sample);
      ticked = true;
    }

    if (
      this.config.mode === "time" &&
      elapsed >= this.config.duration * 1000
    ) {
      this.finish("time");
      return;
    }

    if (ticked || this.snapshot.clockSeconds !== this.clockSeconds(elapsed)) {
      this.emit();
    }
  }

  private clockSeconds(elapsed: number): number {
    if (this.config.mode === "time") {
      return Math.max(0, Math.ceil((this.config.duration * 1000 - elapsed) / 1000));
    }
    return Math.floor(elapsed / 1000);
  }

  /* ── input handling ─────────────────────────────────────────────── */

  private bucket(elapsed: number): number {
    return Math.max(0, Math.floor(elapsed / 1000));
  }

  private recordKeystroke(
    elapsed: number,
    correct: boolean,
    intendedChar: string | null,
  ): void {
    this.keystrokes++;
    const b = this.bucket(elapsed);
    this.typedBySecond[b] = (this.typedBySecond[b] ?? 0) + 1;
    if (correct) {
      this.correctKeystrokes++;
    } else {
      this.errorsBySecond[b] = (this.errorsBySecond[b] ?? 0) + 1;
    }
    if (intendedChar) {
      const k = intendedChar.toLowerCase();
      const stat = (this.keyStats[k] ??= { hits: 0, misses: 0 });
      if (correct) stat.hits++;
      else stat.misses++;
    }
  }

  private typeChar(ch: string, elapsed: number): void {
    if (this.config.mode === "zen") {
      this.typeCharZen(ch, elapsed);
      return;
    }
    const w = this.words[this.wordIndex];
    if (!w) return; // time mode waiting on appendWords — swallow
    const pos = w.typed.length;
    if (pos >= w.target.length + MAX_EXTRA) return;

    const next: WordState = { ...w, typed: w.typed + ch, states: [...w.states] };
    let correct: boolean;
    if (pos < w.target.length) {
      correct = w.target[pos] === ch;
      next.states[pos] = correct ? "correct" : "incorrect";
      this.recordKeystroke(elapsed, correct, w.target[pos]);
    } else {
      correct = false;
      next.states[pos] = "extra";
      this.recordKeystroke(elapsed, false, ch);
    }
    this.words[this.wordIndex] = next;

    if (!correct && this.config.difficulty === "master") {
      this.finish("failed");
      return;
    }

    // final word typed fully correct ⇒ finish without needing space
    if (
      this.config.mode !== "time" &&
      this.wordIndex === this.words.length - 1 &&
      next.typed === next.target
    ) {
      this.words[this.wordIndex] = { ...next, committed: true, correct: true };
      this.finish("completed");
    }
  }

  private typeCharZen(ch: string, elapsed: number): void {
    this.recordKeystroke(elapsed, true, ch);
    const open =
      this.wordIndex < this.words.length ? this.words[this.wordIndex] : null;
    if (!open) {
      this.words = [
        ...this.words,
        {
          target: ch,
          typed: ch,
          states: ["correct"],
          committed: false,
          correct: false,
        },
      ];
      return;
    }
    this.words[this.wordIndex] = {
      ...open,
      target: open.target + ch,
      typed: open.typed + ch,
      states: [...open.states, "correct"],
    };
  }

  private space(elapsed: number): void {
    const w = this.words[this.wordIndex];
    if (!w || w.typed.length === 0) return; // leading space is a no-op

    if (this.config.mode === "zen") {
      this.recordKeystroke(elapsed, true, null);
      this.words[this.wordIndex] = { ...w, committed: true, correct: true };
      this.wordIndex++;
      // open the next word now: the caret needs an element after the space
      // to sit on, or it falls back to the empty-stream position
      this.words = [...this.words, makeWord("")];
      return;
    }

    const correct = w.typed === w.target;
    this.recordKeystroke(elapsed, correct, null);
    this.words[this.wordIndex] = { ...w, committed: true, correct };

    if (!correct && this.config.difficulty !== "normal") {
      this.finish("failed");
      return;
    }

    if (this.wordIndex === this.words.length - 1) {
      if (this.config.mode !== "time") {
        this.finish("completed");
        return;
      }
      // time mode: appendWords arrives via the subscriber; hold position
      this.wordIndex++;
    } else {
      this.wordIndex++;
    }
  }

  private backspace(wholeWord: boolean): void {
    const w = this.words[this.wordIndex];

    if (w && w.typed.length > 0) {
      if (wholeWord) {
        this.words[this.wordIndex] = this.clearWord(w);
      } else if (this.config.mode === "zen") {
        this.words[this.wordIndex] = {
          ...w,
          target: w.target.slice(0, -1),
          typed: w.typed.slice(0, -1),
          states: w.states.slice(0, -1),
        };
      } else {
        const pos = w.typed.length - 1;
        const next: WordState = {
          ...w,
          typed: w.typed.slice(0, -1),
          states: [...w.states],
        };
        if (pos < w.target.length) next.states[pos] = "pending";
        else next.states.pop();
        this.words[this.wordIndex] = next;
      }
      return;
    }

    // at word start: step back only into a previous word committed with errors
    if (this.config.mode === "zen" || this.wordIndex === 0) return;
    const prev = this.words[this.wordIndex - 1];
    if (!prev || !prev.committed || prev.correct) return;
    this.wordIndex--;
    const reopened: WordState = { ...prev, committed: false, correct: false };
    this.words[this.wordIndex] = wholeWord ? this.clearWord(reopened) : reopened;
  }

  private clearWord(w: WordState): WordState {
    return {
      ...w,
      typed: "",
      states: new Array<WordState["states"][number]>(w.target.length).fill(
        "pending",
      ),
      committed: false,
      correct: false,
    };
  }

  /* ── derived stats ──────────────────────────────────────────────── */

  /** Correct chars: matching positions everywhere + a space per correct committed word. */
  private correctChars(): number {
    let total = 0;
    const upTo = Math.min(this.wordIndex, this.words.length - 1);
    for (let i = 0; i <= upTo; i++) {
      const w = this.words[i];
      if (!w) continue;
      if (w.committed && w.correct) {
        total += w.target.length + 1;
        continue;
      }
      const n = Math.min(w.typed.length, w.target.length);
      for (let j = 0; j < n; j++) {
        if (w.typed[j] === w.target[j]) total++;
      }
    }
    return total;
  }

  private charTotals(): CharTotals {
    const totals: CharTotals = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
    for (const w of this.words) {
      for (let i = 0; i < w.typed.length; i++) {
        const s = w.states[i];
        if (s === "correct") totals.correct++;
        else if (s === "incorrect") totals.incorrect++;
        else if (s === "extra") totals.extra++;
      }
      if (w.committed) {
        totals.missed += Math.max(0, w.target.length - w.typed.length);
      }
    }
    return totals;
  }

  private buildResult(reason: FinishReason, durationMs: number): EngineResult {
    // final partial-second sample so short/odd-length tests still chart
    const partialMs = durationMs - this.emittedSeconds * 1000;
    if (partialMs > 250 || this.timeline.length === 0) {
      const b = this.emittedSeconds;
      const sample: TickSample = {
        second: Math.round((durationMs / 1000) * 10) / 10,
        wpm: wpmFromChars(this.correctChars(), durationMs),
        raw: wpmFromChars(this.typedBySecond[b] ?? 0, Math.max(partialMs, 250)),
        errors: this.errorsBySecond[b] ?? 0,
      };
      this.timeline.push(sample);
    }

    const missedWords: string[] = [];
    let wordCount = 0;
    for (const w of this.words) {
      if (!w.committed) continue;
      wordCount++;
      if (!w.correct) missedWords.push(w.target);
    }

    return {
      reason,
      wpm: Math.round(wpmFromChars(this.correctChars(), durationMs) * 100) / 100,
      rawWpm: Math.round(wpmFromChars(this.keystrokes, durationMs) * 100) / 100,
      accuracy:
        this.keystrokes === 0
          ? 0
          : Math.round((this.correctKeystrokes / this.keystrokes) * 10000) / 100,
      consistency: computeConsistency(this.timeline.map((t) => t.raw)),
      chars: this.charTotals(),
      durationMs: Math.round(durationMs),
      timeline: this.timeline,
      keyStats: this.keyStats,
      missedWords,
      wordCount,
    };
  }

  /* ── snapshot ───────────────────────────────────────────────────── */

  private buildSnapshot(elapsed: number): EngineSnapshot {
    const current = this.words[this.wordIndex];
    return {
      status: this.status,
      words: this.words,
      currentWordIndex: this.wordIndex,
      currentCharIndex: current ? current.typed.length : 0,
      elapsedMs: elapsed,
      clockSeconds: this.clockSeconds(elapsed),
      // display-only: floor the window at 2s so the first keystroke doesn't
      // read as thousands of wpm (1 char / a few ms)
      liveWpm: wpmFromChars(this.correctChars(), Math.max(elapsed, 2000)),
      liveRaw: wpmFromChars(this.keystrokes, Math.max(elapsed, 2000)),
      liveAccuracy:
        this.keystrokes === 0
          ? 100
          : (this.correctKeystrokes / this.keystrokes) * 100,
      version: this.version,
    };
  }

  private emit(): void {
    this.version++;
    // words array gets fresh identity so array-level memoization also works
    this.words = [...this.words];
    // While running, the live clock must track wall time so the countdown keeps
    // ticking even when the user pauses between keystrokes — the 250ms interval
    // drives these emits. When not running the clock is frozen (0 while idle,
    // the pause instant while paused, the final duration once finished).
    const at = this.status === "running" ? this.elapsed() : this.frozenElapsed;
    this.snapshot = this.buildSnapshot(at);
    for (const fn of this.listeners) fn();
  }
}

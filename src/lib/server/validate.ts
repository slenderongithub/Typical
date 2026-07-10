/**
 * Server-side anti-cheat. The client is never trusted: results are checked
 * for physical plausibility, internal consistency, and bot-like keystroke
 * timing before they can touch the leaderboard-eligible pool.
 */

import { wpmFromChars } from "@/lib/engine/stats";
import type { SubmitResultPayload } from "@/lib/types";

const MAX_HUMAN_WPM = 250;
const MIN_DURATION_MS = 5000;
const RATE_LIMIT_MS = 6000;
const RATE_MAP_CAP = 10000;

export function validateResultPlausibility(p: SubmitResultPayload): {
  ok: boolean;
  reason?: string;
} {
  const r = p.result;

  const nums = [
    r.wpm,
    r.rawWpm,
    r.accuracy,
    r.consistency,
    r.durationMs,
    r.peekCount,
    r.peekTotalMs,
    r.chars.correct,
    r.chars.incorrect,
    r.chars.extra,
    r.chars.missed,
  ];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) {
    return { ok: false, reason: "malformed numbers" };
  }

  if (r.wpm > MAX_HUMAN_WPM) {
    return { ok: false, reason: "wpm beyond human plausibility" };
  }
  if (r.accuracy > 100) return { ok: false, reason: "accuracy > 100" };
  if (r.accuracy < 20 && r.wpm > 80) {
    return { ok: false, reason: "wpm/accuracy combination implausible" };
  }
  if (r.mode !== "zen" && r.durationMs < MIN_DURATION_MS) {
    return { ok: false, reason: "test too short" };
  }
  if (r.wpm > r.rawWpm + 0.01) {
    return { ok: false, reason: "net wpm exceeds raw" };
  }

  // wpm must agree with the character counts it claims to derive from:
  // correct chars + one space per word is bounded by correct + a generous
  // word-count allowance, so recompute an upper bound from chars.
  const maxNet = wpmFromChars(
    r.chars.correct + Math.ceil(r.chars.correct / 2) + 5,
    r.durationMs,
  );
  if (r.wpm > maxNet * 1.03) {
    return { ok: false, reason: "wpm inconsistent with character counts" };
  }

  // timeline sanity: mean of reported per-second net wpm at the end should
  // be near the reported wpm
  if (Array.isArray(r.timeline) && r.timeline.length > 2) {
    const lastWpm = r.timeline[r.timeline.length - 1]?.wpm;
    if (
      typeof lastWpm === "number" &&
      Math.abs(lastWpm - r.wpm) > Math.max(8, r.wpm * 0.15)
    ) {
      return { ok: false, reason: "timeline disagrees with reported wpm" };
    }
  }

  // bot detection: human inter-keystroke intervals always vary
  const iv = p.timingFingerprint;
  if (!Array.isArray(iv) || iv.length < 10) {
    return { ok: false, reason: "missing keystroke timing" };
  }
  const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
  const variance = iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length;
  if (mean <= 0 || Math.sqrt(variance) < 4) {
    return { ok: false, reason: "keystroke timing looks scripted" };
  }

  return { ok: true };
}

/** Coarse quantized fingerprint — identical replays hash identically. */
export function fingerprintSignature(intervals: number[]): string {
  const quantized = intervals.slice(0, 120).map((n) => Math.round(n / 15));
  let hash = 5381;
  for (const q of quantized) {
    hash = ((hash << 5) + hash + q) | 0;
  }
  return (hash >>> 0).toString(36) + ":" + quantized.length.toString(36);
}

const lastSubmission = new Map<string, number>();
const seenFingerprints = new Map<string, number>();

/** In-memory rate limit — ≥6s between submissions per user/ip. */
export function checkRateLimit(key: string): boolean {
  const nowTs = Date.now();
  const last = lastSubmission.get(key);
  if (last !== undefined && nowTs - last < RATE_LIMIT_MS) return false;
  if (lastSubmission.size > RATE_MAP_CAP) {
    const oldest = lastSubmission.keys().next().value;
    if (oldest !== undefined) lastSubmission.delete(oldest);
  }
  lastSubmission.delete(key);
  lastSubmission.set(key, nowTs);
  return true;
}

const REGISTER_WINDOW_MS = 15 * 60_000;
const REGISTER_MAX = 5;
const registerHits = new Map<string, number[]>();

/**
 * In-memory register throttle — at most REGISTER_MAX account creations per key
 * (IP) per window. Per-instance on serverless (same caveat as checkRateLimit),
 * but enough to blunt casual mass-signup abuse.
 */
export function checkRegisterRateLimit(key: string): boolean {
  const nowTs = Date.now();
  if (registerHits.size > RATE_MAP_CAP) {
    const oldest = registerHits.keys().next().value;
    if (oldest !== undefined) registerHits.delete(oldest);
  }
  const recent = (registerHits.get(key) ?? []).filter(
    (t) => nowTs - t < REGISTER_WINDOW_MS,
  );
  if (recent.length >= REGISTER_MAX) return false;
  recent.push(nowTs);
  registerHits.set(key, recent);
  return true;
}

/** Replayed keystroke fingerprints across "different" runs ⇒ bot. */
export function checkFingerprintReuse(signature: string): boolean {
  const nowTs = Date.now();
  const seen = seenFingerprints.get(signature);
  if (seenFingerprints.size > RATE_MAP_CAP) {
    const oldest = seenFingerprints.keys().next().value;
    if (oldest !== undefined) seenFingerprints.delete(oldest);
  }
  seenFingerprints.set(signature, nowTs);
  // allow the same signature at most once per hour (identical replay window)
  return seen === undefined || nowTs - seen > 3_600_000;
}

/** Pure aggregations over saved results — all empty-input safe, no NaN leaks. */

import type { KeyStat, SavedResult } from "@/lib/types";
import { dayKey } from "@/lib/utils";

export function aggregateKeyStats(
  results: SavedResult[],
): Record<string, KeyStat> {
  const out: Record<string, KeyStat> = {};
  for (const r of results) {
    for (const [k, s] of Object.entries(r.keyStats ?? {})) {
      const agg = (out[k] ??= { hits: 0, misses: 0 });
      agg.hits += s.hits;
      agg.misses += s.misses;
    }
  }
  return out;
}

export function aggregateMissedWords(
  results: SavedResult[],
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    for (const w of r.missedWords ?? []) {
      const key = w.toLowerCase().replace(/[^a-z0-9']/g, "");
      if (key.length < 2) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

/** Chronological (oldest → newest) wpm/accuracy per test. */
export function wpmOverTime(
  results: SavedResult[],
): { t: number; wpm: number; accuracy: number }[] {
  return [...results]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({ t: r.createdAt, wpm: r.wpm, accuracy: r.accuracy }));
}

/** Peeks per tracked test, bucketed by day (untracked runs excluded). */
export function peekTrend(
  results: SavedResult[],
): { t: number; peeksPerTest: number }[] {
  const buckets = new Map<string, { t: number; peeks: number; tests: number }>();
  for (const r of results) {
    if (r.integrity === "untracked") continue;
    const day = dayKey(r.createdAt);
    const b = buckets.get(day) ?? {
      t: new Date(day + "T12:00:00").getTime(),
      peeks: 0,
      tests: 0,
    };
    b.peeks += r.peekCount;
    b.tests += 1;
    buckets.set(day, b);
  }
  return [...buckets.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      peeksPerTest: b.tests > 0 ? b.peeks / b.tests : 0,
    }));
}

export function summarize(results: SavedResult[]): {
  tests: number;
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  totalTimeMs: number;
  cleanRate: number;
} {
  if (results.length === 0) {
    return {
      tests: 0,
      bestWpm: 0,
      avgWpm: 0,
      avgAccuracy: 0,
      totalTimeMs: 0,
      cleanRate: 0,
    };
  }
  const tracked = results.filter((r) => r.integrity !== "untracked");
  return {
    tests: results.length,
    bestWpm: Math.max(...results.map((r) => r.wpm)),
    avgWpm: results.reduce((a, r) => a + r.wpm, 0) / results.length,
    avgAccuracy: results.reduce((a, r) => a + r.accuracy, 0) / results.length,
    totalTimeMs: results.reduce((a, r) => a + r.durationMs, 0),
    cleanRate:
      tracked.length > 0
        ? tracked.filter((r) => r.integrity === "clean").length / tracked.length
        : 0,
  };
}

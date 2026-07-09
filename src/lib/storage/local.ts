/**
 * Guest-mode persistence — IndexedDB via idb-keyval. Fully local; the app is
 * complete without an account. All functions no-op safely on the server.
 */

import { get, set } from "idb-keyval";

import {
  type IntegrityStatus,
  type PersonalBest,
  type SavedResult,
  type StreakInfo,
  type TestMode,
} from "@/lib/types";
import { dayKey } from "@/lib/utils";

const K_RESULTS = "nolook:results";
const K_PBS = "nolook:pbs";
const K_STREAK = "nolook:streak";
const MAX_RESULTS = 1000;

const onServer = () => typeof window === "undefined";

export async function getResults(): Promise<SavedResult[]> {
  if (onServer()) return [];
  return (await get<SavedResult[]>(K_RESULTS)) ?? [];
}

/** Prepends (newest first); trims history beyond MAX_RESULTS. */
export async function saveResult(r: SavedResult): Promise<void> {
  if (onServer()) return;
  const all = await getResults();
  await set(K_RESULTS, [r, ...all].slice(0, MAX_RESULTS));
}

export async function markSynced(ids: string[]): Promise<void> {
  if (onServer() || ids.length === 0) return;
  const idSet = new Set(ids);
  const all = await getResults();
  await set(
    K_RESULTS,
    all.map((r) => (idSet.has(r.id) ? { ...r, synced: true } : r)),
  );
}

export async function getResultsPage(
  offset: number,
  limit: number,
  filter?: { mode?: TestMode; integrity?: IntegrityStatus },
): Promise<{ items: SavedResult[]; total: number }> {
  const all = await getResults();
  const filtered = all.filter(
    (r) =>
      (!filter?.mode || r.mode === filter.mode) &&
      (!filter?.integrity || r.integrity === filter.integrity),
  );
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export async function getPersonalBests(): Promise<Record<string, PersonalBest>> {
  if (onServer()) return {};
  return (await get<Record<string, PersonalBest>>(K_PBS)) ?? {};
}

/**
 * Compare a fresh result against its configKey bucket, persist when beaten.
 * Call before rendering the results screen so the PB delta is accurate.
 */
export async function applyPersonalBest(
  r: SavedResult,
): Promise<{ isNewBest: boolean; previous?: PersonalBest }> {
  if (onServer()) return { isNewBest: false };
  const pbs = await getPersonalBests();
  const previous = pbs[r.configKey];
  if (previous && r.wpm <= previous.wpm) {
    return { isNewBest: false, previous };
  }
  pbs[r.configKey] = {
    configKey: r.configKey,
    wpm: r.wpm,
    accuracy: r.accuracy,
    resultId: r.id,
    achievedAt: r.createdAt,
  };
  await set(K_PBS, pbs);
  // the very first result in a bucket is a baseline, not a "new best" moment
  return { isNewBest: previous !== undefined, previous };
}

export async function getStreak(): Promise<StreakInfo> {
  if (onServer()) return { current: 0, best: 0, lastDay: "" };
  return (
    (await get<StreakInfo>(K_STREAK)) ?? { current: 0, best: 0, lastDay: "" }
  );
}

/** Idempotent per day: extends, keeps, or resets the practice streak. */
export async function touchStreak(ts: number): Promise<StreakInfo> {
  if (onServer()) return { current: 0, best: 0, lastDay: "" };
  const streak = await getStreak();
  const today = dayKey(ts);
  if (streak.lastDay === today) return streak;

  const yesterday = dayKey(ts - 86_400_000);
  const current = streak.lastDay === yesterday ? streak.current + 1 : 1;
  const next: StreakInfo = {
    current,
    best: Math.max(streak.best, current),
    lastDay: today,
  };
  await set(K_STREAK, next);
  return next;
}

export async function clearHistory(): Promise<void> {
  if (onServer()) return;
  await set(K_RESULTS, []);
  await set(K_PBS, {});
  await set(K_STREAK, { current: 0, best: 0, lastDay: "" });
}

export async function exportHistory(): Promise<string> {
  const [results, pbs, streak] = await Promise.all([
    getResults(),
    getPersonalBests(),
    getStreak(),
  ]);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), results, personalBests: pbs, streak },
    null,
    2,
  );
}

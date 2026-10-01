/** Pure stat math shared by the engine and server-side validation. */

/** Above this a result is a bug or a bot — the server rejects it, local history ignores it. */
export const MAX_HUMAN_WPM = 250;

/** Standard net/raw formula: 5 chars = 1 word. */
export function wpmFromChars(chars: number, ms: number): number {
  if (ms <= 0 || chars <= 0) return 0;
  return chars / 5 / (ms / 60000);
}

/**
 * Consistency 0–100 from per-second raw wpm samples: coefficient of variation
 * mapped through the kogasa curve (MonkeyType-compatible), so 100 = perfectly
 * even pace and low scores = bursty typing.
 */
export function computeConsistency(rawPerSecond: number[]): number {
  const usable = rawPerSecond.filter((v) => Number.isFinite(v));
  if (usable.length < 2) return 100;
  const mean = usable.reduce((a, b) => a + b, 0) / usable.length;
  if (mean <= 0) return 0;
  const variance =
    usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length;
  const cov = Math.sqrt(variance) / mean;
  const kogasa = 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
  return Math.min(100, Math.max(0, Math.round(kogasa * 100) / 100));
}

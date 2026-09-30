"use client";

import { useMemo } from "react";

import { wpmOverTime } from "@/lib/storage/aggregate";
import type { SavedResult } from "@/lib/types";
import { dayKey } from "@/lib/utils";

import { TrendChart } from "./TrendChart";

export interface ProgressChartProps {
  results: SavedResult[];
}

/** All-time wpm progress; day-averaged once history grows past 120 tests. */
export function ProgressChart({ results }: ProgressChartProps) {
  const points = useMemo(() => {
    const series = wpmOverTime(results);
    if (series.length <= 120) {
      return series.map((p) => ({
        t: p.t,
        value: p.wpm,
        label: new Date(p.t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }));
    }
    // bucket by day to keep the line readable
    const byDay = new Map<string, { t: number; sum: number; n: number }>();
    for (const p of series) {
      const day = dayKey(p.t);
      const b = byDay.get(day) ?? { t: p.t, sum: 0, n: 0 };
      b.sum += p.wpm;
      b.n++;
      byDay.set(day, b);
    }
    return [...byDay.values()]
      .sort((a, b) => a.t - b.t)
      .map((b) => ({
        t: b.t,
        value: b.sum / b.n,
        label: new Date(b.t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [results]);

  return (
    <div>
      <h3 className="card-title mb-4">
        wpm over time
      </h3>
      <TrendChart points={points} valueLabel="wpm" height={190} />
    </div>
  );
}

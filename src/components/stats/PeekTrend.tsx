"use client";

import { useMemo } from "react";

import { peekTrend } from "@/lib/storage/aggregate";
import type { SavedResult } from "@/lib/types";

import { TrendChart } from "./TrendChart";

export interface PeekTrendProps {
  results: SavedResult[];
}

/** Peeks-per-test by day — the "am I improving at not looking?" chart. */
export function PeekTrend({ results }: PeekTrendProps) {
  const points = useMemo(
    () =>
      peekTrend(results).map((p) => ({
        t: p.t,
        value: Math.round(p.peeksPerTest * 10) / 10,
        label: new Date(p.t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    [results],
  );

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-foreground">peek trend</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        peeks per test — trending down means your eyes are staying up
      </p>
      {points.length < 2 ? (
        <div className="grid h-[140px] place-items-center text-sm text-muted-foreground">
          not enough tracked runs yet — enable the camera on a few tests
        </div>
      ) : (
        <TrendChart points={points} valueLabel="peeks" height={140} tickBase={1} />
      )}
    </div>
  );
}

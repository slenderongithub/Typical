"use client";

import { Flame } from "lucide-react";

import { SmoothNumber } from "@/components/glass";
import type { StreakInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface StreakCardProps {
  streak: StreakInfo;
}

/** Days-practiced-in-a-row. The flame earns its color at three days. */
export function StreakCard({ streak }: StreakCardProps) {
  const lit = streak.current >= 3;
  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-1 text-sm font-medium text-foreground">streak</h3>
      <p className="mb-4 text-xs text-muted-foreground">days practiced in a row</p>
      <div className="flex flex-1 items-center justify-center gap-3 py-2">
        <Flame
          className={cn(
            "size-8",
            lit ? "text-warning" : "text-faint-foreground",
          )}
        />
        <SmoothNumber
          value={streak.current}
          className="text-5xl font-semibold text-foreground"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        best {streak.best} day{streak.best === 1 ? "" : "s"}
      </p>
    </div>
  );
}

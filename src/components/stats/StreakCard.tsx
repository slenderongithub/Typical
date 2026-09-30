"use client";

import { Rabbit } from "lucide-react";

import { SmoothNumber } from "@/components/glass";
import type { StreakInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface StreakCardProps {
  streak: StreakInfo;
}

/** Days-practiced-in-a-row. The rabbit earns its color at three days. */
export function StreakCard({ streak }: StreakCardProps) {
  const lit = streak.current >= 3;
  return (
    <div className="flex h-full flex-col">
      <h3 className="card-title mb-4">streak</h3>
      <div className="flex flex-1 items-center justify-center gap-3 py-2">
        <Rabbit
          className={cn(
            "size-10",
            lit
              ? "text-primary"
              : "text-faint-foreground",
          )}
        />
        <SmoothNumber
          value={streak.current}
          className="text-6xl font-bold tracking-tight text-foreground"
        />
      </div>
      <p className="text-center text-sm font-medium text-muted-foreground">
        best {streak.best} day{streak.best === 1 ? "" : "s"}
      </p>
    </div>
  );
}

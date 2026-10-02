"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { SmoothNumber } from "@/components/glass";

import type { TypingEngine } from "@/lib/engine/engine";
import { useSettings } from "@/lib/store/settings";

import { useEngineSnapshot } from "./useEngineSnapshot";

export interface LiveStatsProps {
  engine: TypingEngine;
}

/**
 * Clock + live wpm/accuracy — quiet, above the stream, no layout shift.
 * Digits roll (NumberFlow), but wpm/accuracy are sampled once per clock
 * second, not per keystroke: per-key rolls were always mid-roll and were the
 * biggest cost of a keystroke (see commit b91bf62).
 */
export function LiveStats({ engine }: LiveStatsProps) {
  const snapshot = useEngineSnapshot(engine);
  const enabled = useSettings((s) => s.liveStats);

  const running = snapshot?.status === "running" || snapshot?.status === "paused";
  const show = enabled && running && snapshot;

  const seconds = snapshot?.clockSeconds ?? 0;
  const minutes = Math.floor(seconds / 60);
  // re-sampled only when the clock ticks, so each roll finishes and typing
  // never pays for an animation
  const sampled = useMemo(
    () => ({
      wpm: Math.round(snapshot?.liveWpm ?? 0),
      acc: Math.round(snapshot?.liveAccuracy ?? 100),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seconds, snapshot?.status],
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="flex items-baseline gap-7 font-mono text-xl text-primary"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          aria-live="off"
        >
          <span className="min-w-[3ch] font-semibold tabular-nums" aria-label="time">
            {seconds >= 60 ? (
              <>
                {minutes}:{String(seconds % 60).padStart(2, "0")}
              </>
            ) : (
              <SmoothNumber value={seconds} tabular />
            )}
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <SmoothNumber className="text-xl text-foreground" value={sampled.wpm} tabular />
            <span className="font-sans text-xs">wpm</span>
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <SmoothNumber
              className="text-xl text-foreground"
              value={sampled.acc}
              suffix="%"
              tabular
            />
            <span className="font-sans text-xs">acc</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { TypingEngine } from "@/lib/engine/engine";
import { useSettings } from "@/lib/store/settings";

import { useEngineSnapshot } from "./useEngineSnapshot";

export interface LiveStatsProps {
  engine: TypingEngine;
}

/**
 * Clock + live wpm/accuracy — quiet, above the stream, no layout shift.
 * Plain tabular digits on purpose: these change on every keystroke, so a
 * rolling-digit animation is always mid-roll (unreadable) and its per-key
 * style recalcs were the biggest cost of a keystroke.
 */
export function LiveStats({ engine }: LiveStatsProps) {
  const snapshot = useEngineSnapshot(engine);
  const enabled = useSettings((s) => s.liveStats);

  const running = snapshot?.status === "running" || snapshot?.status === "paused";
  const show = enabled && running && snapshot;

  const seconds = snapshot?.clockSeconds ?? 0;
  const minutes = Math.floor(seconds / 60);

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
              seconds
            )}
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <span className="text-xl text-foreground tabular-nums">
              {Math.round(snapshot.liveWpm)}
            </span>
            <span className="font-sans text-xs">wpm</span>
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <span className="text-xl text-foreground tabular-nums">
              {Math.round(snapshot.liveAccuracy)}%
            </span>
            <span className="font-sans text-xs">acc</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";

import { SmoothNumber } from "@/components/glass";
import type { TypingEngine } from "@/lib/engine/engine";
import { useSettings } from "@/lib/store/settings";

import { useEngineSnapshot } from "./useEngineSnapshot";

export interface LiveStatsProps {
  engine: TypingEngine;
}

/** Clock + live wpm/accuracy — quiet, above the stream, no layout shift. */
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
          className="flex items-baseline gap-6 font-mono text-lg text-primary"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          aria-live="off"
        >
          <span className="min-w-[3ch] tabular-nums" aria-label="time">
            {seconds >= 60 ? (
              <>
                {minutes}:{String(seconds % 60).padStart(2, "0")}
              </>
            ) : (
              <SmoothNumber value={seconds} tabular />
            )}
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <SmoothNumber
              className="text-lg text-foreground"
              value={Math.round(snapshot.liveWpm)}
              tabular
            />
            <span className="text-xs">wpm</span>
          </span>
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <SmoothNumber
              className="text-lg text-foreground"
              value={Math.round(snapshot.liveAccuracy)}
              tabular
            />
            <span className="text-xs">acc</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

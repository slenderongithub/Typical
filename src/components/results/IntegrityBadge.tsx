"use client";

import { Eye, EyeOff, Info, VideoOff } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { SavedResult } from "@/lib/types";

export interface IntegrityBadgeProps {
  report: Pick<
    SavedResult,
    "integrity" | "peekCount" | "peekTotalMs" | "trackingLostMs"
  >;
}

/**
 * The run's integrity verdict — transparent, never punitive. Clean runs get
 * the badge; assisted runs get honest numbers; untracked runs are just that.
 */
export function IntegrityBadge({ report }: IntegrityBadgeProps) {
  const [tip, setTip] = useState(false);

  const meta =
    report.integrity === "clean"
      ? {
          icon: <Eye className="size-4" />,
          tone: "text-success",
          label: "clean run — eyes never left the screen",
        }
      : report.integrity === "assisted"
        ? {
            icon: <EyeOff className="size-4" />,
            tone: "text-warning",
            label: `assisted — ${report.peekCount} peek${report.peekCount === 1 ? "" : "s"} · ${(
              report.peekTotalMs / 1000
            ).toFixed(1)}s looking down`,
          }
        : {
            icon: <VideoOff className="size-4" />,
            tone: "text-muted-foreground",
            label: "untracked — camera was off",
          };

  return (
    <div className="relative inline-flex items-center gap-2">
      <span
        className={`glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${meta.tone}`}
      >
        {meta.icon}
        {meta.label}
        {report.trackingLostMs > 1500 && report.integrity !== "untracked" && (
          <span className="text-xs text-faint-foreground">
            · tracking lost {(report.trackingLostMs / 1000).toFixed(1)}s
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label="how gaze verification works"
        className="text-faint-foreground transition-colors hover:text-muted-foreground"
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
      >
        <Info className="size-3.5" />
      </button>
      <AnimatePresence>
        {tip && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="glass-strong absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl p-3 text-left text-xs leading-relaxed text-muted-foreground"
          >
            Verified with on-device head-pose and eye-state heuristics — an
            honest estimate of sustained keyboard glances, not pixel-perfect
            gaze tracking. Video never leaves your browser.
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

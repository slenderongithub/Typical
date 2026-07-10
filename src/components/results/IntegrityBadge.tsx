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
            initial={{ opacity: 0, y: 4, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 4, x: "-50%" }}
            // Opaque elevated surface (NOT the translucent `.glass-strong`): it
            // sits over the stat grid below, and a frosted surface let those
            // tiles bleed through into a messy double-exposure. Opaque + a high
            // z-index means it cleanly covers whatever it overlaps. Dropping
            // `.glass-strong` also avoids its `position: relative` (which,
            // unlayered, beats the `absolute` utility). Centering lives in
            // framer's `x` — animating `y` makes framer own the transform, so
            // a `-translate-x-1/2` class would be silently ignored.
            style={{
              position: "absolute",
              background:
                "color-mix(in srgb, var(--background) 90%, var(--foreground) 10%)",
              boxShadow:
                "0 14px 36px -12px var(--glass-shadow), 0 2px 8px -3px var(--glass-shadow)",
            }}
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 rounded-xl border border-glass-border p-3 text-left text-xs leading-relaxed text-muted-foreground"
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

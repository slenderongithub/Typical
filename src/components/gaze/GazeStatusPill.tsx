"use client";

import { GlassDot, type GlassDotProps } from "@/components/glass";
import { useGazeStore } from "@/lib/gaze/store";
import type { GazeStatusKind } from "@/lib/types";

const STATUS_META: Record<
  GazeStatusKind,
  { tone: GlassDotProps["tone"]; label: string }
> = {
  inactive: { tone: "faint", label: "camera off" },
  initializing: { tone: "faint", label: "starting up" },
  calibrating: { tone: "primary", label: "calibrating" },
  ok: { tone: "success", label: "eyes on screen" },
  uncertain: { tone: "warning", label: "uncertain" },
  down: { tone: "danger", label: "looking down" },
  lost: { tone: "danger", label: "tracking lost" },
  multiple: { tone: "warning", label: "multiple faces" },
  error: { tone: "danger", label: "camera error" },
};

/** Always-visible verdict of what the gaze system currently thinks. */
export function GazeStatusPill() {
  const status = useGazeStore((s) => s.status);
  const meta = STATUS_META[status];
  return (
    <span
      className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <GlassDot tone={meta.tone} pulse={status === "ok" || status === "down"} />
      {meta.label}
    </span>
  );
}

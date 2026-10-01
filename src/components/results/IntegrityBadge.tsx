"use client";

import { Eye, EyeOff, VideoOff } from "lucide-react";

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
            label: "untracked",
          };

  return (
    <span
      className={`glass inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium ${meta.tone}`}
    >
      {meta.icon}
      {meta.label}
      {report.trackingLostMs > 1500 && report.integrity !== "untracked" && (
        <span className="text-xs text-faint-foreground">
          · tracking lost {(report.trackingLostMs / 1000).toFixed(1)}s
        </span>
      )}
    </span>
  );
}

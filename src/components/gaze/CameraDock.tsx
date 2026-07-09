"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getController, useGazeStore } from "@/lib/gaze/store";
import type { GazeStatusKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING_TONES: Partial<Record<GazeStatusKind, string>> = {
  ok: "var(--success)",
  uncertain: "var(--warning)",
  multiple: "var(--warning)",
  down: "var(--danger)",
  lost: "var(--danger)",
  error: "var(--danger)",
};

/**
 * Small draggable live-preview card (mirrored) so the user always sees what
 * the camera sees — trust through transparency. Minimizable to a slim pill.
 */
export function CameraDock() {
  const status = useGazeStore((s) => s.status);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (minimized) return;
    const el = videoRef.current;
    const stream = getController().getStream();
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
  }, [minimized, status]);

  const ring = RING_TONES[status] ?? "var(--glass-border)";

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed bottom-5 right-5 z-40 cursor-grab active:cursor-grabbing"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div
        className="glass-strong overflow-hidden rounded-2xl"
        style={{ boxShadow: `0 0 0 1.5px ${ring}, 0 8px 32px -8px var(--glass-shadow)` }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            on-device only
          </span>
          <button
            type="button"
            aria-label={minimized ? "expand camera preview" : "minimize camera preview"}
            onClick={() => setMinimized((v) => !v)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {minimized ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {!minimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className={cn("h-[132px] w-[176px] object-cover", "-scale-x-100")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

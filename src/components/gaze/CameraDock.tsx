"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getController, useGazeStore } from "@/lib/gaze/store";

/**
 * Small draggable live-preview card (mirrored) so the user always sees what
 * the camera sees — trust through transparency. Minimizable to just its
 * status line.
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

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed bottom-5 right-5 z-40 cursor-grab active:cursor-grabbing"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div className="island overflow-hidden rounded-[1.6rem] p-1.5">
        <div className="flex items-center justify-between gap-3 pl-1">
          <span className="pl-2.5 text-[13px] font-semibold text-surface-muted">
            on device
          </span>
          <button
            type="button"
            aria-label={minimized ? "expand camera preview" : "minimize camera preview"}
            onClick={() => setMinimized((v) => !v)}
            className="flex size-8 items-center justify-center rounded-full text-surface-muted transition-colors hover:bg-surface-foreground/10 hover:text-surface-foreground"
          >
            {minimized ? (
              <ChevronUp aria-hidden className="size-4" />
            ) : (
              <ChevronDown aria-hidden className="size-4" />
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
                className="mt-1 h-[132px] w-[176px] -scale-x-100 rounded-[1.1rem] object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

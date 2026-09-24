"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, MousePointerClick } from "lucide-react";

import { GlassDot } from "@/components/glass";

export interface FocusOverlayProps {
  kind: "blur" | "peek" | null;
  onResume: () => void;
}

/**
 * Pause veil over the test area. Tab-blur requires a click to resume;
 * a peek pause resumes itself the moment eyes return to the screen.
 */
export function FocusOverlay({ kind, onResume }: FocusOverlayProps) {
  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.button
            type="button"
            onClick={kind === "blur" ? onResume : undefined}
            className={
              kind === "blur"
                ? "popover flex cursor-pointer items-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
                : "popover flex cursor-default items-center gap-2.5 rounded-full border-danger/30 px-5 py-3 text-sm font-medium text-foreground"
            }
            initial={{ scale: 0.92, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 4 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {kind === "blur" ? (
              <>
                <MousePointerClick className="size-4 text-primary" />
                out of focus — click to resume
              </>
            ) : (
              <>
                <GlassDot tone="danger" pulse />
                <EyeOff className="size-4 text-danger" />
                eyes back on the screen to resume
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

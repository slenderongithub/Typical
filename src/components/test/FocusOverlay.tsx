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
            className="glass-strong flex cursor-pointer items-center gap-3 rounded-full px-6 py-3.5 text-sm text-foreground"
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
                <EyeOff className="size-4 text-danger" />
                <GlassDot tone="danger" pulse />
                eyes back on the screen to resume
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

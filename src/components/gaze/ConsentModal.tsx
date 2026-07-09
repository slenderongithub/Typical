"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cpu, EyeOff, ScanFace, ShieldCheck } from "lucide-react";

import { GlassButton } from "@/components/glass";

const POINTS = [
  {
    icon: ShieldCheck,
    text: "Video never leaves your browser. Nothing is recorded, stored or uploaded — anywhere, ever.",
  },
  {
    icon: Cpu,
    text: "Frames are reduced to a handful of numbers (head angle, eye openness) on your device, used transiently in memory and thrown away.",
  },
  {
    icon: ScanFace,
    text: "This is an honest heuristic — head pose plus eye state — not precise gaze tracking. It detects sustained looks at your keyboard, not where you read.",
  },
  {
    icon: EyeOff,
    text: "It's fully optional. Skip it and everything still works — your runs are simply labeled “untracked” instead of “clean.”",
  },
] as const;

export interface ConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** Plain-language camera consent — shown once before any getUserMedia call. */
export function ConsentModal({ open, onAccept, onDecline }: ConsentModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="camera consent"
        >
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={onDecline}
          />
          <motion.div
            className="glass-strong relative w-full max-w-md rounded-3xl p-7"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="mb-1 flex items-center gap-2.5">
              <span className="glass flex size-9 items-center justify-center rounded-full text-primary">
                <ScanFace className="size-4.5" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                verify your runs with the camera
              </h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Prove you never peeked at the keyboard — the badge real
              touch-typists deserve.
            </p>

            <ul className="mb-7 flex flex-col gap-3.5">
              {POINTS.map(({ icon: Icon, text }, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06 }}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {text}
                </motion.li>
              ))}
            </ul>

            <div className="flex items-center justify-end gap-2">
              <GlassButton variant="ghost" onClick={onDecline}>
                not now
              </GlassButton>
              <GlassButton variant="primary" onClick={onAccept}>
                enable camera
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

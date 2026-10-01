"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, ScanFace, ShieldCheck, VideoOff } from "lucide-react";

/** The privacy facts, short enough to scan — this is the consent screen. */
const FACTS = [
  { icon: ShieldCheck, text: "on-device only" },
  { icon: VideoOff, text: "never recorded" },
  { icon: EyeOff, text: "optional" },
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
          aria-labelledby="consent-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") onDecline();
          }}
        >
          <motion.div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={onDecline}
          />
          <motion.div
            className="island relative flex w-full max-w-md flex-col items-center rounded-[2rem] p-7 text-center"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <span className="btn-primary mb-5 flex size-14 items-center justify-center rounded-full">
              <ScanFace aria-hidden className="size-6" />
            </span>
            <h2
              id="consent-title"
              className="text-2xl font-extrabold tracking-tight text-surface-foreground"
            >
              verify with camera
            </h2>
            <p className="mt-1.5 text-[15px] text-surface-muted">
              proves you never looked at your keyboard
            </p>

            <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
              {FACTS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-1.5 rounded-full bg-surface-foreground/10 px-3 py-1.5 text-[13px] font-medium text-surface-foreground"
                >
                  <Icon aria-hidden className="size-3.5 text-island-accent" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex w-full gap-2">
              <button
                type="button"
                onClick={onDecline}
                className="h-12 flex-1 rounded-full font-semibold text-surface-muted transition-colors hover:bg-surface-foreground/10 hover:text-surface-foreground"
              >
                not now
              </button>
              <button
                type="button"
                autoFocus
                onClick={onAccept}
                className="btn-primary h-12 flex-1 rounded-full font-semibold"
              >
                enable camera
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

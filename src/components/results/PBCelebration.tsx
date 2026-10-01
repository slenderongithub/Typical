"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";

const SPRING = { type: "spring", stiffness: 380, damping: 20 } as const;

/**
 * The personal-best moment, in the island language: a filled accent chip
 * that springs in, throws one outline ripple, catches a single sheen sweep,
 * and gives its trophy a wiggle. No particles, no glow. Reduced motion gets
 * the static chip.
 */
export function PBCelebration({ delta }: { delta?: number | null }) {
  const reduce = useReducedMotion();

  const chip = (
    <>
      <motion.span
        aria-hidden
        className="flex"
        initial={reduce ? false : { rotate: -25, scale: 0.4 }}
        animate={{ rotate: [-25, 14, -8, 0], scale: 1 }}
        transition={reduce ? undefined : { duration: 0.7, delay: 0.25, ease: "easeOut" }}
      >
        <Trophy className="size-[18px]" strokeWidth={2.4} />
      </motion.span>
      new personal best
      {delta != null && delta > 0 && (
        <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs tabular-nums">
          +{delta.toFixed(1)}
        </span>
      )}
    </>
  );

  const chipClass =
    "glass-chip relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full pl-3.5 pr-3 text-sm font-bold text-primary-foreground";

  if (reduce) return <span className={`${chipClass} w-fit`}>{chip}</span>;

  return (
    <span className="relative inline-flex w-fit">
      {/* one outline ripple off the chip's own shape */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-primary"
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: 1.35, opacity: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className={chipClass}
        initial={{ scale: 0.6, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={SPRING}
      >
        {chip}
        {/* sheen sweep */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-10 -skew-x-12 bg-white/40 blur-[2px]"
          initial={{ left: "-30%" }}
          animate={{ left: "130%" }}
          transition={{ duration: 0.75, delay: 0.45, ease: "easeInOut" }}
        />
      </motion.span>
    </span>
  );
}

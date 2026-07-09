"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Deterministic particle fan — no randomness in render. */
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const dist = 64 + (i % 3) * 22;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    size: 3 + (i % 3),
    delay: (i % 6) * 0.02,
    tone: i % 2 === 0 ? "var(--primary)" : "var(--success)",
  };
});

/**
 * The personal-best moment: one expanding glow ring + a burst of tiny glass
 * shards + a popping label. Runs once (~1.6s); reduced motion gets a fade.
 */
export function PBCelebration() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-full bg-glass-strong px-3 py-1 text-xs font-semibold text-success"
      >
        new personal best
      </motion.span>
    );
  }

  return (
    <span className="pointer-events-none relative inline-flex items-center justify-center">
      {/* expanding ring */}
      <motion.span
        aria-hidden
        className="absolute rounded-full border-2 border-primary"
        style={{ width: 56, height: 56 }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* shards */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size, backgroundColor: p.tone }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: 200 }}
          transition={{
            duration: 1.25,
            delay: p.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}
      {/* label pop */}
      <motion.span
        className="relative z-10 whitespace-nowrap rounded-full bg-glass-strong px-3.5 py-1.5 text-xs font-semibold text-success shadow-[0_0_24px_-4px] shadow-success/40"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.1 }}
      >
        new personal best
      </motion.span>
    </span>
  );
}

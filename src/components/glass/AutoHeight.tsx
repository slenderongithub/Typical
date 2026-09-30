"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Springs its height to fit its content. Swapping filtered content then
 * glides instead of snapping — which also stops the page (and anything the
 * user is looking at) jumping when a list near the bottom shrinks.
 */
/** Padding belongs on a child, not `className` — the outer box is sized to the child. */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      className={className}
      style={{ overflow: "hidden" }}
      initial={false}
      animate={{ height }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 34 }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

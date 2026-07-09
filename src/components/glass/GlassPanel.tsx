"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const PADDING = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8 sm:p-10",
} as const;

export interface GlassPanelProps extends HTMLMotionProps<"div"> {
  /** Padding preset — defaults to "md". */
  pad?: keyof typeof PADDING;
  /** Adds hover lift + press feedback (`.glass-interactive`). */
  interactive?: boolean;
}

/**
 * Workhorse glass card: `.glass rounded-3xl` motion.div with padding presets.
 * Accepts all framer-motion div props (initial/animate/variants/…) so screens
 * can stagger panels without extra wrappers.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { pad = "md", interactive = false, className, children, ...rest },
    ref,
  ) {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "glass rounded-3xl",
          PADDING[pad],
          interactive && "glass-interactive",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);

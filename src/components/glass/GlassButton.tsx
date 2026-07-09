"use client";

import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 gap-1.5 px-3.5 text-[0.8125rem]",
  md: "h-10 gap-2 px-5 text-sm",
  lg: "h-12 gap-2.5 px-7 text-base",
} as const;

const VARIANTS = {
  default: "glass glass-interactive text-foreground",
  primary:
    "bg-primary text-primary-foreground border border-glass-border shadow-lg shadow-primary/35 hover:bg-primary-strong hover:shadow-xl hover:shadow-primary/35",
  ghost:
    "border border-transparent bg-transparent text-muted-foreground transition-colors duration-200 hover:bg-glass hover:text-foreground",
  danger:
    "glass glass-interactive bg-danger/10 text-danger hover:border-danger/40",
} as const;

/* These handler names collide between React DOM attributes and framer-motion
   gesture props — they are dropped from the public API so the rest can spread
   cleanly onto motion.button. */
type MotionConflicts = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart";

export interface GlassButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, MotionConflicts> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Leading icon, rendered before children. */
  icon?: ReactNode;
}

/**
 * Pill-shaped glass button. `primary` carries a soft primary glow; the rest
 * stay translucent. Spring micro-interactions (tap 0.96, hover -1px) are
 * skipped under reduced motion.
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    { variant = "default", size = "md", icon, className, children, ...rest },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        whileHover={reduceMotion ? undefined : { y: -1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-medium",
          "disabled:pointer-events-none disabled:opacity-50",
          SIZES[size],
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {icon && (
          <span aria-hidden className="inline-flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">
            {icon}
          </span>
        )}
        {children}
      </motion.button>
    );
  },
);

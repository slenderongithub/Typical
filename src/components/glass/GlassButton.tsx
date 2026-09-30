"use client";

import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: { base: "h-8 gap-1.5 px-3.5 text-[0.8125rem]", lead: "pl-2.5", square: "size-8" },
  md: { base: "h-10 gap-2 px-[1.125rem] text-sm", lead: "pl-3.5", square: "size-10" },
  lg: { base: "h-12 gap-2 px-6 text-[0.9375rem]", lead: "pl-5", square: "size-12" },
} as const;

const VARIANTS = {
  default: "glass glass-interactive text-foreground",
  primary: "btn-primary border border-transparent",
  /** opaque palette surface floating over the background */
  island: "island transition-[filter] duration-200 hover:brightness-110",
  ghost:
    "border border-transparent bg-transparent text-muted-foreground transition-colors duration-200 hover:bg-glass-strong hover:text-foreground",
  danger:
    "glass glass-interactive border-danger/25 bg-danger/10 text-danger hover:border-danger/45 hover:bg-danger/15",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/**
 * Class recipe shared by GlassButton and link-styled-as-button call sites
 * (`<Link className={buttonClasses(...)}>`) — so a link never has to wrap a
 * `<button>`, which is invalid nested interactive content.
 */
export function buttonClasses({
  variant = "default",
  size = "md",
  hasIcon = false,
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  iconOnly?: boolean;
  className?: string;
} = {}) {
  const s = SIZES[size];
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-medium",
    "disabled:pointer-events-none disabled:opacity-45",
    // icon-only buttons are square; a leading icon gets optical side padding
    iconOnly ? cn(s.square, "p-0") : cn(s.base, hasIcon && s.lead),
    VARIANTS[variant],
    className,
  );
}

/* These handler names collide between React DOM attributes and framer-motion
   gesture props — they are dropped from the public API so the rest can spread
   cleanly onto motion.button. */
type MotionConflicts = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart";

export interface GlassButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, MotionConflicts> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon, rendered before children. */
  icon?: ReactNode;
}

/**
 * Pill-shaped glass button. `primary` is the one filled accent; the rest
 * stay translucent. Spring micro-interactions (tap 0.96, hover -1px) are
 * skipped under reduced motion.
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    { variant = "default", size = "md", icon, className, children, ...rest },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    const hasChildren = children !== undefined && children !== null && children !== false;
    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        whileHover={reduceMotion ? undefined : { y: -1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }}
        className={buttonClasses({
          variant,
          size,
          hasIcon: !!icon,
          iconOnly: !!icon && !hasChildren,
          className,
        })}
        {...rest}
      >
        {icon && (
          <span
            aria-hidden
            className="inline-flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]"
          >
            {icon}
          </span>
        )}
        {children}
      </motion.button>
    );
  },
);

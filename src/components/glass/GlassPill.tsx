"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface GlassPillOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface GlassPillProps {
  options: GlassPillOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
  /** `flat` drops the glass track — for pills nested inside another surface. */
  variant?: "glass" | "flat";
  /** Stretch segments equally across the available width. */
  fullWidth?: boolean;
}

const SIZES = {
  sm: "h-7 px-3 text-[0.8125rem]",
  md: "h-9 px-4 text-sm",
} as const;

/**
 * Segmented glass control (radiogroup semantics). The active chip is a shared
 * layoutId motion.div so selection slides fluidly between segments.
 */
export function GlassPill({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
  variant = "glass",
  fullWidth = false,
}: GlassPillProps) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();
  const groupRef = useRef<HTMLDivElement>(null);
  const hasActive = options.some((o) => o.value === value);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>("button[role=radio]");
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-center gap-0.5 rounded-full",
        variant === "glass" && "glass p-1",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((opt, idx) => {
        const active = opt.value === value;
        // keep the group reachable by Tab even when no segment is selected
        const tabbable = active || (!hasActive && idx === 0);
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex select-none items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-200",
              SIZES[size],
              fullWidth && "flex-1",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full border border-glass-border bg-glass-strong shadow-[inset_0_1px_0_0_var(--glass-highlight),0_1px_3px_-1px_var(--glass-shadow)]"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
            {opt.icon && (
              <span aria-hidden className="relative inline-flex shrink-0 items-center [&>svg]:h-[1em] [&>svg]:w-[1em]">
                {opt.icon}
              </span>
            )}
            <span className="relative whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

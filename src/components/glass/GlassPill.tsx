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
}

const SIZES = {
  sm: "px-2.5 py-1 text-[0.8125rem]",
  md: "px-3.5 py-1.5 text-sm",
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
}: GlassPillProps) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();
  const groupRef = useRef<HTMLDivElement>(null);

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
        "glass flex items-center gap-0.5 rounded-full p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex select-none items-center gap-1.5 rounded-full font-medium transition-colors duration-200",
              SIZES[size],
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-glass-strong shadow-[inset_0_1px_0_0_var(--glass-highlight)]"
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

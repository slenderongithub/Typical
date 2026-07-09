"use client";

import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success text-success",
  warning: "bg-warning text-warning",
  danger: "bg-danger text-danger",
  primary: "bg-primary text-primary",
  faint: "bg-faint-foreground text-faint-foreground",
} as const;

export interface GlassDotProps {
  tone: keyof typeof TONES;
  /** Gentle ripple pulse (`.gaze-dot` keyframes use currentColor). */
  pulse?: boolean;
  className?: string;
}

/** 8px status dot — the gaze indicator and integrity markers. */
export function GlassDot({ tone, pulse = false, className }: GlassDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        TONES[tone],
        pulse && "gaze-dot",
        className,
      )}
    />
  );
}

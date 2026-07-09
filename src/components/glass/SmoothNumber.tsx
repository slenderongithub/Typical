"use client";

import NumberFlow, { type Format } from "@number-flow/react";

import { cn } from "@/lib/utils";

export interface SmoothNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: Format;
  className?: string;
  /** Columns of numbers need tabular figures; display sizes stay proportional. */
  tabular?: boolean;
}

/** Animated numeric display — digits roll fluidly via NumberFlow. */
export function SmoothNumber({
  value,
  prefix,
  suffix,
  format,
  className,
  tabular = false,
}: SmoothNumberProps) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={format}
      className={cn(tabular && "tabular-nums", className)}
    />
  );
}

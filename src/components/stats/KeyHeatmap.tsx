"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import type { KeyStat } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const DIGITS = "1234567890";
/** Real-keyboard stagger offsets per row (in key-width fractions). */
const ROW_OFFSETS = [0, 0.35, 0.85];
/** Key width in rem — the stagger offsets are scaled against this. */
const KEY_REM = 3;

export interface KeyHeatmapProps {
  keyStats: Record<string, KeyStat>;
}

/**
 * QWERTY keyboard tinted by per-key miss rate — a sequential single-hue scale
 * from transparent to danger at ≥40% misses. Hovering (or focusing) a key pops
 * the cap and shows its accuracy in the header readout, so nothing overlaps.
 */
export function KeyHeatmap({ keyStats }: KeyHeatmapProps) {
  const [tip, setTip] = useState<string | null>(null);

  const hasDigits = useMemo(
    () =>
      DIGITS.split("").some((d) => {
        const s = keyStats[d];
        return s && s.hits + s.misses > 0;
      }),
    [keyStats],
  );

  const rows = hasDigits ? [DIGITS, ...ROWS] : ROWS;
  const offsets = hasDigits ? [0, ...ROW_OFFSETS] : ROW_OFFSETS;

  const active = tip
    ? (() => {
        const s = keyStats[tip];
        const total = s ? s.hits + s.misses : 0;
        return {
          key: tip,
          total,
          misses: s?.misses ?? 0,
          rate: total > 0 ? (s!.misses / total) : 0,
        };
      })()
    : null;

  const renderKey = (k: string) => {
    const s = keyStats[k];
    const total = s ? s.hits + s.misses : 0;
    const rate = total > 0 ? s!.misses / total : 0;
    // transparent → danger, saturating at a 40% miss rate
    const tint = total > 0 ? clamp((rate / 0.4) * 46, 0, 46) : 0;
    const isActive = tip === k;
    const hasData = total > 0;

    return (
      <motion.button
        key={k}
        type="button"
        aria-label={
          hasData
            ? `${k}: ${s!.misses} misses of ${total} (${Math.round(rate * 100)}%)`
            : `${k}: no data`
        }
        className={cn(
          "relative flex size-11 items-center justify-center rounded-xl border font-mono sm:size-12",
          hasData
            ? "border-glass-border glass text-foreground"
            : "border-glass-border/60 glass-subtle text-faint-foreground",
        )}
        style={{
          backgroundColor:
            tint > 0
              ? `color-mix(in oklch, var(--danger) ${tint}%, var(--glass))`
              : undefined,
          boxShadow: isActive
            ? "0 0 0 2px color-mix(in oklch, var(--primary) 70%, transparent), 0 10px 28px -8px var(--glass-shadow)"
            : undefined,
          zIndex: isActive ? 10 : undefined,
        }}
        animate={{ scale: isActive ? 1.16 : 1, y: isActive ? -5 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 26 }}
        onMouseEnter={() => setTip(k)}
        onMouseLeave={() => setTip((c) => (c === k ? null : c))}
        onFocus={() => setTip(k)}
        onBlur={() => setTip((c) => (c === k ? null : c))}
      >
        <motion.span
          animate={{
            scale: isActive ? 1.4 : 1,
            fontWeight: isActive ? 700 : 400,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={cn(
            "text-base leading-none",
            isActive && "text-foreground",
          )}
        >
          {k}
        </motion.span>
      </motion.button>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            per-key accuracy
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            redder keys are the ones your fingers miss most
          </p>
        </div>
        {/* live readout — never overlaps the keys, always legible */}
        <div className="flex h-9 items-center">
          <AnimatePresence mode="wait">
            {active && active.total > 0 ? (
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.14 }}
                className="flex items-center gap-2.5 rounded-full border border-glass-border bg-glass px-2.5 py-1.5"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-glass-strong font-mono text-sm font-semibold text-foreground">
                  {active.key}
                </span>
                <span className="text-xs">
                  <span
                    className={cn(
                      "font-semibold",
                      active.rate > 0.15 ? "text-danger" : "text-success",
                    )}
                  >
                    {Math.round(active.rate * 100)}% missed
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {active.misses} of {active.total}
                  </span>
                </span>
              </motion.div>
            ) : (
              <motion.span
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-faint-foreground"
              >
                hover a key
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 overflow-x-auto pb-2 pt-1">
        {rows.map((row, i) => (
          <div
            key={row}
            className="flex gap-2"
            style={{ marginLeft: `${offsets[i] * KEY_REM}rem` }}
          >
            {row.split("").map(renderKey)}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { KeyStat } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const DIGITS = "1234567890";
/** what punctuation mode and quotes actually produce */
const PUNCT = ".,'\"-?!;:()";
/** Real-keyboard stagger offsets per row (in key-width fractions). */
const ROW_OFFSETS = [0, 0.35, 0.85];
/** Key width in rem (matches `sm:size-14`) — stagger offsets scale against it. */
const KEY_REM = 3.5;

export interface KeyHeatmapProps {
  keyStats: Record<string, KeyStat>;
}

/**
 * QWERTY keyboard tinted by per-key miss rate — a sequential single-hue scale
 * from transparent to the theme accent at ≥40% misses. Hovering (or focusing) a key pops
 * the cap and shows its accuracy in the header readout, so nothing overlaps.
 */
export function KeyHeatmap({ keyStats }: KeyHeatmapProps) {
  const [tip, setTip] = useState<string | null>(null);

  const used = (set: string) =>
    set.split("").some((k) => {
      const s = keyStats[k];
      return s && s.hits + s.misses > 0;
    });
  // on by default only when there's data to show
  const [showDigits, setShowDigits] = useState(() => used(DIGITS));
  const [showPunct, setShowPunct] = useState(() => used(PUNCT));

  const rows = [...(showDigits ? [DIGITS] : []), ...ROWS, ...(showPunct ? [PUNCT] : [])];
  const offsets = [...(showDigits ? [0] : []), ...ROW_OFFSETS, ...(showPunct ? [0.35] : [])];

  const toggle = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      className={cn(
        "h-7 rounded-full px-3 text-xs font-semibold transition-colors",
        on
          ? "bg-primary text-primary-foreground"
          : "glass-subtle text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

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
    // transparent → theme accent, saturating at a 40% miss rate
    const tint = total > 0 ? clamp((rate / 0.4) * 85, 0, 85) : 0;
    // once the accent dominates, its own text colour keeps the letter legible
    const onAccent = tint > 50;
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
          "relative flex size-12 items-center justify-center rounded-xl border font-mono sm:size-14",
          hasData
            ? cn("glass", onAccent ? "text-primary-foreground" : "text-foreground")
            : "glass-subtle text-faint-foreground",
        )}
        style={{
          backgroundColor:
            tint > 0
              ? `color-mix(in srgb, var(--primary) ${tint}%, var(--glass))`
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
            "text-lg leading-none",
            isActive && !onAccent && "text-foreground",
          )}
        >
          {k}
        </motion.span>
      </motion.button>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="card-title mr-1">per-key accuracy</h3>
          {toggle("numbers", showDigits, setShowDigits)}
          {toggle("punctuation", showPunct, setShowPunct)}
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

      {/* The scroll container clips both axes, so it needs generous padding —
          otherwise the hover "pop" (lift + scale + ring) on the top row and the
          left/right edge keys gets cut off. `mx-auto` centres the keyboard when
          it fits and collapses to a left-aligned scroll when it doesn't. */}
      <div className="overflow-x-auto px-4 pb-4 pt-6">
        <div className="mx-auto flex w-max flex-col items-start gap-2.5">
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
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Palette, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { PILL_SPRING } from "./GlassPill";
import { startThemeTransition } from "./theme-transition";

/**
 * Swatch previews of *other* themes — the one sanctioned exception to the
 * token-only color rule, since tokens can only describe the active theme.
 */
export const THEMES = [
  { name: "midnight", swatch: "#9dabff", bg: "#10132a", fg: "#f7f8ff" },
  { name: "dawn", swatch: "#4453e6", bg: "#eef0fb", fg: "#0c0e1a" },
  { name: "aurora", swatch: "#5ff2c0", bg: "#0a1e1c", fg: "#f1fff9" },
  { name: "sunset", swatch: "#ffa57e", bg: "#22120e", fg: "#fff6f1" },
  { name: "basil", swatch: "#a9c4a5", bg: "#4a3228", fg: "#fbf3ec" },
  { name: "cannoli", swatch: "#d32e5e", bg: "#f1efe2", fg: "#0f2a1c" },
  { name: "pigeon", swatch: "#c4ec3a", bg: "#34373c", fg: "#fbeeeb" },
  { name: "poseidon", swatch: "#f5904a", bg: "#123955", fg: "#f3f9fd" },
] as const;

/** Palette button — toggles the nav into its theme-picking state. */
export function ThemeToggle({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "close theme picker" : "change theme"}
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border transition-colors",
        open
          ? "glass-chip text-foreground"
          : "border-transparent text-muted-foreground hover:bg-glass-strong hover:text-foreground",
      )}
    >
      {open ? <X className="size-[18px]" /> : <Palette className="size-[18px]" />}
    </button>
  );
}

/**
 * The theme row that replaces the nav links while the picker is open —
 * symmetric, centred in the bar, and selection slides like every other tab.
 */
export function ThemeSwatches({ onPicked }: { onPicked: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label="theme" className="flex items-center gap-0.5">
      {THEMES.map((t) => {
        const active = mounted && theme === t.name;
        return (
          <button
            key={t.name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.name}
            title={t.name}
            onClick={() => {
              onPicked();
              if (!active) startThemeTransition(() => setTheme(t.name));
            }}
            className={cn(
              "relative flex size-10 items-center justify-center rounded-full transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-active"
                className="glass-chip absolute inset-0 rounded-full"
                transition={PILL_SPRING}
              />
            )}
            <span
              aria-hidden
              className="relative flex size-6 items-center justify-center rounded-full shadow-[0_0_0_1.5px_rgba(255,255,255,0.35),0_2px_6px_-1px_rgba(0,0,0,0.5)]"
              style={{ backgroundColor: t.bg }}
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.swatch }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

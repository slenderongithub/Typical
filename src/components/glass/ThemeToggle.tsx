"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { startThemeTransition } from "./theme-transition";

/**
 * Swatch previews of *other* themes — the one sanctioned exception to the
 * token-only color rule, since tokens can only describe the active theme.
 */
export const THEMES = [
  { name: "midnight", swatch: "#8b9cff", bg: "#07080d", fg: "#eceef6" },
  { name: "dawn", swatch: "#4f5ce6", bg: "#f4f4f7", fg: "#15171f" },
  { name: "aurora", swatch: "#4fe0ad", bg: "#050c0b", fg: "#e5f4ee" },
  { name: "sunset", swatch: "#ff9468", bg: "#0d0807", fg: "#f7ede7" },
] as const;

/** Compact theme switcher — polygon view-transition reveal on select. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="change theme"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-glass-strong hover:text-foreground",
          open && "bg-glass-strong text-foreground",
        )}
      >
        <Palette className="size-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="popover absolute right-0 top-full z-50 mt-2.5 flex w-44 flex-col gap-0.5 rounded-2xl p-1.5"
            role="menu"
          >
            {THEMES.map((t) => {
              const active = mounted && theme === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setOpen(false);
                    if (!active) startThemeTransition(() => setTheme(t.name));
                  }}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors",
                    active
                      ? "bg-glass-strong text-foreground"
                      : "text-muted-foreground hover:bg-glass-strong hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-5 items-center justify-center rounded-md ring-1 ring-inset ring-glass-border"
                    style={{ backgroundColor: t.bg }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: t.swatch }}
                    />
                  </span>
                  {t.name}
                  {active && <Check className="ml-auto size-3.5 text-primary" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

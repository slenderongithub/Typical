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
const THEMES = [
  { name: "midnight", swatch: "#6ea8ff" },
  { name: "dawn", swatch: "#007aff" },
  { name: "aurora", swatch: "#34d399" },
  { name: "sunset", swatch: "#fb923c" },
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
        className="glass glass-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
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
            className="absolute right-0 top-full z-50 mt-2 flex min-w-40 flex-col gap-0.5 rounded-xl border border-glass-border p-1.5"
            // Clean solid dropdown — NOT the frosted `.glass-strong` surface,
            // which read as a big translucent liquid-glass blob. Opaque
            // background + hairline border + a soft contained shadow.
            style={{
              background:
                "color-mix(in oklch, var(--background) 94%, var(--foreground) 6%)",
              boxShadow:
                "0 12px 32px -12px var(--glass-shadow), 0 2px 6px -3px var(--glass-shadow)",
            }}
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
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-glass-strong text-foreground"
                      : "text-muted-foreground hover:bg-glass hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3 rounded-full border border-glass-border"
                    style={{ backgroundColor: t.swatch }}
                  />
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

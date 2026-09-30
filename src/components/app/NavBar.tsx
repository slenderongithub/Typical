"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChartSpline, Keyboard, Settings2, Trophy } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PILL_SPRING, ThemeSwatches, ThemeToggle } from "@/components/glass";
import { useUi } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "test", icon: Keyboard },
  { href: "/stats", label: "stats", icon: ChartSpline },
  { href: "/leaderboard", label: "leaderboard", icon: Trophy },
  { href: "/settings", label: "settings", icon: Settings2 },
] as const;

/** The Typical mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static asset, no optimisation needed
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      className={cn("size-8 shrink-0", className)}
    />
  );
}

/** Floating glass navigation — dims to near-invisible while a test runs. */
export function NavBar() {
  const pathname = usePathname();
  const testRunning = useUi((s) => s.testRunning);
  const { data: session, status } = useSession();
  const [themeOpen, setThemeOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // close the theme row on outside click / Escape / navigation
  useEffect(() => {
    if (!themeOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setThemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThemeOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [themeOpen]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close on route change
  useEffect(() => setThemeOpen(false), [pathname]);

  const initial = (session?.user?.name ?? session?.user?.email ?? "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <motion.header
      className="fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-4 sm:px-4"
      animate={{ opacity: testRunning ? 0.06 : 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: testRunning ? "none" : "auto" }}
    >
      <nav
        ref={navRef}
        className="island flex max-w-full items-center gap-1 rounded-full p-1.5 sm:pl-2"
      >
        <Link
          href="/"
          aria-label="Typical — home"
          className="flex shrink-0 items-center gap-2 rounded-full py-1 pl-0.5 pr-2 text-[17px] font-bold tracking-tight text-surface-foreground sm:pr-3"
        >
          <LogoMark />
          <span className="hidden sm:inline">Typical</span>
        </Link>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={themeOpen ? "themes" : "links"}
            className="flex min-w-0 items-center gap-1"
            initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {themeOpen ? (
              <ThemeSwatches onPicked={() => setThemeOpen(false)} />
            ) : (
              LINKS.map((l) => {
                const active =
                  l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={l.label}
                    className={cn(
                      "relative flex h-10 items-center rounded-full px-3 text-[15px] font-semibold transition-colors sm:px-4",
                      active
                        ? "text-primary-foreground"
                        : "text-surface-muted hover:text-surface-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="glass-chip absolute inset-0 rounded-full"
                        transition={PILL_SPRING}
                      />
                    )}
                    <l.icon aria-hidden className="relative size-[18px] sm:hidden" />
                    <span className="relative hidden sm:inline">{l.label}</span>
                  </Link>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>

        <span aria-hidden className="mx-1 hidden h-6 w-px bg-surface-foreground/15 sm:block" />

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle open={themeOpen} onOpenChange={setThemeOpen} />
          {status === "authenticated" ? (
            <Link
              href="/settings"
              title={session?.user?.name ?? session?.user?.email ?? "account"}
              aria-label="your account"
              className="btn-primary flex size-10 items-center justify-center rounded-full text-sm font-bold"
            >
              {initial}
            </Link>
          ) : (
            <Link
              href="/login"
              className="btn-primary flex h-10 items-center rounded-full px-4 text-sm font-semibold"
            >
              sign in
            </Link>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

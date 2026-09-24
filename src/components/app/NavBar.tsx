"use client";

import { motion } from "framer-motion";
import { ChartSpline, Keyboard, Settings2, Trophy } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/glass";
import { useUi } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "test", icon: Keyboard },
  { href: "/stats", label: "stats", icon: ChartSpline },
  { href: "/leaderboard", label: "leaderboard", icon: Trophy },
  { href: "/settings", label: "settings", icon: Settings2 },
] as const;

/** The Typical mark: an accent tile holding a text caret. */
function LogoMark() {
  return (
    <span
      aria-hidden
      className="btn-primary flex size-6 items-center justify-center rounded-[0.45rem]"
    >
      <span className="h-3 w-[2.5px] rounded-full bg-primary-foreground" />
    </span>
  );
}

/** Floating glass navigation — dims to near-invisible while a test runs. */
export function NavBar() {
  const pathname = usePathname();
  const testRunning = useUi((s) => s.testRunning);
  const { data: session, status } = useSession();

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
      <nav className="glass flex max-w-full items-center gap-1 rounded-full p-1.5 sm:pl-3">
        <Link
          href="/"
          aria-label="Typical — home"
          className="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 text-[15px] font-semibold tracking-tight text-foreground sm:pl-0 sm:pr-3"
        >
          <LogoMark />
          <span className="hidden sm:inline">Typical</span>
        </Link>

        <div className="flex min-w-0 items-center">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                aria-label={l.label}
                className={cn(
                  "relative flex h-8 items-center rounded-full px-2.5 text-sm font-medium transition-colors sm:px-3.5",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full border border-glass-border bg-glass-strong shadow-[inset_0_1px_0_0_var(--glass-highlight)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <l.icon aria-hidden className="relative size-4 sm:hidden" />
                <span className="relative hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-glass-border sm:block" />

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {status === "authenticated" ? (
            <Link
              href="/settings"
              title={session?.user?.name ?? session?.user?.email ?? "account"}
              aria-label="your account"
              className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25 transition-colors hover:bg-primary/25"
            >
              {initial}
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-glass-strong sm:text-sm"
            >
              sign in
            </Link>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

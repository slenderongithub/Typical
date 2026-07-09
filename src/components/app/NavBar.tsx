"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/glass";
import { useUi } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "test" },
  { href: "/stats", label: "stats" },
  { href: "/leaderboard", label: "leaderboard" },
  { href: "/settings", label: "settings" },
] as const;

/** Floating glass navigation — dims to near-invisible while a test runs. */
export function NavBar() {
  const pathname = usePathname();
  const testRunning = useUi((s) => s.testRunning);
  const { data: session, status } = useSession();

  return (
    <motion.header
      className="fixed inset-x-0 top-4 z-40 flex justify-center px-4"
      animate={{ opacity: testRunning ? 0.08 : 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: testRunning ? "none" : "auto" }}
    >
      <nav className="glass flex items-center gap-1 rounded-full py-1.5 pl-4 pr-2">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground"
        >
          <Eye className="size-4 text-primary" aria-hidden />
          Typical
        </Link>

        <div className="flex items-center">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-glass-strong"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-2 flex items-center gap-1.5">
          <ThemeToggle />
          {status === "authenticated" ? (
            <Link
              href="/settings"
              title={session?.user?.name ?? "account"}
              className="glass-interactive glass flex size-8 items-center justify-center rounded-full text-xs font-semibold text-primary"
            >
              {(session?.user?.name ?? "?").slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link
              href="/login"
              className="glass-interactive glass rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              sign in
            </Link>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

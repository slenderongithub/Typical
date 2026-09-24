"use client";

import { motion } from "framer-motion";
import { CloudOff, Trophy } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonClasses, GlassDot, GlassPanel, GlassPill } from "@/components/glass";
import type { LeaderboardEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const DURATIONS = [
  { value: "time-15-p0-n0-normal", label: "15s" },
  { value: "time-30-p0-n0-normal", label: "30s" },
  { value: "time-60-p0-n0-normal", label: "60s" },
  { value: "time-120-p0-n0-normal", label: "120s" },
];
const WINDOWS = [
  { value: "all", label: "all time" },
  { value: "week", label: "this week" },
  { value: "day", label: "today" },
];
const INTEGRITY = [
  { value: "clean", label: "clean only" },
  { value: "all", label: "include assisted" },
];

const INTEGRITY_TONE = {
  clean: "success",
  assisted: "warning",
  untracked: "faint",
} as const;

type FetchState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "ready"; entries: LeaderboardEntry[] };

/** Rank chip — the podium gets filled accents, everyone else a quiet number. */
function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full font-mono text-[13px] font-semibold tabular-nums",
        rank === 1 && "btn-primary",
        rank === 2 && "bg-primary/20 text-primary ring-1 ring-inset ring-primary/30",
        rank === 3 && "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
        rank > 3 && "text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

/** Global rankings — filters in one row, clean runs by default. */
export function LeaderboardView() {
  const { data: session } = useSession();
  const [configKey, setConfigKey] = useState("time-30-p0-n0-normal");
  const [window_, setWindow] = useState("all");
  const [integrity, setIntegrity] = useState("clean");
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    // abort the in-flight request when filters change, so a slow earlier
    // response can never overwrite the board for the newer selection
    const ctrl = new AbortController();
    const run = async () => {
      if (hasLoaded.current) setRefreshing(true);
      try {
        const params = new URLSearchParams({ configKey, window: window_, integrity });
        const res = await fetch(`/api/leaderboard?${params}`, { signal: ctrl.signal });
        if (res.status === 503) {
          setState({ kind: "offline" });
          return;
        }
        const data = (await res.json()) as { entries?: LeaderboardEntry[] };
        setState({ kind: "ready", entries: data.entries ?? [] });
        hasLoaded.current = true;
      } catch {
        if (!ctrl.signal.aborted) setState({ kind: "offline" });
      } finally {
        if (!ctrl.signal.aborted) setRefreshing(false);
      }
    };
    void run();
    return () => ctrl.abort();
  }, [configKey, window_, integrity]);

  const me = session?.user?.name ?? null;

  return (
    <div>
      {/* one filter row above the content it scopes */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <GlassPill
          size="sm"
          ariaLabel="test duration"
          options={DURATIONS}
          value={configKey}
          onChange={setConfigKey}
        />
        <GlassPill
          size="sm"
          ariaLabel="time window"
          options={WINDOWS}
          value={window_}
          onChange={setWindow}
        />
        <GlassPill
          size="sm"
          ariaLabel="integrity filter"
          options={INTEGRITY}
          value={integrity}
          onChange={setIntegrity}
        />
      </div>

      {state.kind === "offline" && (
        <GlassPanel pad="lg" className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-glass-strong text-muted-foreground ring-1 ring-inset ring-glass-border">
            <CloudOff className="size-5" />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            the leaderboard is offline
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            this deployment has no database connected — your own history and
            stats still work perfectly in local mode.
          </p>
        </GlassPanel>
      )}

      {state.kind === "loading" && (
        <div className="glass overflow-hidden rounded-3xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[3.75rem] items-center gap-4 border-t border-glass-border px-5 first:border-t-0"
            >
              <span className="size-8 animate-pulse rounded-full bg-glass-strong" />
              <span className="h-3 w-32 animate-pulse rounded-full bg-glass-strong" />
              <span className="ml-auto h-3 w-16 animate-pulse rounded-full bg-glass-strong" />
            </div>
          ))}
        </div>
      )}

      {state.kind === "ready" && state.entries.length === 0 && (
        <GlassPanel pad="lg" className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Trophy className="size-5" />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            no runs on this board yet
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            sign in and finish a live test in this mode to claim the top spot.
          </p>
          <Link href="/" className={buttonClasses({ variant: "primary", size: "sm", className: "mt-1" })}>
            take a test
          </Link>
        </GlassPanel>
      )}

      {state.kind === "ready" && state.entries.length > 0 && (
        <div
          className={cn(
            "glass overflow-hidden rounded-3xl transition-opacity",
            refreshing && "opacity-60",
          )}
        >
          <div className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-x-4 border-b border-glass-border px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:grid-cols-[2rem_1fr_7rem_4rem_5.5rem]">
            <span className="text-center">#</span>
            <span>typist</span>
            <span className="hidden sm:block">integrity</span>
            <span className="text-right">acc</span>
            <span className="text-right">wpm</span>
          </div>
          <motion.ol
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.03 } } }}
          >
            {state.entries.map((e) => {
              const isMe = me !== null && e.displayName === me;
              return (
                <motion.li
                  key={`${e.rank}-${e.displayName}`}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 340, damping: 30 },
                    },
                  }}
                  className={cn(
                    "grid grid-cols-[2rem_1fr_auto_auto] items-center gap-x-4 border-t border-glass-border px-5 py-3 first:border-t-0 sm:grid-cols-[2rem_1fr_7rem_4rem_5.5rem]",
                    isMe && "bg-primary/[0.07]",
                  )}
                >
                  <RankBadge rank={e.rank} />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {e.displayName}
                    </span>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                        you
                      </span>
                    )}
                  </span>
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <GlassDot tone={INTEGRITY_TONE[e.integrity]} />
                    {e.integrity}
                  </span>
                  <span className="text-right text-sm tabular-nums text-muted-foreground">
                    {Math.round(e.accuracy)}%
                  </span>
                  <span className="text-right text-base font-semibold tabular-nums text-foreground">
                    {Math.round(e.wpm)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      wpm
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </motion.ol>
        </div>
      )}
    </div>
  );
}

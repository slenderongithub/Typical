"use client";

import { motion } from "framer-motion";
import { CloudOff, Medal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GlassDot, GlassPanel, GlassPill } from "@/components/glass";
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

/** Global rankings — filters in one row, clean runs by default. */
export function LeaderboardView() {
  const [configKey, setConfigKey] = useState("time-30-p0-n0-normal");
  const [window_, setWindow] = useState("all");
  const [integrity, setIntegrity] = useState("clean");
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    const ctrl = new AbortController();
    if (hasLoaded.current) setRefreshing(true);
    try {
      const params = new URLSearchParams({
        configKey,
        window: window_,
        integrity,
      });
      const res = await fetch(`/api/leaderboard?${params}`, {
        signal: ctrl.signal,
      });
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
      setRefreshing(false);
    }
    return () => ctrl.abort();
  }, [configKey, window_, integrity]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-filter-change; state updates land async
    void load();
  }, [load]);

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
          <CloudOff className="size-6 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            leaderboard needs a configured database
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            you&apos;re in local mode — your own history and stats still work
            perfectly. Set DATABASE_URL to light this page up.
          </p>
        </GlassPanel>
      )}

      {state.kind === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass h-14 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {state.kind === "ready" && (
        <motion.div
          className={cn(
            "flex flex-col gap-2 transition-opacity",
            refreshing && "opacity-50",
          )}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.03 } } }}
        >
          {state.entries.length === 0 && (
            <GlassPanel pad="lg" className="text-center">
              <p className="text-sm text-muted-foreground">
                no runs here yet — be the first clean run on the board
              </p>
            </GlassPanel>
          )}
          {state.entries.map((e) => (
            <motion.div
              key={`${e.rank}-${e.displayName}`}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 340, damping: 30 },
                },
              }}
              className={cn(
                "glass flex items-center gap-4 rounded-2xl px-5 py-3.5",
                e.rank <= 3 &&
                  "shadow-[0_0_28px_-8px] shadow-primary/40 bg-glass-strong",
              )}
            >
              <span
                className={cn(
                  "w-8 text-center font-mono text-sm tabular-nums",
                  e.rank <= 3 ? "text-primary" : "text-faint-foreground",
                )}
              >
                {e.rank <= 3 ? <Medal className="mx-auto size-4" /> : e.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {e.displayName}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GlassDot tone={INTEGRITY_TONE[e.integrity]} />
                {e.integrity}
              </span>
              <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(e.accuracy)}%
              </span>
              <span className="w-16 text-right font-semibold tabular-nums text-foreground">
                {Math.round(e.wpm)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  wpm
                </span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

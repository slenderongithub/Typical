"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassButton, GlassDot, GlassPill } from "@/components/glass";
import type {
  IntegrityStatus,
  SavedResult,
  TestMode,
  TickSample,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const MODE_FILTERS = [
  { value: "all", label: "all" },
  { value: "time", label: "time" },
  { value: "words", label: "words" },
  { value: "quote", label: "quote" },
  { value: "zen", label: "zen" },
  { value: "custom", label: "custom" },
];
const INTEGRITY_FILTERS = [
  { value: "all", label: "all" },
  { value: "clean", label: "clean" },
  { value: "assisted", label: "assisted" },
  { value: "untracked", label: "untracked" },
];

const INTEGRITY_TONE: Record<IntegrityStatus, "success" | "warning" | "faint"> = {
  clean: "success",
  assisted: "warning",
  untracked: "faint",
};

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  const mins = Math.floor(d / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** 60×24 inline sparkline of one run's per-second wpm. */
function Sparkline({ timeline }: { timeline: TickSample[] }) {
  if (timeline.length < 2) return null;
  const max = Math.max(...timeline.map((t) => t.wpm), 1);
  const pts = timeline
    .map(
      (t, i) =>
        `${((i / (timeline.length - 1)) * 58 + 1).toFixed(1)},${(
          23 -
          (t.wpm / max) * 20
        ).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg width={60} height={24} aria-hidden className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface HistoryTableProps {
  results: SavedResult[];
}

/** Full filterable, paginated test history with expandable run details. */
export function HistoryTable({ results }: HistoryTableProps) {
  const [mode, setMode] = useState("all");
  const [integrity, setIntegrity] = useState("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      results.filter(
        (r) =>
          (mode === "all" || r.mode === (mode as TestMode)) &&
          (integrity === "all" || r.integrity === (integrity as IntegrityStatus)),
      ),
    [results, mode, integrity],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pages - 1);
  const items = filtered.slice(
    clampedPage * PAGE_SIZE,
    (clampedPage + 1) * PAGE_SIZE,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-medium text-foreground">history</h3>
        <GlassPill
          size="sm"
          ariaLabel="filter by mode"
          options={MODE_FILTERS}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setPage(0);
          }}
        />
        <GlassPill
          size="sm"
          ariaLabel="filter by integrity"
          options={INTEGRITY_FILTERS}
          value={integrity}
          onChange={(v) => {
            setIntegrity(v);
            setPage(0);
          }}
        />
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          no runs match these filters
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pl-3 font-medium">when</th>
                <th className="pb-2 font-medium">mode</th>
                <th className="pb-2 text-right font-medium">wpm</th>
                <th className="pb-2 text-right font-medium">acc</th>
                <th className="pb-2 text-right font-medium">cons</th>
                <th className="pb-2 pl-6 font-medium">integrity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <HistoryRow
                  key={r.id}
                  result={r}
                  expanded={expanded === r.id}
                  onToggle={() =>
                    setExpanded((e) => (e === r.id ? null : r.id))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <GlassButton
            size="sm"
            variant="ghost"
            icon={<ChevronLeft />}
            disabled={clampedPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="previous page"
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {clampedPage + 1} / {pages}
          </span>
          <GlassButton
            size="sm"
            variant="ghost"
            icon={<ChevronRight />}
            disabled={clampedPage >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            aria-label="next page"
          />
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  result: r,
  expanded,
  onToggle,
}: {
  result: SavedResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-t border-glass-border transition-colors hover:bg-glass-subtle",
          expanded && "bg-glass-subtle",
        )}
        onClick={onToggle}
      >
        <td
          className="py-2.5 pl-3 text-muted-foreground"
          title={new Date(r.createdAt).toLocaleString()}
        >
          {relativeTime(r.createdAt)}
        </td>
        <td>
          <span className="glass-subtle rounded-full px-2.5 py-0.5 text-xs text-muted-foreground">
            {r.mode === "time"
              ? `time ${r.config.duration}`
              : r.mode === "words"
                ? `words ${r.config.wordCount}`
                : r.mode}
          </span>
        </td>
        <td className="text-right font-semibold tabular-nums text-foreground">
          {Math.round(r.wpm)}
        </td>
        <td className="text-right tabular-nums text-muted-foreground">
          {Math.round(r.accuracy)}%
        </td>
        <td className="text-right tabular-nums text-muted-foreground">
          {Math.round(r.consistency)}%
        </td>
        <td className="pl-6">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GlassDot tone={INTEGRITY_TONE[r.integrity]} />
            {r.integrity}
          </span>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={6} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-3 text-xs text-muted-foreground">
                  <Sparkline timeline={r.timeline} />
                  <span>
                    raw <span className="text-foreground">{Math.round(r.rawWpm)}</span>
                  </span>
                  <span>
                    chars{" "}
                    <span className="text-foreground">
                      {r.chars.correct}/{r.chars.incorrect}/{r.chars.extra}/
                      {r.chars.missed}
                    </span>
                  </span>
                  <span>
                    duration{" "}
                    <span className="text-foreground">
                      {(r.durationMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                  {r.integrity !== "untracked" && (
                    <span>
                      peeks{" "}
                      <span className="text-foreground">
                        {r.peekCount} · {(r.peekTotalMs / 1000).toFixed(1)}s
                      </span>
                    </span>
                  )}
                  {r.config.punctuation && <span>punctuation</span>}
                  {r.config.numbers && <span>numbers</span>}
                  {r.config.difficulty !== "normal" && (
                    <span>{r.config.difficulty}</span>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

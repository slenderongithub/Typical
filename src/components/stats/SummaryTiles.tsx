"use client";

import { SmoothNumber } from "@/components/glass";
import type { summarize } from "@/lib/storage/aggregate";

function humanizeMs(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col gap-2 rounded-2xl px-5 py-4">
      <span className="eyebrow">{label}</span>
      <span className="flex h-9 items-center text-[1.875rem] font-bold tabular-nums tracking-tight text-foreground">
        {children}
      </span>
    </div>
  );
}

export interface SummaryTilesProps {
  summary: ReturnType<typeof summarize>;
}

/** Headline numbers for the stats page. */
export function SummaryTiles({ summary }: SummaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="tests taken">
        <SmoothNumber value={summary.tests} />
      </Tile>
      <Tile label="best wpm">
        <SmoothNumber value={Math.round(summary.bestWpm)} />
      </Tile>
      <Tile label="avg wpm">
        <SmoothNumber value={Math.round(summary.avgWpm)} />
      </Tile>
      <Tile label="avg accuracy">
        <SmoothNumber value={Math.round(summary.avgAccuracy)} suffix="%" />
      </Tile>
      <Tile label="time typing">{humanizeMs(summary.totalTimeMs)}</Tile>
      <Tile label="clean runs">
        <SmoothNumber value={Math.round(summary.cleanRate * 100)} suffix="%" />
      </Tile>
    </div>
  );
}

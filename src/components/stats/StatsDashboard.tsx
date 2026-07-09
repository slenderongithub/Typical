"use client";

import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { GlassButton, GlassPanel } from "@/components/glass";
import {
  aggregateKeyStats,
  aggregateMissedWords,
  summarize,
} from "@/lib/storage/aggregate";
import { getResults, getStreak } from "@/lib/storage/local";
import type { SavedResult, StreakInfo } from "@/lib/types";

import { HistoryTable } from "./HistoryTable";
import { KeyHeatmap } from "./KeyHeatmap";
import { MissedWords } from "./MissedWords";
import { PeekTrend } from "./PeekTrend";
import { ProgressChart } from "./ProgressChart";
import { StreakCard } from "./StreakCard";
import { SummaryTiles } from "./SummaryTiles";

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass h-[88px] animate-pulse rounded-3xl" />
      ))}
    </div>
  );
}

/** The whole local-history dashboard — loads from IndexedDB on mount. */
export function StatsDashboard() {
  const router = useRouter();
  const [results, setResults] = useState<SavedResult[] | null>(null);
  const [streak, setStreak] = useState<StreakInfo>({
    current: 0,
    best: 0,
    lastDay: "",
  });

  useEffect(() => {
    let alive = true;
    void Promise.all([getResults(), getStreak()]).then(([r, s]) => {
      if (alive) {
        setResults(r);
        setStreak(s);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => summarize(results ?? []), [results]);
  const keyStats = useMemo(() => aggregateKeyStats(results ?? []), [results]);
  const missed = useMemo(() => aggregateMissedWords(results ?? []), [results]);

  if (results === null) return <Skeleton />;

  if (results.length === 0) {
    return (
      <GlassPanel pad="lg" className="flex flex-col items-center gap-4 text-center">
        <span className="glass flex size-14 items-center justify-center rounded-full text-primary">
          <Keyboard className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            no runs yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            your history lives right here in this browser — take a test and
            watch the charts fill in
          </p>
        </div>
        <GlassButton variant="primary" onClick={() => router.push("/")}>
          take a test
        </GlassButton>
      </GlassPanel>
    );
  }

  const onPractice = (words: string[]) => {
    router.push(`/?practice=${encodeURIComponent(words.join(" "))}`);
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      <motion.div variants={item}>
        <SummaryTiles summary={summary} />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={item}>
          <GlassPanel pad="md" className="h-full">
            <ProgressChart results={results} />
          </GlassPanel>
        </motion.div>
        <motion.div variants={item}>
          <GlassPanel pad="md" className="h-full">
            <PeekTrend results={results} />
          </GlassPanel>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <GlassPanel pad="md">
          <KeyHeatmap keyStats={keyStats} />
        </GlassPanel>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <GlassPanel pad="md" className="h-full">
            <MissedWords words={missed} onPractice={onPractice} />
          </GlassPanel>
        </motion.div>
        <motion.div variants={item}>
          <GlassPanel pad="md" className="h-full">
            <StreakCard streak={streak} />
          </GlassPanel>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <GlassPanel pad="md">
          <HistoryTable results={results} />
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}

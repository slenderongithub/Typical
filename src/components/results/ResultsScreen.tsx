"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ImageDown, Repeat2, RotateCw, Target } from "lucide-react";
import { useState } from "react";

import { GlassButton, GlassPanel, SmoothNumber } from "@/components/glass";
import { integrityPenaltyPct, verifiedWpm } from "@/lib/gaze/score";
import type { PersonalBest, SavedResult } from "@/lib/types";

import { IntegrityBadge } from "./IntegrityBadge";
import { PBCelebration } from "./PBCelebration";
import { downloadShareCard } from "./shareCard";
import { WpmChart } from "./WpmChart";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 30 },
  },
};

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="glass flex min-w-0 flex-col gap-1.5 rounded-2xl px-4 py-3">
      <span className="eyebrow truncate tracking-[0.04em]">{label}</span>
      <span className="flex h-8 items-center truncate text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}

function modeLine(r: SavedResult): string {
  const c = r.config;
  const base =
    c.mode === "time"
      ? `time ${c.duration}s`
      : c.mode === "words"
        ? `${c.wordCount} words`
        : c.mode === "quote"
          ? `quote · ${c.quoteLength}`
          : c.mode;
  return [
    base,
    c.punctuation && "punctuation",
    c.numbers && "numbers",
    c.difficulty !== "normal" && c.difficulty,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface ResultsScreenProps {
  result: SavedResult;
  pb: { isNewBest: boolean; previous?: PersonalBest };
  onRestart: () => void;
  onRepeat: () => void;
  onPracticeMissed: (() => void) | null;
}

/** The post-test moment: hero numbers, the story of the run, and what's next. */
export function ResultsScreen({
  result,
  pb,
  onRestart,
  onRepeat,
  onPracticeMissed,
}: ResultsScreenProps) {
  const reduce = useReducedMotion();
  const [savedPng, setSavedPng] = useState(false);

  const delta = pb.previous ? result.wpm - pb.previous.wpm : null;
  const showTrackedStats = result.integrity !== "untracked";
  // camera-verified runs get a penalized "verified score" (raw WPM stays a
  // factual measurement; this is the number looking away actually costs).
  const penaltyPct = integrityPenaltyPct(result);
  const vWpm = verifiedWpm(result.wpm, result);

  return (
    // one screen, no scrolling: hero island on the left, the run's story on
    // the right, actions underneath — stacks on small screens
    <motion.div
      className="mx-auto flex w-full max-w-6xl flex-col gap-5"
      variants={container}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        {/* hero */}
        <motion.div
          variants={item}
          className="island flex flex-col justify-between gap-6 rounded-[2rem] p-7"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-surface-muted">
              words per minute
            </span>
            <SmoothNumber
              value={Math.round(result.wpm)}
              className="mt-1 block text-[6.5rem] font-extrabold leading-[0.9] tracking-[-0.05em] text-surface-foreground"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2">
              <SmoothNumber
                value={Math.round(result.accuracy)}
                suffix="%"
                className="text-4xl font-extrabold tracking-tight text-surface-foreground"
              />
              <span className="text-sm font-semibold text-surface-muted">
                accuracy
              </span>
            </div>

            {pb.isNewBest ? (
              <PBCelebration delta={delta} />
            ) : delta !== null ? (
              <span className="w-fit rounded-full bg-surface-foreground/10 px-3 py-1 text-[13px] font-semibold tabular-nums text-surface-foreground">
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}{" "}
                <span className="font-medium text-surface-muted">
                  vs best {pb.previous!.wpm.toFixed(1)}
                </span>
              </span>
            ) : null}

            <span className="text-[13px] font-semibold text-surface-muted">
              {modeLine(result)}
            </span>
          </div>
        </motion.div>

        {/* the run */}
        <div className="flex min-w-0 flex-col gap-4">
          <motion.div
            variants={item}
            className="flex flex-wrap items-center gap-3"
          >
            <IntegrityBadge report={result} />
            {showTrackedStats && (
              <span className="glass inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold">
                <span className="text-muted-foreground">verified</span>
                <span className="tabular-nums text-foreground">
                  {Math.round(vWpm)} wpm
                </span>
                <span
                  className={penaltyPct > 0 ? "text-warning" : "text-success"}
                >
                  {penaltyPct > 0 ? `−${penaltyPct}%` : "no penalty"}
                </span>
              </span>
            )}
          </motion.div>

          <motion.div
            variants={item}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
          >
            <StatTile label="raw wpm" value={Math.round(result.rawWpm)} />
            <StatTile
              label="consistency"
              value={`${Math.round(result.consistency)}%`}
            />
            <StatTile
              label="c / i / e / m"
              value={
                <span className="text-lg">
                  <span className="text-success">{result.chars.correct}</span>
                  <span className="text-faint-foreground">/</span>
                  <span className="text-danger">{result.chars.incorrect}</span>
                  <span className="text-faint-foreground">/</span>
                  {result.chars.extra}
                  <span className="text-faint-foreground">/</span>
                  {result.chars.missed}
                </span>
              }
            />
            <StatTile
              label="duration"
              value={`${(result.durationMs / 1000).toFixed(result.durationMs < 60000 ? 1 : 0)}s`}
            />
            {showTrackedStats ? (
              <StatTile
                label="peeks"
                value={
                  result.peekCount === 0 ? (
                    <span className="text-success">none</span>
                  ) : (
                    `${result.peekCount} · ${(result.peekTotalMs / 1000).toFixed(1)}s`
                  )
                }
              />
            ) : (
              <StatTile label="mode" value={result.mode} />
            )}
          </motion.div>

          <motion.div variants={item} className="min-w-0 flex-1">
            <GlassPanel pad="sm" className="h-full px-5">
              <WpmChart timeline={result.timeline} height={170} />
            </GlassPanel>
          </motion.div>
        </div>
      </div>

      {/* actions */}
      <motion.div
        variants={item}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <GlassButton
          variant="primary"
          icon={<RotateCw />}
          onClick={onRestart}
          autoFocus
        >
          next test
        </GlassButton>
        <GlassButton variant="ghost" icon={<Repeat2 />} onClick={onRepeat}>
          repeat
        </GlassButton>
        {onPracticeMissed && (
          <GlassButton
            variant="ghost"
            icon={<Target />}
            onClick={onPracticeMissed}
          >
            practice missed words
          </GlassButton>
        )}
        <GlassButton
          variant="ghost"
          icon={savedPng ? <Check className="text-success" /> : <ImageDown />}
          onClick={() => {
            void downloadShareCard(result).then(() => {
              setSavedPng(true);
              setTimeout(() => setSavedPng(false), 2000);
            });
          }}
        >
          {savedPng ? "saved" : "save png"}
        </GlassButton>
        <span className="ml-2 hidden items-center gap-1.5 text-[13px] font-medium text-muted-foreground sm:flex">
          <kbd className="kbd">tab</kbd>
          next test
        </span>
      </motion.div>
    </motion.div>
  );
}

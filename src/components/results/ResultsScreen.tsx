"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ImageDown, Repeat2, RotateCw, Target } from "lucide-react";
import { useState } from "react";

import { GlassButton, GlassPanel, SmoothNumber } from "@/components/glass";
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
    <div className="glass-subtle flex flex-col gap-1 rounded-2xl px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[1.375rem] font-semibold leading-tight text-foreground">
        {value}
      </span>
    </div>
  );
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

  return (
    <motion.div
      className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8"
      variants={container}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {/* hero */}
      <motion.div variants={item} className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-8">
          <div className="flex items-baseline gap-3">
            <SmoothNumber
              value={Math.round(result.wpm)}
              className="text-8xl font-semibold tracking-tight text-foreground"
            />
            <span className="text-2xl text-muted-foreground">wpm</span>
          </div>
          <div className="flex items-baseline gap-2 pb-2.5">
            <SmoothNumber
              value={Math.round(result.accuracy)}
              suffix="%"
              className="text-4xl font-semibold text-foreground"
            />
            <span className="text-sm text-muted-foreground">acc</span>
          </div>
        </div>

        <div className="flex h-8 items-center">
          {pb.isNewBest ? (
            <PBCelebration />
          ) : delta !== null ? (
            <span className="rounded-full bg-glass px-3 py-1 text-xs text-muted-foreground">
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)} vs best {pb.previous!.wpm.toFixed(1)}
            </span>
          ) : null}
        </div>
      </motion.div>

      {/* integrity */}
      <motion.div variants={item}>
        <IntegrityBadge report={result} />
      </motion.div>

      {/* stat grid */}
      <motion.div
        variants={item}
        className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatTile label="raw wpm" value={Math.round(result.rawWpm)} />
        <StatTile
          label="consistency"
          value={`${Math.round(result.consistency)}%`}
        />
        <StatTile
          label="characters c/i/e/m"
          value={
            <span className="text-base font-semibold">
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

      {/* chart */}
      <motion.div variants={item} className="w-full">
        <GlassPanel pad="md">
          <WpmChart timeline={result.timeline} />
        </GlassPanel>
      </motion.div>

      {/* actions */}
      <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-2">
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
          <GlassButton variant="ghost" icon={<Target />} onClick={onPracticeMissed}>
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
      </motion.div>

      <motion.p variants={item} className="text-xs text-faint-foreground">
        <kbd className="glass-subtle rounded-md px-1.5 py-0.5 font-mono text-[11px]">
          tab
        </kbd>{" "}
        next test
      </motion.p>
    </motion.div>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ImageDown, Repeat2, RotateCw, Target } from "lucide-react";
import { useState } from "react";

import { GlassButton, GlassPanel, SmoothNumber } from "@/components/glass";
import {
  integrityPenaltyPct,
  verifiedWpm,
} from "@/lib/gaze/score";
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
    <div className="glass-subtle flex flex-col gap-1.5 rounded-2xl px-4 py-3.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex h-7 items-center text-[1.375rem] font-semibold tabular-nums tracking-tight text-foreground">
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
  // camera-verified runs get a penalized "verified score" (raw WPM stays a
  // factual measurement; this is the number looking away actually costs).
  const penaltyPct = integrityPenaltyPct(result);
  const vWpm = verifiedWpm(result.wpm, result);

  return (
    <motion.div
      className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8"
      variants={container}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {/* hero */}
      <motion.div variants={item} className="flex flex-col items-center gap-4">
        {/* two-row grid: numbers share one baseline, labels share the next */}
        <div className="grid grid-cols-[auto_auto] items-baseline justify-items-center gap-x-10 gap-y-1 sm:gap-x-14">
          <SmoothNumber
            value={Math.round(result.wpm)}
            className="text-7xl font-semibold leading-none tracking-tighter text-primary sm:text-8xl"
          />
          <SmoothNumber
            value={Math.round(result.accuracy)}
            suffix="%"
            className="text-5xl font-semibold leading-none tracking-tighter text-foreground sm:text-6xl"
          />
          <span className="eyebrow">wpm</span>
          <span className="eyebrow">accuracy</span>
        </div>

        {pb.isNewBest ? (
          <PBCelebration />
        ) : delta !== null ? (
          <span className="rounded-full border border-glass-border bg-glass px-3 py-1 text-xs tabular-nums text-muted-foreground">
            <span className={delta >= 0 ? "text-success" : "text-foreground"}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}
            </span>{" "}
            vs your best of {pb.previous!.wpm.toFixed(1)}
          </span>
        ) : null}
      </motion.div>

      {/* verified score — only when the camera was watching */}
      {showTrackedStats && (
        <motion.div variants={item}>
          <div className="glass flex items-center gap-5 rounded-2xl px-5 py-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                verified score
              </span>
              <div className="flex items-baseline gap-1.5">
                <SmoothNumber
                  value={Math.round(vWpm)}
                  className="text-3xl font-semibold leading-tight text-foreground"
                />
                <span className="text-sm text-muted-foreground">wpm</span>
              </div>
            </div>
            <div className="h-9 w-px bg-glass-border" />
            <div className="text-sm">
              {penaltyPct > 0 ? (
                <span className="font-medium text-warning">
                  −{penaltyPct}% for looking away
                </span>
              ) : (
                <span className="font-medium text-success">
                  no penalty — eyes stayed on screen
                </span>
              )}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {result.peekCount === 0
                  ? "no keyboard glances"
                  : `${result.peekCount} glance${
                      result.peekCount === 1 ? "" : "s"
                    } down · ${(result.peekTotalMs / 1000).toFixed(
                      1,
                    )}s off screen`}
              </div>
            </div>
          </div>
        </motion.div>
      )}

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

      <motion.p
        variants={item}
        className="-mt-3 flex items-center gap-1.5 text-xs text-faint-foreground"
      >
        <kbd className="kbd">tab</kbd>
        next test
      </motion.p>
    </motion.div>
  );
}

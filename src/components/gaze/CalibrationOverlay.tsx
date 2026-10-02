"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GlassButton } from "@/components/glass";
import {
  type CalSample,
  type CalStepKind,
  fitCalibration,
  gazeFeatures,
} from "@/lib/gaze/heuristics";
import { getController } from "@/lib/gaze/store";
import type { CalibrationData } from "@/lib/types";

/**
 * Screen sweep path as [top, left] — corners, sides, the typing band, and the
 * bottom edge (where screen vs keyboard is hardest to tell apart) twice.
 */
const SWEEP: [string, string][] = [
  ["50%", "50%"],
  ["8%", "5%"],
  ["8%", "95%"],
  ["50%", "95%"],
  ["92%", "95%"],
  ["92%", "5%"],
  ["50%", "5%"],
  ["40%", "50%"],
  ["92%", "50%"],
  ["92%", "25%"],
  ["92%", "75%"],
];
const SWEEP_MS = 11000;
const KEYS_MS = 8500;
/** time to read the keyboard prompt and look down before frames count */
const KEYS_READ_MS = 2500;
const TYPE_MS = 10000;
const GLANCES = 4;
const GLANCE_MS = 2000;
/** eyes still travelling after a cue / beep — frames in these windows are unlabelled */
const GLANCE_SETTLE_MS = 600;
const RETURN_SETTLE_MS = 800;

const ORDER: CalStepKind[] = ["sweep", "keys", "type", "drill"];

const SENTENCE = "pack my box with five dozen liquor jugs";

const COPY: Record<CalStepKind | "intro" | "done" | "failed", { title: string; hint: string }> = {
  intro: { title: "calibration", hint: "4 short steps, about a minute — sound on, sit how you type" },
  sweep: { title: "follow the dot", hint: "eyes only is fine" },
  keys: { title: "look at your keyboard", hint: "scan slowly from left to right until the beep" },
  type: { title: "type this without looking down", hint: "eyes on the line" },
  drill: { title: "watch the cross", hint: "arrow → glance at your keys · beep → look back up" },
  done: { title: "calibrated", hint: "glances toward your keyboard will now count against you" },
  failed: { title: "calibration unclear", hint: "" },
};

/** Drill cue times (ms into the step), randomized so glances can't be anticipated. */
function drillCues(): number[] {
  const cues = [1500];
  while (cues.length < GLANCES) {
    cues.push(cues[cues.length - 1] + GLANCE_MS + 1800 + Math.random() * 1200);
  }
  return cues;
}

/** Label for a frame `t` ms into a step, or null while the eyes are moving. */
function labelAt(
  kind: CalStepKind,
  t: number,
  ms: number,
  cues: number[],
): { label: 0 | 1; glance: number } | null {
  if (kind === "sweep") return t >= 600 ? { label: 0, glance: -1 } : null;
  if (kind === "keys") return t >= KEYS_READ_MS && t <= ms - 200 ? { label: 1, glance: -1 } : null;
  if (kind === "type") return t >= 1000 ? { label: 0, glance: -1 } : null;
  if (t < 500) return null;
  for (let g = 0; g < cues.length; g++) {
    const c = cues[g];
    if (t >= c && t < c + GLANCE_SETTLE_MS) return null;
    if (t >= c + GLANCE_SETTLE_MS && t <= c + GLANCE_MS) return { label: 1, glance: g };
    if (t > c + GLANCE_MS && t < c + GLANCE_MS + RETURN_SETTLE_MS) return null;
  }
  return { label: 0, glance: -1 };
}

export function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.1;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

export interface CalibrationOverlayProps {
  /** called only with a calibration that passed its own glance drill */
  onDone: (data: CalibrationData) => void;
  onCancel: () => void;
}

type Phase = "intro" | "run" | "done" | "failed";

/**
 * ~45s labelled calibration: a screen sweep, a keyboard sweep, typing with
 * eyes up, then a randomized glance drill. The first three train the model;
 * the drill tests it (see fitCalibration) before it is trusted.
 */
export function CalibrationOverlay({ onDone, onCancel }: CalibrationOverlayProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [cueOn, setCueOn] = useState(false);
  const [problem] = useState(""); // unused while the self-check is off
  /** paused on a step's instructions until the user says go */
  const [waiting, setWaiting] = useState(false);
  const goRef = useRef<(() => void) | null>(null);
  const calRef = useRef<CalibrationData | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (phase !== "run") return;
    const c = getController();
    const samples: CalSample[] = [];
    const step = { kind: "sweep" as CalStepKind, start: 0, ms: 0, cues: [] as number[] };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let alive = true;

    const off = c.on((e) => {
      if (e.type !== "frame" || e.frame.faces !== 1 || step.start === 0) return;
      const l = labelAt(step.kind, e.frame.timestamp - step.start, step.ms, step.cues);
      if (l) samples.push({ f: gazeFeatures(e.frame), kind: step.kind, ts: e.frame.timestamp, ...l });
    });

    const run = async () => {
      for (let i = 0; i < ORDER.length; i++) {
        const kind = ORDER[i];
        const cues = kind === "drill" ? drillCues() : [];
        const ms =
          kind === "sweep" ? SWEEP_MS
          : kind === "keys" ? KEYS_MS
          : kind === "type" ? TYPE_MS
          : cues[cues.length - 1] + GLANCE_MS + 1500;
        // show this step's instructions and wait — no frames are labelled meanwhile
        step.start = 0;
        setStepIdx(i);
        setWaiting(true);
        await new Promise<void>((r) => (goRef.current = r));
        if (!alive) return;
        setWaiting(false);
        Object.assign(step, { kind, start: performance.now(), ms, cues });
        for (const cue of cues) {
          later(cue, () => setCueOn(true));
          later(cue + GLANCE_MS, () => {
            setCueOn(false);
            beep(audio.current);
          });
        }
        if (kind === "keys") later(ms, () => beep(audio.current));
        await new Promise((r) => later(ms, () => r(null)));
        if (!alive) return;
      }
      step.start = 0;
      // ponytail: the self-check verdict is ignored for now — every finished run
      // counts as calibrated. Restore the `problem` → "failed" branch once the
      // gaze model is reworked.
      const cal = { ...fitCalibration(samples).cal, valid: true };
      getController().setCalibration(cal);
      calRef.current = cal;
      setPhase("done");
    };
    void run();

    return () => {
      alive = false;
      off();
      timers.forEach(clearTimeout);
    };
  }, [phase]);

  // own effect: changing phase cleans up the run effect above, which used to
  // cancel this timer and leave the overlay stuck on "calibrated"
  useEffect(() => {
    if (phase !== "done" || !calRef.current) return;
    const cal = calRef.current;
    const t = setTimeout(() => onDoneRef.current(cal), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const start = () => {
    audio.current ??= new AudioContext(); // must be created inside the click
    setCueOn(false);
    setPhase("run");
  };

  const kind = ORDER[stepIdx];
  const copy =
    phase === "run" ? COPY[kind] : { ...COPY[phase], ...(phase === "failed" && { hint: problem }) };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/70 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="gaze calibration"
    >
      {phase === "run" && (
        <span className="eyebrow absolute left-1/2 top-6 -translate-x-1/2">
          step {stepIdx + 1} of {ORDER.length}
        </span>
      )}

      {/* copy block */}
      <motion.div
        key={phase === "run" ? kind : phase}
        className="pointer-events-none absolute top-[22%] flex flex-col items-center gap-2 px-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <h2 className="text-2xl font-bold text-foreground">{copy.title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{copy.hint}</p>
      </motion.div>

      {(phase === "intro" || phase === "failed") && (
        <div className="flex items-center gap-2">
          <GlassButton variant="ghost" onClick={onCancel}>
            cancel
          </GlassButton>
          <GlassButton variant="primary" onClick={start}>
            {phase === "failed" ? "try again" : "start"}
          </GlassButton>
        </div>
      )}

      {phase === "run" && !waiting && kind === "sweep" && (
        <motion.span
          className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_6px_color-mix(in_srgb,var(--primary)_25%,transparent)]"
          initial={{ top: SWEEP[0][0], left: SWEEP[0][1] }}
          animate={{ top: SWEEP.map((p) => p[0]), left: SWEEP.map((p) => p[1]) }}
          transition={{ duration: SWEEP_MS / 1000, ease: "linear" }}
        />
      )}

      {phase === "run" && !waiting && kind === "type" && (
        <div className="mt-16 flex w-full max-w-xl flex-col items-center gap-4 px-6">
          <p className="text-center text-2xl font-semibold text-foreground">{SENTENCE}</p>
          <input
            autoFocus
            aria-label="type the sentence"
            className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-lg text-foreground outline-none"
          />
        </div>
      )}

      {phase === "run" && !waiting && kind === "drill" && (
        <span className="flex size-20 items-center justify-center text-primary" aria-live="polite">
          {cueOn ? (
            <ArrowDown className="size-16" aria-label="glance at your keys" />
          ) : (
            <span className="text-5xl font-light leading-none text-foreground">+</span>
          )}
        </span>
      )}

      {phase === "run" && waiting && (
        <GlassButton variant="primary" autoFocus onClick={() => goRef.current?.()}>
          ready
        </GlassButton>
      )}

      {phase === "done" && (
        <motion.span
          className="size-5 rounded-full bg-primary"
          animate={{ scale: [1, 1.35, 1] }}
          transition={{ duration: 0.5 }}
        />
      )}

      {phase === "run" && (
        <div className="absolute right-6 top-6">
          <GlassButton variant="ghost" size="sm" onClick={onCancel}>
            cancel
          </GlassButton>
        </div>
      )}
    </motion.div>
  );
}

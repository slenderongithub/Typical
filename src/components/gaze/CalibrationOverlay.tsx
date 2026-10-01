"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { GlassButton } from "@/components/glass";
import { getController } from "@/lib/gaze/store";
import type { CalibrationData } from "@/lib/types";

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const EDGE = "3.5rem";
const BOTTOM = `calc(100% - ${EDGE})`;

/**
 * Calibration targets. Screen dots (label 0) hug the bottom edge, where
 * screen-vs-keyboard is hardest to tell apart; the keyboard step (label 1)
 * has no dot to watch, so it gets time to read the prompt first.
 * settle = ms before sampling, hold = ms of labelled frames.
 */
const STEPS = [
  { label: 0, top: "50%", left: "50%", settle: 650, hold: 1200, title: "look at the dot", hint: "keep your head relaxed" },
  { label: 0, top: BOTTOM, left: EDGE, settle: 650, hold: 1000, title: "follow the dot", hint: "eyes only is fine" },
  { label: 0, top: BOTTOM, left: "50%", settle: 650, hold: 1000, title: "follow the dot", hint: "eyes only is fine" },
  { label: 0, top: BOTTOM, left: `calc(100% - ${EDGE})`, settle: 650, hold: 1000, title: "follow the dot", hint: "eyes only is fine" },
  { label: 1, top: BOTTOM, left: "50%", settle: 2000, hold: 2400, title: "now look at your keyboard", hint: "eyes on the keys for about five seconds, then look back up" },
] as const;

type Step = "intro" | "done" | number;

const COPY = {
  intro: { title: "quick calibration", hint: "a few dots, then your keyboard — about ten seconds" },
  done: { title: "calibrated", hint: "glances toward your keyboard will now count against you" },
};

export interface CalibrationOverlayProps {
  onDone: (data: CalibrationData) => void;
  onCancel: () => void;
}

/**
 * Labelled-frame calibration: screen dots, then the keyboard. The controller
 * trains a per-user classifier on the frames when the last step finishes.
 * The dot carries an animated progress ring while frames are recorded.
 */
export function CalibrationOverlay({ onDone, onCancel }: CalibrationOverlayProps) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("intro");
  const [collecting, setCollecting] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (typeof step !== "number") return;
    const target = STEPS[step];
    let alive = true;
    const run = async () => {
      // let the dot's spring travel settle (or the prompt be read) first
      await new Promise((r) => setTimeout(r, target.settle));
      if (!alive || cancelled.current) return;
      setCollecting(true);
      await getController().collectCalibration(target.label, target.hold);
      if (!alive || cancelled.current) return;
      setCollecting(false);
      if (step + 1 < STEPS.length) {
        setStep(step + 1);
      } else {
        setStep("done");
        const data = getController().finishCalibration();
        setTimeout(() => {
          if (!cancelled.current) onDone(data);
        }, 900);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [step, onDone]);

  const current = typeof step === "number" ? STEPS[step] : null;
  const copy = current ?? COPY[step as "intro" | "done"];
  const dotPos = current
    ? { top: current.top, left: current.left }
    : { top: BOTTOM, left: "50%" };

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
      {/* copy block */}
      <motion.div
        key={step}
        className="pointer-events-none absolute top-[22%] flex flex-col items-center gap-2 px-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <h2 className="text-2xl font-bold text-foreground">
          {copy.title}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {copy.hint}
        </p>
      </motion.div>

      {step === "intro" && (
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <GlassButton variant="ghost" onClick={onCancel}>
            cancel
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => {
              getController().resetCalibration();
              setStep(0);
            }}
          >
            start
          </GlassButton>
        </motion.div>
      )}

      {step !== "intro" && (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          animate={dotPos}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 160, damping: 22 }
          }
          style={{ top: "50%", left: "50%" }}
        >
          <svg width={72} height={72} viewBox="0 0 72 72" aria-hidden>
            {/* idle pulse halo */}
            <motion.circle
              cx={36}
              cy={36}
              r={RING_R}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.25}
              strokeWidth={2}
              animate={reduce ? undefined : { r: [RING_R, RING_R + 7], opacity: [0.4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            {/* progress ring while collecting */}
            <motion.circle
              cx={36}
              cy={36}
              r={RING_R}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              transform="rotate(-90 36 36)"
              initial={{ strokeDashoffset: RING_C }}
              animate={{
                strokeDashoffset: collecting || step === "done" ? 0 : RING_C,
              }}
              transition={{
                duration: collecting && current ? current.hold / 1000 : 0.3,
                ease: "linear",
              }}
            />
            <motion.circle
              cx={36}
              cy={36}
              r={9}
              fill="var(--primary)"
              animate={
                step === "done"
                  ? { scale: [1, 1.35, 1] }
                  : reduce
                    ? undefined
                    : { scale: [1, 1.12, 1] }
              }
              transition={
                step === "done"
                  ? { duration: 0.5 }
                  : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              }
              style={{ originX: "36px", originY: "36px" }}
            />
          </svg>
        </motion.div>
      )}

      {step !== "intro" && step !== "done" && (
        <div className="absolute bottom-20">
          <GlassButton variant="ghost" size="sm" onClick={onCancel}>
            cancel
          </GlassButton>
        </div>
      )}
    </motion.div>
  );
}

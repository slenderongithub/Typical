"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { GlassButton } from "@/components/glass";
import { getController } from "@/lib/gaze/store";
import type { CalibrationData } from "@/lib/types";

const HOLD_MS = 1400;
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

type Step = "intro" | "center" | "bottom" | "done";

const COPY: Record<Step, { title: string; hint: string }> = {
  intro: {
    title: "quick calibration",
    hint: "two dots, about three seconds — this teaches Typical what “eyes on screen” looks like for your face and camera",
  },
  center: {
    title: "look at the dot",
    hint: "keep your head relaxed and your eyes on the dot",
  },
  bottom: {
    title: "now the bottom edge",
    hint: "follow the dot down — this marks the lowest on-screen gaze",
  },
  done: {
    title: "calibrated",
    hint: "anything below that last dot reads as “looking at the keyboard”",
  },
};

export interface CalibrationOverlayProps {
  onDone: (data: CalibrationData) => void;
  onCancel: () => void;
}

/**
 * Two-point calibration: screen center, then bottom-center edge. The dot
 * carries an animated progress ring while the controller collects median
 * pose samples — no dead time, every state animates.
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
    if (step !== "center" && step !== "bottom") return;
    let alive = true;
    const run = async () => {
      // let the dot's spring travel settle before sampling
      await new Promise((r) => setTimeout(r, 650));
      if (!alive || cancelled.current) return;
      setCollecting(true);
      await getController().collectCalibration(step, HOLD_MS);
      if (!alive || cancelled.current) return;
      setCollecting(false);
      if (step === "center") {
        setStep("bottom");
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

  const dotPos =
    step === "bottom"
      ? { top: "calc(100% - 3.5rem)", left: "50%" }
      : { top: "50%", left: "50%" };

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
          {COPY[step].title}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {COPY[step].hint}
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
          <GlassButton variant="primary" onClick={() => setStep("center")}>
            start
          </GlassButton>
        </motion.div>
      )}

      {(step === "center" || step === "bottom" || step === "done") && (
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
                duration: collecting ? HOLD_MS / 1000 : 0.3,
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

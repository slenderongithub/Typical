"use client";

import { motion, type MotionValue } from "framer-motion";
import { useEffect, useState } from "react";

export interface CaretProps {
  /** Springed position motion values, owned by WordStream's measurer. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  visible: boolean;
  /** Changes on every keystroke — resets the blink idle timer. */
  activityKey: number;
}

/**
 * The caret: a glowing 2px bar positioned by WordStream. Blinks only after
 * ~530ms of inactivity, exactly like a native text caret. Height is em-based
 * so it tracks the stream's font size without measurement.
 */
export function Caret({ x, y, visible, activityKey }: CaretProps) {
  const [blinking, setBlinking] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- idle-timer reset is inherently effect-driven
    setBlinking(false);
    const t = setTimeout(() => setBlinking(true), 530);
    return () => clearTimeout(t);
  }, [activityKey]);

  return (
    <motion.div
      aria-hidden
      className="absolute left-0 top-0 h-[1.35em] w-[2px] rounded-full bg-caret shadow-[0_0_12px] shadow-caret/60"
      style={{ x, y }}
      animate={
        visible
          ? blinking
            ? { opacity: [1, 1, 0, 0, 1] }
            : { opacity: 1 }
          : { opacity: 0 }
      }
      transition={
        visible && blinking
          ? { duration: 1.1, times: [0, 0.45, 0.5, 0.95, 1], repeat: Infinity }
          : { duration: 0.12 }
      }
    />
  );
}

"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Orb diameter in px — soft primary-tinted glow that trails the pointer. */
const ORB_SIZE = 340;

/** Springy trail — light mass so the orb feels like it floats behind the cursor. */
const ORB_SPRING = { mass: 0.1, damping: 10, stiffness: 131 };

/**
 * Ambient background layer: the drifting glow field the glass refracts
 * (pure CSS, z -2) plus a pointer-following primary glow orb (z -1).
 * The orb stays hidden until the first pointer move so touch-only devices
 * never see a stray glow in the corner.
 */
export function BackgroundGlow() {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(-ORB_SIZE);
  const rawY = useMotionValue(-ORB_SIZE);
  const springX = useSpring(rawX, ORB_SPRING);
  const springY = useSpring(rawY, ORB_SPRING);
  const [visible, setVisible] = useState(false);
  const seenPointer = useRef(false);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      rawX.set(e.clientX - ORB_SIZE / 2);
      rawY.set(e.clientY - ORB_SIZE / 2);
      if (!seenPointer.current) {
        seenPointer.current = true;
        setVisible(true);
      }
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [rawX, rawY]);

  return (
    <>
      <div className="bg-glow-field" aria-hidden>
        <div className="glow-grid" />
        <div className="glow-3" />
      </div>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[-1]"
        style={{
          x: reduceMotion ? rawX : springX,
          y: reduceMotion ? rawY : springY,
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderRadius: "50%",
          filter: "blur(60px)",
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--primary) 7%, transparent), transparent 70%)",
          willChange: "transform",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </>
  );
}

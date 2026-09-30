"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { MousePointerClick } from "lucide-react";
import { Fragment, memo, useEffect, useLayoutEffect, useRef } from "react";

import type { TypingEngine } from "@/lib/engine/engine";
import { useSettings } from "@/lib/store/settings";
import type { WordState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Caret } from "./Caret";
import { useEngineSnapshot } from "./useEngineSnapshot";

/** Must match `.typing-words` line-height (2.6rem) in globals.css. */
const LINE_HEIGHT_REM = 2.6;
const VISIBLE_LINES = 6;
/**
 * Which visible row (0-indexed) the caret line is scrolled to. Rows above it
 * are already-typed context that recedes into depth; rows below are upcoming.
 * The perspective is hinged on this row so the active line stays crisp.
 */
const CARET_ROW = 2;
/** Vertical hinge for the tilt, as a % of the window — the caret row's centre. */
const TILT_ORIGIN_Y = `${((CARET_ROW + 0.5) / VISIBLE_LINES) * 100}%`;

const CARET_X_SPRING = { stiffness: 500, damping: 34, mass: 0.5 };
const SCROLL_SPRING = { stiffness: 180, damping: 26 };

interface WordProps {
  word: WordState;
  register: (el: HTMLSpanElement | null) => void;
}

/**
 * One word. Memoized — the engine only swaps the WordState objects it
 * mutates, so a keystroke re-renders exactly one of these.
 */
const Word = memo(
  function Word({ word, register }: WordProps) {
    const len = Math.max(word.target.length, word.typed.length);
    const chars: React.ReactNode[] = [];
    for (let i = 0; i < len; i++) {
      const state = word.states[i] ?? "pending";
      const ch = state === "extra" ? word.typed[i] : word.target[i];
      chars.push(
        <span key={i} className="typing-char" data-state={state}>
          {ch}
        </span>,
      );
    }
    return (
      <span
        ref={register}
        className="typing-word relative inline-block"
        data-error={word.committed && !word.correct ? "true" : undefined}
      >
        {chars}
      </span>
    );
  },
  (prev, next) => prev.word === next.word,
);

export interface WordStreamProps {
  engine: TypingEngine;
  focused: boolean;
  onRequestFocus: () => void;
}

/**
 * The word display: a multi-line window over the test text. The caret line is
 * kept on `CARET_ROW` by spring-animating the inner container's translateY —
 * the stream glides, it never jumps. The window is tilted in 3D so the rows of
 * already-typed text above the caret lean back and recede into depth.
 */
export function WordStream({ engine, focused, onRequestFocus }: WordStreamProps) {
  const snapshot = useEngineSnapshot(engine);
  const smoothCaret = useSettings((s) => s.smoothCaret);

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const wordEls = useRef(new Map<number, HTMLSpanElement>());
  const placeholderRef = useRef<HTMLSpanElement>(null);

  const scrollRaw = useMotionValue(0);
  const scrollY = useSpring(scrollRaw, SCROLL_SPRING);
  const caretXRaw = useMotionValue(0);
  const caretYRaw = useMotionValue(0);
  const caretX = useSpring(caretXRaw, CARET_X_SPRING);
  const caretY = useSpring(caretYRaw, SCROLL_SPRING);

  const lineHeightPx = useRef(41.6);

  const words = snapshot?.words ?? [];
  const version = snapshot?.version ?? 0;
  const running = snapshot?.status === "running";
  const finished =
    snapshot?.status === "finished" || snapshot?.status === "failed";

  /* measure caret + line scroll after every engine change */
  useLayoutEffect(() => {
    if (!snapshot) return;
    const outer = outerRef.current;
    if (!outer) return;

    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    lineHeightPx.current = LINE_HEIGHT_REM * rootFont;

    const wordEl = wordEls.current.get(snapshot.currentWordIndex);
    if (!wordEl) {
      // Nothing typed yet (zen): no word element exists, so park the caret at
      // the centre of the first line — exactly where the first typed
      // character will appear (the last line is text-align-last: centred).
      const inner = innerRef.current;
      const ph = placeholderRef.current;
      if (!inner) return;
      const fs = parseFloat(getComputedStyle(inner).fontSize) || 24;
      const y0 = (ph?.offsetTop ?? 0) + (lineHeightPx.current - fs * 1.35) / 2;
      const x0 = inner.clientWidth / 2;
      caretX.jump(x0);
      caretY.jump(y0);
      caretXRaw.set(x0);
      caretYRaw.set(y0);
      scrollY.jump(0);
      scrollRaw.set(0);
      return;
    }

    const charIdx = snapshot.currentCharIndex;
    const charSpans = wordEl.children;
    let x: number;
    const yBase = wordEl.offsetTop;

    if (charSpans.length === 0) {
      x = wordEl.offsetLeft;
    } else if (charIdx < charSpans.length) {
      const el = charSpans[charIdx] as HTMLElement;
      x = wordEl.offsetLeft + el.offsetLeft;
    } else {
      const el = charSpans[charSpans.length - 1] as HTMLElement;
      x = wordEl.offsetLeft + el.offsetLeft + el.offsetWidth;
    }

    const fontSize = parseFloat(getComputedStyle(wordEl).fontSize) || 24;
    const centeredY = yBase + (lineHeightPx.current - fontSize * 1.35) / 2;

    // keep the caret's line on CARET_ROW
    const lineIndex = Math.round(yBase / lineHeightPx.current);
    const targetScroll =
      -Math.max(0, lineIndex - CARET_ROW) * lineHeightPx.current;

    if (smoothCaret) {
      caretXRaw.set(x);
      caretYRaw.set(centeredY);
      scrollRaw.set(targetScroll);
    } else {
      caretX.jump(x);
      caretY.jump(centeredY);
      scrollY.jump(targetScroll);
      caretXRaw.set(x);
      caretYRaw.set(centeredY);
      scrollRaw.set(targetScroll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, smoothCaret, snapshot?.currentWordIndex, snapshot?.currentCharIndex]);

  /* re-measure on container resize and once fonts are ready */
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const bump = () => {
      // nudge the effect above by re-setting from current engine state
      const snap = engine.getSnapshot();
      const wordEl = wordEls.current.get(snap.currentWordIndex);
      if (wordEl) {
        const lineIndex = Math.round(wordEl.offsetTop / lineHeightPx.current);
        scrollRaw.set(
          -Math.max(0, lineIndex - CARET_ROW) * lineHeightPx.current,
        );
      }
    };
    const ro = new ResizeObserver(bump);
    ro.observe(outer);
    void document.fonts?.ready.then(bump);
    return () => ro.disconnect();
  }, [engine, scrollRaw]);

  const empty = words.length === 0;

  return (
    <div
      ref={outerRef}
      className="relative mx-auto w-full max-w-5xl cursor-text px-1"
      style={{
        height: `${LINE_HEIGHT_REM * VISIBLE_LINES}rem`,
        // Perspective for the tilted word window below. A longer focal length
        // keeps the receding depth while avoiding the heavy keystone skew
        // (glyphs at the edges leaning like italics) a short one produced.
        perspective: "1600px",
      }}
      onClick={onRequestFocus}
      role="textbox"
      aria-label="typing test text — just start typing"
      aria-readonly="true"
      tabIndex={-1}
    >
      {/* The tilted window is FIXED (it does not scroll), so a line's depth is a
          function of its screen row — not how far the user has typed. The words
          scroll inside it; the caret shares that scrolling layer and stays
          pixel-aligned (offsets are measured in flat layout space). Hinged on
          the caret row and tilted the other way (positive rotateX) so the rows
          of already-typed text ABOVE lean back and recede into depth while the
          upcoming rows below stay forward; a bottom-only mask blurs/fades the
          lowest, furthest-ahead rows out. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          transform: "rotateX(12deg)",
          transformOrigin: `center ${TILT_ORIGIN_Y}`,
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 0%, #000 60%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, #000 0%, #000 60%, transparent 100%)",
        }}
      >
        <motion.div
          ref={innerRef}
          className={cn(
            "typing-words relative transition-[filter,opacity] duration-300",
            !focused && !finished && "opacity-40 blur-[6px]",
          )}
          // Justify every full line to both edges (Word-style block); the last,
          // partial line is centred so short texts (quotes, custom, the zen
          // prompt) sit centred under the nav instead of hugging the left.
          style={{ y: scrollY, textAlign: "justify", textAlignLast: "center" }}
        >
          {empty ? (
            // hint sits on the line BELOW the caret, so the caret starts at
            // the centre of an empty first line instead of inside the hint
            <span ref={placeholderRef} className="block">
              <span className="block">&nbsp;</span>
              <span className="typing-char block text-center" data-state="pending">
                {engine.config.mode === "zen"
                  ? "type anything — zen mode just listens…"
                  : ""}
              </span>
            </span>
          ) : (
            words.map((w, i) => (
              // A real space between words (not a margin) gives `text-align:
              // justify` the whitespace it needs to stretch each line to width.
              <Fragment key={i}>
                <Word
                  word={w}
                  register={(el) => {
                    if (el) wordEls.current.set(i, el);
                    else wordEls.current.delete(i);
                  }}
                />{" "}
              </Fragment>
            ))
          )}
          {!finished && (
            <Caret x={caretX} y={caretY} visible={focused} activityKey={version} />
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {!focused && !finished && (
          <motion.button
            type="button"
            // `.glass` forces position:relative (unlayered CSS beats the
            // `absolute` utility), so pin it absolute inline; and because
            // animating `scale` makes framer own the transform, centre it via
            // framer's x/y (the `-translate-*` classes would be ignored).
            className="popover absolute left-1/2 top-1/2 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-foreground"
            style={{ position: "absolute" }}
            initial={{ opacity: 0, scale: 0.92, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={onRequestFocus}
          >
            <MousePointerClick aria-hidden className="size-4 text-primary" />
            click or press any key to focus
          </motion.button>
        )}
      </AnimatePresence>
      {running && <span className="sr-only" aria-live="off" />}
    </div>
  );
}

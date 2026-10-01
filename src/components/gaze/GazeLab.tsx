"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { beep, CalibrationOverlay } from "@/components/gaze/CalibrationOverlay";
import { GlassButton, GlassPanel } from "@/components/glass";
import { DOWN_ENTER_SCORE, FEATURE_NAMES, gazeFeatures } from "@/lib/gaze/heuristics";
import { getController, useGazeStore } from "@/lib/gaze/store";
import { toast } from "@/lib/store/toast";

const EDGE = "3.5rem";
const FAR = `calc(100% - ${EDGE})`;

type Segment =
  | { kind: "dot"; label: 0; top: string; left: string; ms: number }
  | { kind: "keys"; label: 1; target: string; ms: number }
  | { kind: "type"; label: 0; ms: number };

const dot = (top: string, left: string): Segment => ({ kind: "dot", label: 0, top, left, ms: 2200 });
const keys = (target: string): Segment => ({ kind: "keys", label: 1, target, ms: 3500 });

/**
 * Scripted, labelled run (~40s). Keyboard glances are interleaved with screen
 * dots so the look-down / look-up transitions resemble real typing, and the
 * typing segment checks for false alarms under realistic head movement.
 */
export const SCRIPT: Segment[] = [
  dot(EDGE, EDGE),
  dot(EDGE, FAR),
  keys("the left half of your keyboard"),
  dot("50%", EDGE),
  dot("50%", FAR),
  keys("the space bar"),
  dot(FAR, EDGE),
  dot(FAR, "50%"),
  keys("the number row"),
  dot(FAR, FAR),
  keys("the right half of your keyboard"),
  { kind: "type", label: 0, ms: 12000 },
];

/** Frames this soon after a segment starts are eyes still moving — not scored. */
const SKIP_MS = { dot: 700, keys: 1200, type: 1000 };
const TAIL_MS = 200;
const SENTENCE =
  "the quick brown fox jumps over the lazy dog while your eyes stay on the screen";

export interface LabRow {
  seg: number;
  label: 0 | 1;
  t: number;
  p: number;
  f: number[];
}

/** Score a run: smoothed-score rates at the enter line + controller peek events per segment. */
export function summarize(rows: LabRow[], peekSegs: number[], script = SCRIPT) {
  const over = (label: 0 | 1) => {
    const rs = rows.filter((r) => r.label === label);
    return {
      frames: rs.length,
      rate: rs.length ? rs.filter((r) => r.p >= DOWN_ENTER_SCORE).length / rs.length : 0,
    };
  };
  const glanceSegs = script.flatMap((s, i) => (s.label === 1 ? [i] : []));
  return {
    keyboard: over(1),
    screen: over(0),
    glances: glanceSegs.length,
    glancesCaught: glanceSegs.filter((i) => peekSegs.includes(i)).length,
    falseAlarms: peekSegs.filter((i) => script[i].label === 0).length,
  };
}

function downloadCsv(rows: LabRow[]) {
  const head = ["segment", "label", "t_ms", "p_smoothed", ...FEATURE_NAMES].join(",");
  const body = rows.map((r) =>
    [r.seg, r.label, r.t, r.p.toFixed(4), ...r.f.map((v) => v.toFixed(5))].join(","),
  );
  const url = URL.createObjectURL(
    new Blob([[head, ...body].join("\n")], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `gaze-lab-${new Date().toISOString().slice(0, 19)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

type Phase = "idle" | "calibrating" | "recording" | "results";

/**
 * Record mode: calibrate, follow a labelled script, get precision/recall from
 * the real controller. Frames are only numbers and stay in the tab unless the
 * CSV is downloaded.
 */
export function GazeLab() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seg, setSeg] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof summarize> | null>(null);
  const rows = useRef<LabRow[]>([]);
  const peekSegs = useRef<number[]>([]);
  const current = useRef({ i: -1, start: 0 });
  const audio = useRef<AudioContext | null>(null);
  const startedCamera = useRef(false);

  // leave the camera as we found it
  useEffect(
    () => () => {
      if (!startedCamera.current) return;
      getController().stop();
      useGazeStore.getState().setCameraOn(false);
      useGazeStore.getState().setStatus("inactive");
    },
    [],
  );

  const start = async () => {
    audio.current ??= new AudioContext(); // must be created inside the click
    const c = getController();
    if (!c.getStream()) {
      try {
        await c.start(document.createElement("video"));
        startedCamera.current = true;
        useGazeStore.getState().setCameraOn(true);
      } catch (err) {
        toast(err instanceof Error ? err.message : "camera failed to start");
        return;
      }
    }
    setPhase("calibrating");
  };

  const onCalibrated = useCallback(() => {
    useGazeStore.getState().setCalibrated(true);
    setPhase("recording");
  }, []);
  const onCancel = useCallback(() => setPhase("idle"), []);

  useEffect(() => {
    if (phase !== "recording") return;
    const c = getController();
    rows.current = [];
    peekSegs.current = [];
    let alive = true;

    const off = c.on((e) => {
      const { i, start } = current.current;
      if (i < 0) return;
      if (e.type === "peek-start") {
        peekSegs.current.push(i);
        return;
      }
      if (e.type !== "frame" || e.frame.faces !== 1 || e.score === null) return;
      const s = SCRIPT[i];
      const t = performance.now() - start;
      if (t < SKIP_MS[s.kind] || t > s.ms - TAIL_MS) return;
      rows.current.push({
        seg: i,
        label: s.label,
        t: Math.round(t),
        p: e.score,
        f: gazeFeatures(e.frame),
      });
    });

    const run = async () => {
      for (let i = 0; i < SCRIPT.length; i++) {
        current.current = { i, start: performance.now() };
        setSeg(i);
        await new Promise((r) => setTimeout(r, SCRIPT[i].ms));
        if (!alive) return;
        if (SCRIPT[i].kind === "keys") beep(audio.current);
      }
      current.current = { i: -1, start: 0 };
      setResult(summarize(rows.current, peekSegs.current));
      setPhase("results");
    };
    void run();

    return () => {
      alive = false;
      off();
      current.current = { i: -1, start: 0 };
    };
  }, [phase]);

  const s = SCRIPT[seg];

  return (
    <>
      {(phase === "idle" || phase === "calibrating") && (
        <GlassPanel pad="md" className="flex flex-col items-start gap-4">
          <h2 className="card-title">record a labelled run</h2>
          <p className="text-sm text-muted-foreground">
            calibrate, then follow about 40 seconds of prompts. sound on — a beep
            means look back up.
          </p>
          <GlassButton variant="primary" onClick={() => void start()}>
            start
          </GlassButton>
        </GlassPanel>
      )}

      {phase === "results" && result && (
        <GlassPanel pad="md" className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-6">
            <Stat label="glances caught" value={`${result.glancesCaught} / ${result.glances}`} />
            <Stat label="false alarms" value={String(result.falseAlarms)} />
            <Stat
              label={`keyboard frames flagged (${result.keyboard.frames})`}
              value={pct(result.keyboard.rate)}
            />
            <Stat
              label={`screen frames flagged (${result.screen.frames})`}
              value={pct(result.screen.rate)}
            />
          </dl>
          <div className="flex flex-wrap gap-2">
            <GlassButton variant="primary" onClick={() => setPhase("recording")}>
              run again
            </GlassButton>
            <GlassButton onClick={() => setPhase("calibrating")}>recalibrate</GlassButton>
            <GlassButton variant="ghost" onClick={() => downloadCsv(rows.current)}>
              download csv
            </GlassButton>
          </div>
        </GlassPanel>
      )}

      <AnimatePresence>
        {phase === "calibrating" && (
          <CalibrationOverlay onDone={onCalibrated} onCancel={onCancel} />
        )}
      </AnimatePresence>

      {phase === "recording" && (
        <div
          className="fixed inset-0 z-50 bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="gaze recording"
        >
          <span className="eyebrow absolute left-1/2 top-6 -translate-x-1/2">
            {seg + 1} / {SCRIPT.length}
          </span>
          {s.kind === "dot" && (
            <span
              className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{ top: s.top, left: s.left }}
            />
          )}
          {s.kind === "keys" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <h2 className="text-3xl font-bold text-foreground">look at {s.target}</h2>
              <p className="text-muted-foreground">look back up at the beep</p>
            </div>
          )}
          {s.kind === "type" && (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
              <h2 className="text-3xl font-bold text-foreground">type this without looking down</h2>
              <p className="max-w-xl text-lg text-muted-foreground">{SENTENCE}</p>
              <input
                autoFocus
                aria-label="type the sentence"
                className="w-full max-w-xl rounded-xl border border-border bg-transparent px-4 py-3 text-lg text-foreground outline-none"
              />
            </div>
          )}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <GlassButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
              cancel
            </GlassButton>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-4xl font-extrabold tracking-tight text-foreground">{value}</dd>
    </div>
  );
}

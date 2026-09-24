"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, Crosshair, ScanFace, Square, VideoOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CalibrationOverlay } from "@/components/gaze/CalibrationOverlay";
import { CameraDock } from "@/components/gaze/CameraDock";
import { ConsentModal } from "@/components/gaze/ConsentModal";
import { GazeStatusPill } from "@/components/gaze/GazeStatusPill";
import { GlassButton } from "@/components/glass";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { ConfigBar } from "@/components/test/ConfigBar";
import { FocusOverlay } from "@/components/test/FocusOverlay";
import { LiveStats } from "@/components/test/LiveStats";
import { RestartHint } from "@/components/test/RestartHint";
import { WordStream } from "@/components/test/WordStream";
import { TypingEngine } from "@/lib/engine/engine";
import { createRng, randomSeed } from "@/lib/engine/rng";
import { getController, useGazeStore } from "@/lib/gaze/store";
import {
  applyPersonalBest,
  markSynced,
  saveResult,
  touchStreak,
} from "@/lib/storage/local";
import { useSettings } from "@/lib/store/settings";
import { useUi } from "@/lib/store/ui";
import { generateWords } from "@/lib/text/generator";
import {
  configKey,
  DEFAULT_CONFIG,
  type CalibrationData,
  type EngineResult,
  type IntegrityReport,
  type PersonalBest,
  type SavedResult,
  type TestConfig,
} from "@/lib/types";
import { cn, uid } from "@/lib/utils";

type Phase = "test" | "results";

/** Repeat/shuffle a small word set into a ~30-word practice passage. */
function buildPracticeText(words: string[], seed: number): string {
  const rng = createRng(seed);
  const out: string[] = [];
  while (out.length < Math.max(30, words.length)) {
    const shuffled = [...words].sort(() => rng() - 0.5);
    out.push(...shuffled);
  }
  return out.slice(0, Math.max(30, words.length)).join(" ");
}

/**
 * The whole test flow: config → typing → results, with gaze integrity,
 * focus-loss handling and persistence. Keyboard input is captured globally
 * so the test never depends on a focused input element.
 */
export function TestExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();

  const settings = useSettings();
  const gaze = useGazeStore();
  const setTestRunning = useUi((s) => s.setTestRunning);
  const testRunning = useUi((s) => s.testRunning);

  // Start from the deterministic default so the server and the client's first
  // render hydrate identically — the persisted default is applied on mount
  // below. Reading the persisted store here would mismatch the SSR'd config bar.
  const [config, setConfig] = useState<TestConfig>(DEFAULT_CONFIG);
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [engine, setEngine] = useState<TypingEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("test");
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [pbInfo, setPbInfo] = useState<{
    isNewBest: boolean;
    previous?: PersonalBest;
  }>({ isNewBest: false });
  const [overlay, setOverlay] = useState<"blur" | "peek" | null>(null);
  const [streamFocused, setStreamFocused] = useState(true);
  const [failedNotice, setFailedNotice] = useState<string | null>(null);

  const [consentOpen, setConsentOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  /** bumped when a failed (expert/master) run should auto-restart */
  const [failedRestartTick, setFailedRestartTick] = useState(0);

  const engineRef = useRef<TypingEngine | null>(null);
  const phaseRef = useRef<Phase>("test");
  const overlayRef = useRef<typeof overlay>(null);
  const configRef = useRef(config);
  const seedRef = useRef(seed);
  const chunkRef = useRef(1);
  const focusLostRef = useRef(false);
  /** why the current run failed — drives the notice copy (typo vs looked away) */
  const failCauseRef = useRef<"typo" | "lookaway">("typo");
  const gazeSessionRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tabArmedRef = useRef(0);
  const sessionStatusRef = useRef(sessionStatus);

  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
    phaseRef.current = phase;
    overlayRef.current = overlay;
    configRef.current = config;
    seedRef.current = seed;
  });

  // Detect camera/worker support once on the client — this is what unlocks the
  // whole gaze-integrity UI (the button, calibration, status pill). Without it
  // `supported` stays false and the app's headline feature never appears.
  useEffect(() => {
    useGazeStore.getState().detectSupport();
  }, []);

  /* ── engine lifecycle ─────────────────────────────────────────────── */

  const endGazeSession = useCallback((): IntegrityReport => {
    if (gazeSessionRef.current) {
      gazeSessionRef.current = false;
      try {
        return getController().endSession();
      } catch {
        // fall through to untracked
      }
    }
    return {
      status: "untracked",
      peeks: [],
      peekCount: 0,
      peekTotalMs: 0,
      trackingLostMs: 0,
      focusLost: focusLostRef.current,
    };
  }, []);

  const handleFinish = useCallback(
    async (engineDone: TypingEngine, r: EngineResult) => {
      setTestRunning(false);
      const cfg = configRef.current;

      if (r.reason === "aborted") {
        endGazeSession();
        return;
      }
      if (r.reason === "failed") {
        endGazeSession();
        setFailedNotice(
          failCauseRef.current === "lookaway"
            ? "test failed — master allows no looking away from the screen"
            : cfg.difficulty === "master"
              ? "test failed — master allows no mistakes"
              : "test failed — expert allows no errored words",
        );
        setFailedRestartTick((t) => t + 1);
        return;
      }

      const report = endGazeSession();
      const result: SavedResult = {
        id: uid(),
        mode: cfg.mode,
        config: cfg,
        configKey: configKey(cfg),
        wpm: r.wpm,
        rawWpm: r.rawWpm,
        accuracy: r.accuracy,
        consistency: r.consistency,
        chars: r.chars,
        durationMs: r.durationMs,
        timeline: r.timeline,
        integrity: report.status,
        peekCount: report.peekCount,
        peekTotalMs: report.peekTotalMs,
        trackingLostMs: report.trackingLostMs,
        keyStats: r.keyStats,
        missedWords: r.missedWords,
        createdAt: Date.now(),
        synced: false,
      };

      const pb = await applyPersonalBest(result);
      await saveResult(result);
      await touchStreak(result.createdAt);

      setSaved(result);
      setPbInfo(pb);
      setPhase("results");

      // best-effort server sync when signed in — guest mode stays local. Read
      // the session through a ref: this callback is captured by the engine's
      // finish subscription when the engine is built (often while the session
      // is still "loading"), so a closed-over status would be stale.
      if (sessionStatusRef.current === "authenticated") {
        const payload: Partial<SavedResult> = { ...result };
        delete payload.id;
        delete payload.synced;
        const body = JSON.stringify({
          result: payload,
          timingFingerprint: engineDone
            .getKeystrokeIntervals()
            .slice(0, 300)
            .map((n) => Math.round(n)),
        });
        const submit = async (retry: boolean): Promise<void> => {
          const res = await fetch("/api/results", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
          if (res.ok) {
            // it's in the account now — never offer it as a guest run to claim
            await markSynced([result.id]);
          } else if (res.status === 429 && retry) {
            // back-to-back short tests trip the per-user submit throttle; wait
            // it out once rather than stranding the run as "unsynced"
            await new Promise((r) => setTimeout(r, 6500));
            await submit(false);
          }
        };
        void submit(true).catch(() => {});
      }
    },
    [endGazeSession, setTestRunning],
  );

  const buildEngine = useCallback(
    (cfg: TestConfig, sd: number) => {
      engineRef.current?.dispose();
      chunkRef.current = 1;
      focusLostRef.current = false;
      failCauseRef.current = "typo";
      if (gazeSessionRef.current) {
        gazeSessionRef.current = false;
        try {
          getController().endSession();
        } catch {}
      }

      const words = generateWords(cfg, sd);
      const eng = new TypingEngine({ config: cfg, words });

      let started = false;
      eng.subscribe(() => {
        const snap = eng.getSnapshot();
        if (!started && snap.status === "running") {
          started = true;
          setTestRunning(true);
          setFailedNotice(null);
          const g = useGazeStore.getState();
          if (g.cameraOn && g.calibrated) {
            try {
              getController().beginSession();
              gazeSessionRef.current = true;
            } catch {}
          }
        }
        if (
          snap.status === "running" &&
          (cfg.mode === "time" || cfg.mode === "zen") &&
          eng.needsMoreWords()
        ) {
          eng.appendWords(generateWords(cfg, sd + chunkRef.current++, 40));
        }
      });
      eng.subscribeFinish((r) => void handleFinish(eng, r));

      engineRef.current = eng;
      setEngine(eng);
      setSeed(sd);
      setPhase("test");
      setOverlay(null);
      setStreamFocused(true);
      setTestRunning(false);
    },
    [handleFinish, setTestRunning],
  );

  // failed (expert/master) runs restart automatically with a fresh seed
  useEffect(() => {
    if (failedRestartTick > 0) {
      buildEngine(configRef.current, randomSeed());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedRestartTick]);

  // first engine + ?practice= entry
  /* eslint-disable react-hooks/set-state-in-effect -- one-time mount init from the URL */
  useEffect(() => {
    const practice = searchParams.get("practice");
    if (practice) {
      const words = practice.split(/\s+/).filter(Boolean).slice(0, 40);
      if (words.length > 0) {
        const sd = randomSeed();
        const cfg: TestConfig = {
          ...useSettings.getState().defaultConfig,
          mode: "custom",
          customText: buildPracticeText(words, sd),
        };
        setConfig(cfg);
        buildEngine(cfg, sd);
        router.replace("/", { scroll: false });
        return;
      }
    }
    // apply the persisted default now (post-hydration → no config-bar mismatch)
    const persisted = useSettings.getState().defaultConfig ?? DEFAULT_CONFIG;
    setConfig(persisted);
    buildEngine(persisted, seedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      setTestRunning(false);
    },
    [setTestRunning],
  );

  const restart = useCallback(
    (sameSeed = false) => {
      buildEngine(
        configRef.current,
        sameSeed ? seedRef.current : randomSeed(),
      );
    },
    [buildEngine],
  );

  const onConfigChange = useCallback(
    (cfg: TestConfig) => {
      setConfig(cfg);
      useSettings.getState().setDefaultConfig(cfg);
      buildEngine(cfg, randomSeed());
    },
    [buildEngine],
  );

  /* ── global keyboard capture ──────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const quickRestart = useSettings.getState().quickRestart;

      if (e.key === "Tab") {
        e.preventDefault();
        if (quickRestart || phaseRef.current === "results") {
          restart(false);
        } else {
          tabArmedRef.current = performance.now();
        }
        return;
      }
      if (e.key === "Enter" && !quickRestart) {
        if (performance.now() - tabArmedRef.current < 1500) {
          e.preventDefault();
          restart(false);
        }
        return;
      }

      if (phaseRef.current === "results") return;

      const eng = engineRef.current;
      if (!eng) return;
      const snap = eng.getSnapshot();

      if (e.key === "Escape") {
        if (snap.status === "running" || snap.status === "paused") {
          if (configRef.current.mode === "zen") {
            eng.finish("completed");
          } else {
            eng.finish("aborted");
            restart(false);
          }
        }
        return;
      }

      if (overlayRef.current === "blur") return; // click to resume first

      if (e.key === "Backspace") {
        e.preventDefault();
        eng.input(
          e.ctrlKey || e.altKey || e.metaKey ? "Backspace:word" : "Backspace",
          e.timeStamp,
        );
        setStreamFocused(true);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        if (e.key === " ") e.preventDefault();
        eng.input(e.key, e.timeStamp);
        setStreamFocused(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart]);

  /* ── focus-loss integrity ─────────────────────────────────────────── */

  useEffect(() => {
    const pauseForBlur = () => {
      const eng = engineRef.current;
      if (eng && eng.getSnapshot().status === "running") {
        eng.pause("blur");
        focusLostRef.current = true;
        setOverlay("blur");
        try {
          getController().markFocusLost();
        } catch {}
      }
    };
    const onVisibility = () => {
      if (document.hidden) pauseForBlur();
    };
    window.addEventListener("blur", pauseForBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pauseForBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const resumeFromOverlay = useCallback(() => {
    const eng = engineRef.current;
    if (eng && eng.getSnapshot().status === "paused") eng.resume();
    setOverlay(null);
  }, []);

  /* ── gaze events: peek pause + status mirroring ───────────────────── */

  useEffect(() => {
    if (!gaze.cameraOn) return;
    const controller = getController();
    return controller.on((ev) => {
      if (ev.type === "status") {
        useGazeStore.getState().setStatus(ev.status);
        return;
      }
      const eng = engineRef.current;
      if (ev.type === "peek-start") {
        if (eng && eng.getSnapshot().status === "running") {
          if (configRef.current.difficulty === "master") {
            // master is unforgiving: one glance away from the screen ends it
            failCauseRef.current = "lookaway";
            eng.finish("failed");
          } else if (useSettings.getState().pauseOnPeek) {
            eng.pause("peek");
            setOverlay("peek");
          }
        }
      }
      if (ev.type === "peek-end" && overlayRef.current === "peek") {
        const engine2 = engineRef.current;
        if (engine2 && engine2.getSnapshot().status === "paused") {
          engine2.resume();
        }
        setOverlay(null);
      }
    });
  }, [gaze.cameraOn]);

  /* ── camera enable / disable flow ─────────────────────────────────── */

  const startCamera = useCallback(async () => {
    try {
      const controller = getController();
      let video = videoRef.current;
      if (!video) {
        video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        videoRef.current = video;
      }
      await controller.start(video);
      const g = useGazeStore.getState();
      g.setError(undefined);
      g.setCameraOn(true);
      g.setStatus(controller.getStatus());
      if (!g.calibrated) setCalibrating(true);
    } catch (err) {
      const g = useGazeStore.getState();
      g.setStatus("error");
      g.setError(
        err instanceof Error ? err.message : "the camera could not be started",
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    try {
      getController().stop();
    } catch {}
    useGazeStore.getState().setCameraOn(false);
    useGazeStore.getState().setStatus("inactive");
  }, []);

  const onGazeButton = useCallback(() => {
    if (!gaze.consented) {
      setConsentOpen(true);
    } else if (!gaze.cameraOn) {
      void startCamera();
    } else {
      stopCamera();
    }
  }, [gaze.consented, gaze.cameraOn, startCamera, stopCamera]);

  const onCalibrated = useCallback((data: CalibrationData) => {
    try {
      getController().setCalibration(data);
    } catch {}
    useGazeStore.getState().setCalibrated(true);
    setCalibrating(false);
  }, []);

  /* ── results actions ──────────────────────────────────────────────── */

  const practiceMissed = useMemo(() => {
    if (!saved || saved.missedWords.length === 0) return null;
    return () => {
      const sd = randomSeed();
      const cfg: TestConfig = {
        ...configRef.current,
        mode: "custom",
        customText: buildPracticeText(
          [...new Set(saved.missedWords)].slice(0, 20),
          sd,
        ),
      };
      setConfig(cfg);
      buildEngine(cfg, sd);
    };
  }, [saved, buildEngine]);

  const isZen = config.mode === "zen";
  const running = engine !== null && phase === "test";

  /* ── render ───────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center">
      <AnimatePresence mode="wait">
        {phase === "test" ? (
          // keyed on the phase only: the config bar must stay mounted across
          // config changes (re-keying remounted it, wiping its custom-text
          // modal state), so only the word stage below re-keys per run
          <motion.div
            key="test"
            className="flex w-full flex-1 flex-col items-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <ConfigBar
              config={config}
              onChange={onConfigChange}
              disabled={testRunning}
            />

            {/* gaze controls — the verification USP, kept one quiet row */}
            {gaze.supported && (
              <div
                className={cn(
                  "mt-4 flex flex-wrap items-center justify-center gap-2 transition-opacity duration-300",
                  testRunning && "pointer-events-none opacity-30",
                )}
              >
                <GlassButton
                  size="sm"
                  variant={gaze.cameraOn ? "default" : "ghost"}
                  onClick={onGazeButton}
                  icon={gaze.cameraOn ? <VideoOff /> : <ScanFace />}
                >
                  {gaze.cameraOn ? "turn camera off" : "verify with camera"}
                </GlassButton>
                {gaze.cameraOn && !gaze.calibrated && (
                  <GlassButton
                    size="sm"
                    variant="primary"
                    icon={<Crosshair />}
                    onClick={() => setCalibrating(true)}
                  >
                    calibrate
                  </GlassButton>
                )}
                {gaze.cameraOn && <GazeStatusPill />}
              </div>
            )}

            <AnimatePresence>
              {gaze.error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 max-w-md text-center text-xs text-danger"
                  role="alert"
                >
                  {gaze.error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* the typing stage — centred in the remaining height */}
            <div className="flex w-full flex-1 flex-col justify-center py-10 sm:py-14">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`stage-${seed}-${configKey(config)}`}
                  className="relative w-full"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 32 }}
                >
                  {engine && (
                    <div className="mb-3 flex h-9 items-end justify-center">
                      <LiveStats engine={engine} />
                    </div>
                  )}
                  {engine && (
                    <WordStream
                      engine={engine}
                      focused={streamFocused}
                      onRequestFocus={() => setStreamFocused(true)}
                    />
                  )}
                  <FocusOverlay kind={overlay} onResume={resumeFromOverlay} />
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex h-6 items-center justify-center">
                <AnimatePresence>
                  {failedNotice && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="alert"
                      className="flex items-center gap-2 rounded-full border border-danger/25 bg-danger/10 px-3.5 py-1 text-[13px] text-danger"
                    >
                      <CircleAlert aria-hidden className="size-3.5" />
                      {failedNotice}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              {isZen && running && (
                <GlassButton
                  size="sm"
                  variant="default"
                  icon={<Square />}
                  onClick={() => engineRef.current?.finish("completed")}
                >
                  end zen session
                </GlassButton>
              )}
              <RestartHint />
            </div>
          </motion.div>
        ) : (
          saved && (
            <motion.div
              key={`results-${saved.id}`}
              className="w-full"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <ResultsScreen
                result={saved}
                pb={pbInfo}
                onRestart={() => restart(false)}
                onRepeat={() => restart(true)}
                onPracticeMissed={practiceMissed}
              />
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* gaze surfaces */}
      <ConsentModal
        open={consentOpen}
        onAccept={() => {
          useGazeStore.getState().setConsented(true);
          setConsentOpen(false);
          void startCamera();
        }}
        onDecline={() => setConsentOpen(false)}
      />
      <AnimatePresence>
        {calibrating && (
          <CalibrationOverlay
            onDone={onCalibrated}
            onCancel={() => setCalibrating(false)}
          />
        )}
      </AnimatePresence>
      {gaze.cameraOn && settings.showCameraPreview && <CameraDock />}
    </div>
  );
}

# NoLook — Module Contracts

NoLook is a MonkeyType-class touch-typing trainer whose differentiator is
webcam gaze-integrity detection (did you peek at the keyboard?). The whole app
follows an **Apple liquid-glass aesthetic**: translucent frosted surfaces over
drifting ambient color glows, purposeful spring animation everywhere.

This file is the coordination spec. **Implement exactly these APIs.** Shared
types live in `src/lib/types.ts` — import from `@/lib/types`, never redeclare.

## Hard rules (all modules)

- TypeScript strict. Next.js 15 App Router. React 19.
- Client components start with `"use client"`.
- Imports use the `@/` alias (`@/lib/types`, `@/lib/utils`).
- `cn()` from `@/lib/utils` for class merging.
- **Colors: token utilities only** (defined in globals.css): `bg-background`,
  `text-foreground`, `text-muted-foreground`, `text-faint-foreground`,
  `bg-glass`, `bg-glass-strong`, `border-glass-border`, `text-primary`,
  `bg-primary`, `text-primary-foreground`, `text-success`, `text-warning`,
  `text-danger`, `text-caret`, plus char-state colors are handled by
  `.typing-char[data-state]` CSS. **Never** use raw Tailwind palette colors
  (`bg-zinc-900`, `text-white`, …) — themes break.
- Glass surfaces: use the CSS classes `.glass`, `.glass-strong`,
  `.glass-subtle`, `.glass-interactive` (already defined in globals.css) with
  Tailwind `rounded-3xl` / `rounded-full` etc.
- Animation: `framer-motion`. Springs tuned deliberately — default to
  `{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }` for UI moves,
  gentler `{ stiffness: 180, damping: 26 }` for large surfaces. Respect
  `useReducedMotion()`.
- Available deps (do NOT add new ones): framer-motion, zustand,
  @mediapipe/tasks-vision, @number-flow/react, next-themes, lucide-react,
  clsx, tailwind-merge, idb-keyval, zod, next-auth@5(beta),
  @auth/prisma-adapter, @prisma/client, bcryptjs, prisma (dev).
- Do NOT modify: `package.json`, `src/app/globals.css`, `src/app/layout.tsx`,
  `src/lib/types.ts`, `src/lib/utils.ts`, `next.config.ts`, or any directory
  owned by another module.
- Do NOT run `npm run build` or `npm run dev`. You may run
  `npx tsc --noEmit`; ignore errors caused by other modules' files not
  existing yet — fix only errors inside your own files.
- Every exported component/function gets a brief doc comment. Comments state
  constraints, not narration.

## Settings store (already written — consume it)

`src/lib/store/settings.ts` exports `useSettings` (zustand, persisted):
`AppSettings` fields from types.ts plus `set(patch: Partial<AppSettings>)`.

---

## Module 1 — Text data & generation (`src/lib/text/`)

Files: `words.ts`, `quotes.ts`, `generator.ts`.

- `words.ts`: `export const COMMON_WORDS: string[]` — 1000 common English
  words, lowercase, no duplicates, 2–9 letters, ordered by frequency.
- `quotes.ts`: `export const QUOTES: Quote[]` — ≥120 quotes (public
  domain/attributed: literature, science, film, proverbs). Fill all three
  length classes per the `Quote` type (short <150, medium 150–300, long >300
  chars). Real `source` strings.
- `generator.ts`:
  ```ts
  export function generateWords(config: TestConfig, seed: number, count?: number): string[];
  export function getQuote(config: TestConfig, seed: number): Quote | null;
  ```
  - Deterministic for a given seed (use `createRng` from `@/lib/engine/rng` —
    engine module owns it; signature `createRng(seed: number): () => number`).
  - `count` default: `config.wordCount` in words mode, 80 for time/zen.
  - punctuation toggle: realistic sentences — capitalize sentence starts,
    terminal `.`/`?`/`!` every 6–14 words, sprinkle commas, occasional quoted
    word, hyphenated pair, apostrophes.
  - numbers toggle: ~15% of words become 1–4 digit numbers.
  - quote mode: filter QUOTES by `config.quoteLength` ("all" = any), pick with
    rng, return it; `generateWords` for quote/custom splits the text on
    whitespace preserving punctuation.
  - zen mode: return `[]`.

## Module 2 — Typing engine (`src/lib/engine/`)

Files: `rng.ts`, `stats.ts`, `engine.ts`. Pure TS — **no React, no DOM**
(performance.now/setInterval fine).

- `rng.ts`: `export function createRng(seed: number): () => number`
  (mulberry32) and `export function randomSeed(): number`.
- `stats.ts`:
  ```ts
  export function computeConsistency(rawPerSecond: number[]): number; // kogasa(cov): 100*(1-tanh(cov+cov^3/3+cov^5/5)), clamp 0..100
  export function wpmFromChars(chars: number, ms: number): number;    // (chars/5)/(ms/60000)
  ```
- `engine.ts` — `export class TypingEngine`:
  ```ts
  constructor(opts: { config: TestConfig; words: string[] })
  readonly config: TestConfig;
  getSnapshot(): EngineSnapshot;                     // identity stable until version bump
  subscribe(fn: () => void): () => void;             // any change
  subscribeTick(fn: (t: TickSample) => void): () => void;   // once per elapsed second
  subscribeFinish(fn: (r: EngineResult) => void): () => void;
  input(key: string, timestampMs: number): void;     // printable char | " " | "Backspace" | "Backspace:word"
  pause(reason: PauseReason): void;                  // freezes clock
  resume(): void;
  finish(reason?: FinishReason): void;               // manual finish (zen / abort)
  appendWords(words: string[]): void;
  needsMoreWords(): boolean;                         // < 40 untyped words left (time mode)
  getKeystrokeIntervals(): number[];                 // ms deltas between keystrokes (for anti-cheat fingerprint)
  dispose(): void;
  ```
  Behavior:
  - Status idle → running on first `input`. Clock = performance.now deltas,
    paused time excluded. Internal 250ms interval drives time checks + one
    `TickSample` per whole second (raw = that second's window).
  - **Snapshot discipline**: `words` array — only changed `WordState` objects
    get new identity; snapshot object replaced on each version bump.
  - Space commits current word (ignored if nothing typed); typing the final
    word fully correct finishes words/quote/custom mode immediately (no space
    needed); space on final word also finishes.
  - Backspace: deletes last typed char; at word start jumps back to previous
    word **only if** it was committed with errors. `"Backspace:word"` clears
    the current word (send for Ctrl/Alt/Cmd+Backspace).
  - Extra chars: allowed up to target.length + 8, state "extra".
  - Difficulty: expert → committing a word containing any error ⇒ status
    "failed", finish(reason "failed"); master → any incorrect keystroke fails
    instantly.
  - Time mode: finish when elapsed ≥ duration*1000. `clockSeconds` counts down
    (ceil); other modes count up.
  - Zen: `words` starts empty; typing builds the current word (target ===
    typed, all correct); space commits. Never auto-finishes.
  - `EngineResult`: per types.ts. wpm = correct chars incl. one space per
    correctly committed word, /5, per minute. rawWpm = all typed chars incl.
    spaces. accuracy = correct keystrokes / total keystrokes (backspace not
    counted). keyStats keyed by intended target char (extras by typed char).
    missedWords = target words committed with ≥1 error. timeline: per-second
    samples; append final partial-second sample at finish.

## Module 3 — Gaze integrity (`src/lib/gaze/` + `src/components/gaze/`)

Honesty first: this is **head-pose + eye-state heuristics**, not precise gaze
coordinates — say so in comments and consent copy. Video never leaves the
browser; only numeric landmarks, transiently in memory.

Files: `src/lib/gaze/worker.ts`, `controller.ts`, `heuristics.ts`, `store.ts`,
components `ConsentModal.tsx`, `CalibrationOverlay.tsx`, `CameraDock.tsx`,
`GazeStatusPill.tsx` in `src/components/gaze/`.

- `worker.ts` — a module Web Worker (`self.onmessage`), implements the
  `GazeWorkerRequest`/`GazeWorkerResponse` protocol from types.ts using
  `FaceLandmarker` from `@mediapipe/tasks-vision`:
  - init: `FilesetResolver.forVisionTasks(wasmBase)` then
    `FaceLandmarker.createFromOptions` with `modelAssetPath: modelPath`,
    `runningMode: "VIDEO"`, `numFaces: 2`, `outputFaceBlendshapes: true`,
    `outputFacialTransformationMatrixes: true`. Assets are local:
    wasmBase `/mediapipe/wasm`, model `/models/face_landmarker.task` (main
    thread passes these).
  - frame: `detectForVideo(bitmap, timestamp)`; close the bitmap after. Derive:
    pitch/yaw/roll (degrees) from the first facialTransformationMatrix
    (column-major 4x4 → Euler), eyeLookDown = mean of `eyeLookDownLeft/Right`
    blendshape scores, eyeBlink = mean of blink blendshapes, faces = number of
    detected faces, confidence = 1 when a face is present else 0.
- `heuristics.ts`:
  ```ts
  export function computeDownScore(frame: GazeFrameResult, cal: CalibrationData): number;
  ```
  Direction-normalized so camera mounting/sign doesn't matter:
  `dir = sign(cal.bottomPitch - cal.neutralPitch)`;
  `pitchScore = dir*(frame.pitch - cal.bottomPitch) / max(6, dir*(cal.bottomPitch - cal.neutralPitch))`;
  `lookScore = (frame.eyeLookDown - cal.bottomLookDown) / max(0.08, cal.bottomLookDown - cal.neutralLookDown)`;
  return `max(0, 0.65*max(0,pitchScore) + 0.65*max(0,lookScore))`; if
  `frame.eyeBlink > 0.6` return the previous score (blink-hold — accept a
  `prevScore` param or document that caller holds).
  Score ≥ 1 ⇒ looking below the screen bottom, i.e. at the keyboard.
- `controller.ts` — `export class GazeController`:
  ```ts
  static isSupported(): boolean;                     // getUserMedia + Worker + OffscreenCanvas
  start(video: HTMLVideoElement): Promise<void>;     // getUserMedia 640x480 front cam, init worker, ~12fps createImageBitmap loop (skip frame if one in flight)
  stop(): void;                                      // stop tracks, terminate worker
  getStatus(): GazeStatusKind;
  getLastFrame(): GazeFrameResult | null;
  collectCalibration(step: "center" | "bottom", ms: number): Promise<{ pitch: number; lookDown: number }>; // median over window
  setCalibration(c: CalibrationData): void;
  getCalibration(): CalibrationData | null;
  on(fn: (e: GazeEvent) => void): () => void;
  beginSession(): void;                              // reset peek log at test start
  endSession(): IntegrityReport;                     // untracked if camera off/uncalibrated for the session
  markFocusLost(): void;
  ```
  ```ts
  export type GazeEvent =
    | { type: "status"; status: GazeStatusKind }
    | { type: "peek-start"; at: number }
    | { type: "peek-end"; at: number; durationMs: number }
    | { type: "frame"; frame: GazeFrameResult };
  ```
  Debounce: downScore ≥ 1 sustained **400ms** ⇒ status "down" + peek-start;
  score < 0.7 for 300ms ⇒ peek-end (hysteresis). 0.7–1.0 ⇒ "uncertain".
  faces=0 or confidence<0.5 sustained 600ms ⇒ "lost" (tracked separately as
  trackingLostMs, NOT a peek). faces>1 ⇒ "multiple". Latency budget: look-away
  → status change under 150ms of the debounce window end.
- `store.ts` — zustand `useGazeStore`: `{ supported, consented (persisted via
  zustand persist), cameraOn, status: GazeStatusKind, calibrated, error?:
  string }` + actions `setConsented`, `setStatus`, `setCameraOn`,
  `setCalibrated`, `setError`. The controller singleton lives here too:
  `getController(): GazeController` (lazy, client-only).
- Components (all glass aesthetic, framer-motion):
  - `ConsentModal.tsx` `{ open, onAccept, onDecline }` — plain-language:
    optional, on-device only, nothing recorded/uploaded, derived numbers only,
    can turn off anytime. Two GlassButtons.
  - `CalibrationOverlay.tsx` `{ onDone(data: CalibrationData), onCancel }` —
    full-screen glass overlay; animated target dot: center (hold ~1.2s,
    collect "center"), then bottom-center edge (collect "bottom"); progress
    ring around dot; never dead time (pulse + copy). Calls controller.
  - `CameraDock.tsx` — small draggable glass card (bottom-right) with live
    `<video>` preview (mirrored), hide/show toggle, status ring tint.
  - `GazeStatusPill.tsx` — compact pill: `GlassDot` color by status (ok →
    success, uncertain → warning, down/lost → danger, inactive → faint) +
    label; gently pulsing (`.gaze-dot`).

## Module 4 — Glass UI primitives (`src/components/glass/`)

Files: `Providers.tsx`, `BackgroundGlow.tsx`, `GlassSurface.tsx`,
`GlassPanel.tsx`, `GlassButton.tsx`, `GlassPill.tsx`, `GlassDot.tsx`,
`ThemeToggle.tsx`, `theme-transition.ts`, `GooeyFilter.tsx`,
`SmoothNumber.tsx`, `index.ts` (re-exports).

- `Providers.tsx`: next-themes `ThemeProvider` — `attribute="class"`,
  `themes={["midnight","dawn","aurora","sunset"]}`, `defaultTheme="midnight"`,
  `disableTransitionOnChange` **off** (we animate), `enableSystem={false}`.
- `BackgroundGlow.tsx`: renders `<div className="bg-glow-field"><div className="glow-3"/></div>`
  plus a pointer-following soft glow orb (springs on motion values, mass 0.1
  stiffness 131 damping 10 vibe — adapted from a mouse-follow pattern):
  ~340px radial gradient of `var(--primary)` at 8% opacity, blur 60px, fixed,
  `z-[-1]`, pointer-events-none, opacity 0 until pointer moves.
- `GlassSurface.tsx`: React 19 TSX adaptation of the SVG displacement-filter
  "liquid glass" surface (feImage displacement map + per-channel
  feDisplacementMap + chromatic offsets). Props: `{ children, className,
  style, width?, height?, borderRadius? (px, default 24), distortionScale?
  (default -140) }`, sized by className by default (w-full h-auto). Detect
  SVG-filter support (Chromium only — UA check for Safari/Firefox) and fall
  back to `.glass-strong` class. Regenerate displacement map on
  ResizeObserver. Use `useId` for filter ids. This is the **hero surface** —
  used for the results card and nav; cheaper `.glass` classes elsewhere.
- `GlassPanel.tsx`: `motion.div` with `.glass rounded-3xl` + padding presets
  `pad="sm"|"md"|"lg"`, optional `interactive`.
- `GlassButton.tsx`: `{ variant?: "default"|"primary"|"ghost"|"danger", size?:
  "sm"|"md"|"lg", icon?: ReactNode }` — `.glass .glass-interactive
  rounded-full`, primary = `bg-primary text-primary-foreground` with glow
  shadow of primary at 35%, whileTap scale 0.96, whileHover subtle -1px y.
  Forward ref, extends ComponentPropsWithoutRef<"button">.
- `GlassPill.tsx`: segmented control. `{ options: { value: string; label:
  ReactNode; icon?: ReactNode }[], value, onChange, size?, ariaLabel }` —
  glass pill container, active segment = motion.div `layoutId` glass-strong
  chip sliding behind labels; keyboard navigable (radiogroup semantics).
- `GlassDot.tsx`: `{ tone: "success"|"warning"|"danger"|"primary"|"faint",
  pulse?: boolean }` — 8px dot, colored via tokens, `.gaze-dot` when pulse.
- `ThemeToggle.tsx` + `theme-transition.ts`: theme switcher using the **View
  Transitions API polygon reveal, top-left, no blur** (inject keyframes via a
  `<style id="theme-transition-styles">` swap, `document.startViewTransition`,
  fallback = plain switch). `theme-transition.ts` exports
  `startThemeTransition(apply: () => void)` with the polygon top-left
  clip-path keyframes (old root: no animation, z-index -1; new root:
  `polygon(50% -71%, -50% 71%, …)` → full reveal, 0.7s var(--expo-out)).
  ThemeToggle renders a glass pill of the four theme names (or a compact
  cycling button with the half-moon SVG rotating) — your taste, keep it
  premium.
- `GooeyFilter.tsx`: SVG `feGaussianBlur`+`feColorMatrix` gooey filter
  provider (id `nolook-gooey`) + docs comment on usage.
- `SmoothNumber.tsx`: thin wrapper over `@number-flow/react` `NumberFlow`
  with tabular numbers and optional prefix/suffix/format props.
- `index.ts` re-exports everything.

## Module 5 — Test screen components (`src/components/test/`)

Files: `useEngineSnapshot.ts`, `WordStream.tsx`, `Caret.tsx`, `ConfigBar.tsx`,
`LiveStats.tsx`, `FocusOverlay.tsx`, `RestartHint.tsx`.

- `useEngineSnapshot.ts`: `export function useEngineSnapshot(engine: TypingEngine | null): EngineSnapshot | null`
  via `useSyncExternalStore` (subscribe/getSnapshot; server snapshot null).
- `WordStream.tsx`: `{ engine, focused: boolean, onRequestFocus(): void }`.
  - Renders `.typing-words` container, fixed height = 3 lines
    (`line-height 2.6rem` → h-[7.8rem]), `overflow-hidden`, words as
    `<span className="typing-word" data-error>` wrapping char
    `<span className="typing-char" data-state=…>` spans. Word components
    memoized — only re-render when their WordState identity changes.
  - Smooth line scroll: measure current word's span offsetTop; scroll offset
    keeps caret on middle line once past line 1 — animate inner container
    translateY with a spring motion value (no jumps).
  - Renders `<Caret/>` inside, passing a ref-map getter to locate the current
    char span; caret x/y springs (stiffness 480 damping 36 for x; y follows
    scroll), width 2px height 1.2em rounded, `bg-caret`, glow
    `shadow-[0_0_12px] shadow-caret/60`; blinks (opacity keyframes) only when
    idle ≥ 530ms; `smoothCaret:false` setting ⇒ instant positioning.
  - Unfocused state: blur words (`blur-[6px] opacity-40` transition) + center
    glass chip "click or press any key to focus".
- `ConfigBar.tsx`: `{ config: TestConfig, onChange(c: TestConfig): void,
  disabled?: boolean }` — one glass toolbar: mode GlassPill (time/words/
  quote/zen/custom), context params (durations 15/30/60/120 + custom popover
  numeric input; word counts 10/25/50/100 + custom; quote lengths), toggles
  punctuation/numbers (`@`/`#` style chips), difficulty pill. Custom-text mode
  opens a glass modal textarea. AnimatePresence for param row swaps
  (slide+fade). Disabled (dimmed, non-interactive) while running.
- `LiveStats.tsx`: `{ engine }` — subscribes via snapshot; shows clock
  (countdown/countup via SmoothNumber), live wpm, accuracy; hidden when
  `settings.liveStats` false; fades in only while running.
- `FocusOverlay.tsx`: `{ kind: "blur" | "peek" | null, onResume(): void }` —
  AnimatePresence glass-strong full-panel overlay; blur: "out of focus — click
  to resume"; peek: eyes icon + "eyes back on the screen to resume" (auto
  resumes, no click).
- `RestartHint.tsx`: subtle kbd hints: `tab` restart · `esc` end (zen).

## Module 6 — Results (`src/components/results/`)

Files: `ResultsScreen.tsx`, `WpmChart.tsx`, `IntegrityBadge.tsx`,
`PBCelebration.tsx`, `shareCard.ts`.

- `ResultsScreen.tsx`:
  ```ts
  {
    result: SavedResult;               // already persisted
    pb: { isNewBest: boolean; previous?: PersonalBest };
    onRestart(): void;                 // same config, new seed
    onRepeat(): void;                  // same seed ("practice this passage")
    onPracticeMissed(): void | null;   // null → hide CTA
  }
  ```
  Layout: staggered spring reveal (containers `staggerChildren 0.06`). Hero
  row: huge net WPM (SmoothNumber count-up from 0 over ~0.9s) + accuracy;
  PB delta chip (`+2.4 vs best` / new-best state triggers `<PBCelebration/>`).
  Stat grid (raw, consistency, chars c/i/e/m, duration). `<WpmChart/>` panel.
  `<IntegrityBadge/>`. CTA row: GlassButtons (restart / repeat / practice
  missed / share PNG). Share button calls `downloadShareCard(result)`.
- `WpmChart.tsx`: `{ timeline: TickSample[], height? }` — hand-rolled
  responsive SVG (no chart lib): net wpm line (primary, 2.5px, smooth
  monotone-cubic path, animated draw via pathLength), raw wpm as faint area
  (primary 12% fill), error ticks as small danger ×/dots on their second.
  Left axis: 3–4 gridline labels; x-axis seconds. Hover: vertical hairline +
  glass tooltip (wpm/raw/errors at t). Animate once on mount. Reduced motion:
  skip draw animation.
- `IntegrityBadge.tsx`: `{ report: Pick<SavedResult, "integrity"|"peekCount"|"peekTotalMs"|"trackingLostMs"> }`
  — clean: success eye icon "Clean run — eyes never left the screen";
  assisted: warning "Assisted — N peeks · X.Xs looking down" (transparent, not
  punitive); untracked: faint "Untracked — camera was off". Include a subtle
  info tooltip explaining heuristic honesty.
- `PBCelebration.tsx`: one celebratory moment — expanding primary glow ring +
  ~24 tiny glass shards/particles bursting (deterministic angles), "new
  personal best" label with spring pop. Runs once, ~1.6s, respects reduced
  motion (fade only).
- `shareCard.ts`:
  ```ts
  export async function renderShareCard(result: SavedResult): Promise<Blob>;
  export async function downloadShareCard(result: SavedResult): Promise<void>;
  ```
  1200×630 canvas, drawn by hand to match the glass look: theme-ish dark
  bg with two soft radial glows, rounded translucent card, big WPM, accuracy/
  consistency/mode line, integrity badge line, "nolook" wordmark. Read colors
  from getComputedStyle(document.documentElement) tokens so it matches the
  active theme.

## Module 7 — Storage & stats (`src/lib/storage/` + `src/components/stats/`)

Files: `src/lib/storage/local.ts`, `aggregate.ts`; components
`StatsDashboard.tsx`, `SummaryTiles.tsx`, `ProgressChart.tsx`,
`KeyHeatmap.tsx`, `MissedWords.tsx`, `PeekTrend.tsx`, `StreakCard.tsx`,
`HistoryTable.tsx`.

- `local.ts` (idb-keyval; keys `nolook:results`, `nolook:pbs`,
  `nolook:streak`) — all async, safe on server (no-op guards):
  ```ts
  saveResult(r: SavedResult): Promise<void>;
  getResults(): Promise<SavedResult[]>;                       // newest first
  getResultsPage(offset: number, limit: number, filter?: { mode?: TestMode; integrity?: IntegrityStatus }): Promise<{ items: SavedResult[]; total: number }>;
  getPersonalBests(): Promise<Record<string, PersonalBest>>;
  applyPersonalBest(r: SavedResult): Promise<{ isNewBest: boolean; previous?: PersonalBest }>; // call BEFORE marking; updates store when beaten (wpm)
  getStreak(): Promise<StreakInfo>;
  touchStreak(ts: number): Promise<StreakInfo>;               // call on each finished test
  clearHistory(): Promise<void>;
  exportHistory(): Promise<string>;                           // JSON dump
  ```
- `aggregate.ts` (pure):
  ```ts
  aggregateKeyStats(results: SavedResult[]): Record<string, KeyStat>;
  aggregateMissedWords(results: SavedResult[]): { word: string; count: number }[]; // desc
  wpmOverTime(results: SavedResult[]): { t: number; wpm: number; accuracy: number }[];
  peekTrend(results: SavedResult[]): { t: number; peeksPerTest: number }[];   // bucketed by day
  summarize(results: SavedResult[]): { tests: number; bestWpm: number; avgWpm: number; avgAccuracy: number; totalTimeMs: number; cleanRate: number };
  ```
- `StatsDashboard.tsx`: `{ }` — client component; loads results on mount
  (loading shimmer, empty state with CTA to take a test), composes the pieces
  below in a responsive grid of GlassPanels, staggered entrance.
- `SummaryTiles.tsx`: tiles (tests taken, best wpm, avg wpm, avg acc, time
  typed, clean-run rate) with SmoothNumber.
- `ProgressChart.tsx`: all-time WPM line (same hand-rolled SVG conventions as
  Module 6: primary line, faint area, glass hover tooltip, animated draw).
- `KeyHeatmap.tsx`: `{ keyStats: Record<string, KeyStat> }` — QWERTY keyboard
  graphic (3 letter rows, drawn with rounded glass keycaps in a flex grid);
  each key tinted by miss-rate: transparent → danger at 40%+ miss rate
  (color-mix via inline style with var(--danger)); tooltip per key with
  hits/misses/rate. Include number row only if digit stats exist.
- `MissedWords.tsx`: `{ words: { word: string; count: number }[], onPractice(words: string[]): void }`
  — top 12 chips + "practice these" GlassButton (primary).
- `PeekTrend.tsx`: peeks-per-test over time; mini bar/line; "are you needing
  the keyboard less?" caption.
- `StreakCard.tsx`: current/best streak with small flame; SmoothNumber.
- `HistoryTable.tsx`: paginated (20/page) filterable (mode, integrity) list of
  runs: date, mode chip, wpm, acc, consistency, integrity dot; row hover
  glass; expand row → mini timeline sparkline.

## Module 8 — Backend (`prisma/`, `src/lib/server/`, `src/app/api/`, `src/components/account/`, `src/components/leaderboard/`)

Must degrade gracefully: **no DATABASE_URL ⇒ every API route returns 503
`{ offline: true }` without crashing**, client stays in guest/local mode.

- `prisma/schema.prisma` (postgresql, `env("DATABASE_URL")`): Auth.js models
  (User/Account/Session/VerificationToken) + `passwordHash String?` +
  `displayName`, `settings Json?`; `TestResult` (fields mirroring SavedResult:
  mode, config Json, configKey, wpmRaw, wpmCorrect, accuracy, consistency,
  charStats Json, durationMs, timeline Json, integrityStatus, peekCount,
  peekTotalMs, createdAt, userId nullable, indexed on (configKey, wpmCorrect
  desc), leaderboardEligible Boolean); `PersonalBest` (userId+configKey unique,
  wpm, resultId, achievedAt).
- `src/lib/server/db.ts`: lazy singleton PrismaClient; `dbAvailable(): boolean`
  (checks env). Never instantiate at import time when env missing.
- `src/lib/server/auth.ts`: Auth.js v5 — `export const { handlers, auth,
  signIn, signOut } = NextAuth({...})` with PrismaAdapter, GitHub provider
  (env-gated) + Credentials (email/password, bcryptjs compare; register handled
  by `/api/register` route: zod-validated, bcrypt hash 12 rounds). JWT session
  strategy (credentials-compatible).
- `src/lib/server/validate.ts` anti-cheat:
  ```ts
  export function validateResultPlausibility(p: SubmitResultPayload): { ok: boolean; reason?: string };
  // reject: wpm > 250, accuracy > 100 or < 20 with high wpm, duration < 5s (non-zen),
  // wpm inconsistent with chars/duration (>3% off), timeline mean mismatch,
  // timingFingerprint with near-zero variance (bot), any NaN/negative.
  export function fingerprintSignature(intervals: number[]): string;  // coarse quantized hash
  export function checkRateLimit(key: string): boolean;               // in-memory ≥6s between submissions per user/ip
  ```
- API routes (`src/app/api/`): `auth/[...nextauth]/route.ts` (export
  handlers), `register/route.ts` (POST), `results/route.ts` (POST submit —
  auth optional; validates; stores; marks leaderboardEligible = passes
  validation && integrity !== null; GET own history paginated, auth required),
  `leaderboard/route.ts` (GET: query mode/configKey/window
  all|day|week/integrity clean|all; top 50 by wpmCorrect; dedupe best-per-user;
  Cache-Control s-maxage=60), `settings/route.ts` (GET/PUT user settings JSON).
  All zod-validated, try/catch → 503 offline when !dbAvailable().
- `src/components/account/AuthPanel.tsx`: glass login/register card — email+
  password fields (smooth spring caret underline focus states), GitHub button
  (hidden when provider not configured — fetch `/api/auth/providers`), error
  states, loading spinners. Works with next-auth `signIn` from
  "next-auth/react". Plus `ClaimHistoryBanner.tsx`: after sign-in, if local
  results exist and unsynced, offer "claim N guest runs" → POSTs each to
  /api/results (marks synced in IndexedDB via callback prop — accept
  `onClaimed(ids: string[])`).
- `src/components/leaderboard/LeaderboardView.tsx`: client; fetches
  /api/leaderboard; glass table (rank, name, wpm, acc, integrity dot);
  filters: mode pill, time window pill, integrity toggle (**default: clean
  only**); handles offline 503 with a friendly glass empty-state ("leaderboard
  needs a configured database — local mode active"); loading skeleton rows;
  top-3 subtle glow.
- `.env.example`: DATABASE_URL, AUTH_SECRET, GITHUB_ID, GITHUB_SECRET + one
  comment line each.

## Integration (done by the orchestrator, not you)

`src/app/layout.tsx`, `page.tsx` (test flow state machine), `stats/`,
`leaderboard/`, `settings/`, `login/` pages, `NavBar` — these consume your
modules exactly per the contracts above.

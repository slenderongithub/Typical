# Typical — Project Context

> **Brand rename:** the app is now branded **Typical** (was "NoLook"). All
> user-facing strings say Typical. *Internal* identifiers deliberately keep the
> `nolook` prefix to avoid breaking data/CSS — IndexedDB/zustand-persist keys
> (`nolook:results`, `nolook:pbs`, `nolook:streak`, `nolook:gaze`,
> `nolook:settings`), the `package.json` name, and CSS filter ids
> (`nolook-gooey`, `nolook-probe`, `nolook-theme-reveal`). Change those only
> with a data/asset migration.


> Auto-maintained. This file is updated after meaningful changes to the
> project so a fresh session (human or agent) can get oriented without
> re-reading the whole tree. See "Keeping this file current" at the bottom.

## What this is

**NoLook** (`package.json` name: `nolook`) is a MonkeyType-class touch-typing
trainer. Its differentiator: **webcam gaze-integrity detection** — an
on-device heuristic that flags whether you looked down at the keyboard
during a test, without doing real eye-tracking and without any video
leaving the browser. The whole UI follows an "Apple liquid-glass" aesthetic:
translucent frosted surfaces, drifting ambient color glows, spring-driven
motion throughout.

The app runs fully in **guest mode with no backend** (results in IndexedDB
via `idb-keyval`). Configuring `DATABASE_URL` upgrades it: accounts
(email/password + GitHub OAuth via Auth.js v5), synced history, personal
bests, and a global leaderboard. Every API route degrades to `503
{ offline: true }` when the DB isn't configured — never crashes.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind v4 (`@tailwindcss/postcss`), custom CSS tokens in
  `src/app/globals.css` (no raw Tailwind palette colors — themed tokens only)
- `framer-motion` for all animation, `zustand` for client state
  (`persist` middleware for settings/gaze consent)
- `@mediapipe/tasks-vision` `FaceLandmarker` running in a Web Worker for gaze
- Prisma 6 + PostgreSQL (optional), Auth.js v5 beta + `@auth/prisma-adapter`
- `zod` for all input validation, `bcryptjs` for password hashing
- `@number-flow/react` for animated numbers, `lucide-react` icons
- Deliberately **no chart library** — WPM/trend charts are hand-rolled SVG

⚠️ **This is a customized Next.js, not stock** — `AGENTS.md` at the repo root
warns that APIs/conventions may differ from training data; read
`node_modules/next/dist/docs/` before writing Next.js-specific code.

## Repo shape

```
prisma/schema.prisma        Auth.js models + TestResult + PersonalBest
src/app/                    routes: /, /leaderboard, /login, /settings, /stats
                             + api/{auth,register,results,results/claim,
                             leaderboard,settings}
src/components/
  app/          TestExperience (orchestrator), NavBar, SettingsView
  account/      AuthPanel, ClaimGate, ClaimHistoryBanner
  gaze/         ConsentModal, CalibrationOverlay, CameraDock, GazeStatusPill
  glass/        design-system primitives (see below)
  test/         WordStream, Caret, ConfigBar, LiveStats, FocusOverlay, ...
  results/      ResultsScreen, WpmChart, IntegrityBadge, PBCelebration, shareCard
  stats/        StatsDashboard + tiles/heatmap/trend components
  leaderboard/  LeaderboardView
src/lib/
  text/         words.ts, quotes.ts, generator.ts — deterministic text gen
  engine/       rng.ts, stats.ts, engine.ts — pure TS typing engine, no DOM
  gaze/         worker.ts, controller.ts, heuristics.ts, store.ts
  storage/      local.ts (idb-keyval), aggregate.ts (pure stat rollups)
  server/       db.ts, auth.ts, validate.ts (anti-cheat)
  store/        settings.ts (persisted), ui.ts (ephemeral: testRunning)
  types.ts      single source of truth for all shared shapes
  utils.ts      cn(), uid(), clamp()
```

Everything named in `CONTRACTS.md` is present in the tree — the module spec
looks fully implemented, not scaffolded.

## Core data flow

`src/components/app/TestExperience.tsx` is the orchestrator/state machine
for the whole test lifecycle (`page.tsx` just renders it). It:

1. Builds a `TypingEngine` (`src/lib/engine/engine.ts`) from a `TestConfig` +
   RNG seed, using words from `generateWords()` (or a custom passage built
   from `?practice=` query params / missed-words practice).
2. Captures **all keyboard input globally** (`window.addEventListener`, not a
   focused `<input>`) and feeds it to `engine.input()`.
3. Mirrors gaze events from the singleton `GazeController`
   (`src/lib/gaze/store.ts`) — pauses the engine on sustained "looking down"
   if `pauseOnPeek` is enabled, shows `FocusOverlay` on tab blur or peek.
4. On finish: ends the gaze session → builds a `SavedResult`, updates the
   personal best and streak in IndexedDB (`src/lib/storage/local.ts`),
   switches to the results phase, and — only if signed in — best-effort
   POSTs the run + a coarse keystroke-interval fingerprint to
   `/api/results` for server-side anti-cheat validation and leaderboard
   eligibility.

Guest results stay local and unsynced until sign-in; `ClaimGate` +
`ClaimHistoryBanner` then offer to bulk-import them via
`/api/results/claim` (claimed runs are stored for history but are **never**
leaderboard-eligible — only live-submitted runs with a timing fingerprint
can rank).

## Data model

Client-side canonical shapes live in `src/lib/types.ts` (import from
`@/lib/types`, never redeclare): `TestConfig`, `EngineSnapshot`/`EngineResult`,
`GazeFrameResult`/`CalibrationData`/`IntegrityReport`, `SavedResult`,
`PersonalBest`, `StreakInfo`, `AppSettings`, `LeaderboardEntry`.

`prisma/schema.prisma` mirrors the server-relevant subset: Auth.js standard
models (`User`/`Account`/`Session`/`VerificationToken`, plus `passwordHash`,
`displayName`, `settings Json?` on `User`) + domain models `TestResult`
(indexed on `(configKey, wpmCorrect desc)` for leaderboard queries, and
`(leaderboardEligible, configKey, createdAt)`) and `PersonalBest` (unique on
`(userId, configKey)`).

## Anti-cheat / integrity

Two independent layers:

- **Gaze integrity** (client, honesty-first heuristic — head pose + eye
  blendshapes via MediaPipe, *not* precise gaze): `src/lib/gaze/heuristics.ts`
  computes a direction-normalized "looking down" score from calibrated
  pitch/eyeLookDown baselines; `GazeController` debounces it (400ms to enter
  "down", 300ms hysteresis to exit, 600ms to declare tracking "lost") into
  peek events. Produces `IntegrityStatus`: `clean` / `assisted` / `untracked`.
- **Server-side plausibility** (`src/lib/server/validate.ts`): rejects
  physically implausible submissions (wpm > 250, accuracy/duration/timeline
  inconsistencies, near-zero-variance keystroke timing = bot fingerprint),
  rate-limits submissions (≥6s apart per user/ip).

## Design system conventions (binding — see `CONTRACTS.md`)

- Colors: **token utilities only** (`bg-background`, `text-foreground`,
  `bg-glass`, `text-primary`, `text-danger`, etc., defined in
  `globals.css`) — never raw Tailwind palette classes; this is what makes
  the 4 themes (`midnight`/`dawn`/`aurora`/`sunset`, via `next-themes`) work.
- Glass surfaces: `.glass`, `.glass-strong`, `.glass-subtle`,
  `.glass-interactive` CSS classes; `GlassSurface.tsx` (SVG displacement-filter
  "liquid glass", Chromium-only with a `.glass-strong` fallback) is the hero
  surface reserved for results card + nav.
- Motion: `framer-motion` springs — default `{stiffness:380, damping:32,
  mass:0.7}` for UI moves, `{stiffness:180, damping:26}` for large surfaces.
  Always respect `useReducedMotion()`.
- Theme switch uses the View Transitions API (polygon reveal from
  top-left, no blur) — `src/components/glass/theme-transition.ts`.
- No chart library: `WpmChart.tsx` / `ProgressChart.tsx` / `TrendChart.tsx`
  hand-roll responsive SVG with the same conventions (2px primary line, 10%
  area wash, hairline grid, glass tooltip, animated `pathLength` draw).

## Hard "do not" rules from CONTRACTS.md worth knowing before editing

- Do not add new dependencies beyond the list already in `package.json`.
- Do not modify `package.json`, `globals.css`, `layout.tsx`, `lib/types.ts`,
  `lib/utils.ts`, or `next.config.ts` casually — these are shared contracts
  other modules depend on verbatim.
- Prefer `npx tsc --noEmit` over `npm run build`/`npm run dev` when
  sanity-checking types in isolation.

## Environment

`.env.example`: `DATABASE_URL` (Postgres; omit for guest-only mode),
`AUTH_SECRET` (Auth.js JWT signing — `openssl rand -base64 32`),
`GITHUB_ID`/`GITHUB_SECRET` (optional OAuth — GitHub button hides if unset).

## Repo/tooling notes

- This directory is **not its own git repository** — it sits inside
  `/Users/slender/Developer/Codes`, which *is* a git repo, but `Typical/`
  currently shows as entirely untracked (`?? ./`). No commit history to
  mine for context yet.
- The `code-review-graph` MCP graph could not be built against this
  directory (`build_or_update_graph_tool` requires a `.git` or
  `.code-review-graph` at `repo_root`, and this isn't a repo root). If this
  project gets its own `git init`, rebuild the graph — it gives much cheaper
  structural queries (callers/impact-radius/tests-for) than re-reading files.

## Recent fixes (2026-07-10)

- **Live clock no longer freezes when typing pauses.** `TypingEngine.emit()`
  used to build the snapshot from `elapsed(lastEventTs)`, freezing the
  displayed countdown/live-WPM at the last keystroke. It now uses wall-clock
  `elapsed()` while `running` (the 250ms interval drives per-second emits) and
  a new `frozenElapsed` field while paused/finished (pause instant, or the
  honest final duration at finish). Verified end-to-end: countdown/countup
  advance while idle, auto-finish fires at the exact duration, pause freezes,
  resume continues, paused time stays excluded.
- **Gaze feature revived.** `useGazeStore.detectSupport()` was never called, so
  `supported` was permanently `false` and the entire camera UI was gated out.
  `TestExperience` now calls it in a mount effect — the headline USP works.
- **Theme switch sweep.** `theme-transition.ts` now wraps the `setTheme` apply
  in `flushSync` so the View Transition captures the *new* theme as its end
  state (previously it animated the old theme over itself, then snapped). The
  file is now `"use client"` (it pulls in `react-dom`'s `flushSync`, and the
  glass barrel is imported by the server-side layout). Sweep duration slowed
  0.7s → 1.15s.
- **Toggle switches** in `SettingsView` now center the knob via flexbox
  (`flex items-center` + `px-0.5`) instead of hand-tuned absolute offsets that
  sat 1px low and travelled asymmetrically.

## Recent fixes — round 2 (2026-07-10)

- **Rebrand NoLook → Typical** across all user-facing strings (nav wordmark,
  `<title>`/metadata, share-card wordmark + PNG filename, calibration copy,
  history export filename). Internal keys/ids kept (see the note at the top).
- **Caret now tracks the current word.** In `WordStream`, char x was measured
  as `wordEl.offsetLeft + charEl.offsetLeft`, but the word span wasn't
  positioned, so the char's `offsetLeft` was already relative to the *inner
  container* — the word's x got double-counted and the caret drifted a word
  ahead. Fixed by making the word span `relative` (so char `offsetLeft` is
  measured relative to the word).
- **Word display has a subtle 3D perspective** (Skiper28-inspired): the
  words+caret container tilts `rotateX(10deg)` under a parent `perspective`,
  with a top/bottom mask. Adapted from the pasted scroll-driven component,
  which was dropped — a 300vh Lenis scroll-hijack is incompatible with an
  interactive typing surface. Caret stays aligned because it shares the
  transformed container (offsets are measured in flat layout space).
- **Theme dropdown** (`ThemeToggle`) given an opaque elevated surface —
  translucent `.glass-strong` let the nav/config bar bleed through and made
  the theme names unreadable.
- **KeyHeatmap** rebuilt: bigger caps, a real hover "pop" (cap lifts + rings,
  letter scales/brightens), and stats moved to a header readout chip so the
  tooltip no longer overlaps the row above it.
- **Infinite words in time mode verified working** (engine refill: appended
  80→200 words while typing, 40-word buffer, zero swallowed keystrokes). The
  earlier "feels broken" was the caret + clock bugs, now fixed.

## Recent fixes — round 3 (2026-07-10)

- **Word display fills the page & tilts in 3D.** `WordStream` now shows 6 lines
  (was 3) at `max-w-5xl`, and the plane sits in a **fixed** tilted window
  (`rotateX(-22deg)`, hinged `center top`, under an `800px` parent perspective)
  so lines recede downward into depth. The tilt is on the *non-scrolling*
  window, not the scrolling inner layer — otherwise a line's depth would grow
  the further you type and the current word would shrink into the distance. The
  caret shares the scrolling layer and stays aligned (offsets are flat-layout).
- **Mask is bottom-only** now — top stays crisp, the receding bottom rows fade
  (`linear-gradient(to bottom, #000 0%, #000 58%, transparent)`).
- **Theme dropdown** rebuilt as a clean solid menu — dropped the `.glass-strong`
  frosted backdrop (it read as a big liquid-glass blob) for an opaque surface +
  hairline border + contained shadow.
- **Hydration mismatch fixed.** `TestExperience` seeded `config` from the
  zustand-*persisted* store during render, so the SSR'd `ConfigBar` (default
  30s) disagreed with the client's persisted value → React hydration error on
  the `GlassPill` radios. Now it initializes from `DEFAULT_CONFIG` (matches the
  server) and applies the persisted default in the mount effect.

## Keeping this file current

After any nontrivial change to this project (new module, changed contract,
new route, schema change, architectural shift), update the relevant section
above rather than leaving it stale. Small in-place edits within an existing
module generally don't need an update; new files, new conventions, or
changes to the data model / anti-cheat rules / design tokens do.

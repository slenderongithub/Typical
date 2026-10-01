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
  When the camera is on, a run also earns a **verified score**
  (`src/lib/gaze/score.ts`, pure): the raw WPM docked a penalty per keyboard
  glance + per second looking down/lost (capped at 75%). Raw WPM is never
  altered — the verified score is a separate, camera-only metric shown in
  results. **Master difficulty additionally fails on any look-away** (the first
  sustained peek ends the run) — enforced in `TestExperience`'s gaze handler,
  not the pure engine (which only knows typos).
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

## Deployment

The app is deployment-ready and **builds with zero env vars** (guest mode) —
`next build` never needs a DB. See `README.md` for the full guide. Key points:

- `package.json` has `postinstall: prisma generate` so fresh CI/Vercel installs
  generate the client (it isn't committed). Plus `db:migrate`
  (`prisma migrate deploy`), `db:push`, `db:studio`, `db:generate`.
- **Migrations:** `prisma/migrations/0_init/` is the baseline (generated via
  `prisma migrate diff --from-empty`, applied with `npm run db:migrate`). Evolve
  the schema with `prisma migrate dev --name <x>` against a dev DB.
- **Accounts flow is complete end to end:** create-account / sign-in (email+
  password + optional GitHub) in `AuthPanel` → `/api/register` + `signIn`;
  sign-out + account display in `SettingsView`; guest history bulk-claim via
  `ClaimGate` → `/api/results/claim`.
- `auth.ts` logs a loud (non-fatal) warning if a **production** build has
  accounts wired (DB or GitHub) but no `AUTH_SECRET` — sessions would be
  forgeable. Guest-only deploys still boot with no secret.
- MediaPipe WASM + face model are vendored in `public/` (present, ~15MB) — the
  gaze USP has no third-party runtime dependency. Camera needs HTTPS/localhost.
- **Register throttle:** `/api/register` is rate-limited (≤5 per IP per 15 min,
  `checkRegisterRateLimit` in `validate.ts`) — same in-memory/per-instance
  caveat as the results rate limit (fine for launch; swap to Redis for hard
  global limits).
- **ESLint ignores `public/`** (eslint.config.mjs) so `npm run lint` isn't
  drowned by the vendored MediaPipe WASM glue. `src` lints clean.
- **Intentional unused primitives:** `GlassSurface` + `GooeyFilter` are exported
  but not currently rendered (reserved per CONTRACTS.md). Left in place — they
  tree-shake out of the bundle, so there's no cost, and removing them would
  diverge from the spec.

## Repo/tooling notes

- This directory **is now its own git repository** (`main`, initial commit
  `ff15d85`) — deployable as a standalone Vercel/Node project.
- The `code-review-graph` MCP graph can now be built here (it's a repo root).
  Rebuild it for cheaper structural queries than re-reading files.

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

## Recent fixes — round 4 (2026-07-10)

- **Word tilt reversed to match the reference component.** The plane now tilts
  the *other* way — `rotateX(22deg)` (was `-22deg`), hinged on the caret row
  (`transformOrigin: center 42%`, derived from a new `CARET_ROW = 2` constant)
  instead of `center top`. So the rows of already-typed text *above* the caret
  lean back and recede into depth, while the upcoming rows below stay forward —
  the "receding hallway toward the top" look of the pasted Skiper28 reference.
  The active caret line sits *on* the hinge, so it stays crisp. The caret is
  now scrolled to visible row 2 (was row 1) so there are 2 receding rows above
  and 3 forward rows below.
- **Mask flipped to top-only** to fade the newly-receding upper rows:
  `linear-gradient(to bottom, transparent 0%, #000 33%, #000 100%)` (was
  bottom-only). Bottom/upcoming rows stay fully crisp.
- **Typing text is justified.** `.typing-words` inner layer now uses
  `text-align: justify` + `text-align-last: center`. Each full line stretches to
  both edges (no more ragged right); the last/partial line (and single-line
  content like short quotes, custom passages, the zen prompt) is centred, so the
  block sits centred under the nav in **every** mode instead of hugging the left
  in quote/zen/custom. To give justify whitespace to stretch, words are now
  separated by a real space text node (`<Fragment>…{" "}`) rather than the old
  `mr-[0.6em]` margin. Caret math is unchanged and still correct — the word span
  stays `relative`, so char `offsetLeft` is measured relative to the word, and
  `wordEl.offsetLeft` reflects the justified/centred position live.
- **KeyHeatmap: no more corner-cutting on hover, plus centred & bigger.** The
  keys sat in an `overflow-x-auto` container, and `overflow-x: auto` forces
  `overflow-y` to compute to `auto` too — so the hover "pop" (lift + scale +
  ring) on the top row and the left/right edge keys (Q, P) was clipped. Fixed
  with generous padding inside the scroll container (`px-4 pt-8 pb-6`) so the pop
  has room. The rows are now wrapped in an `mx-auto w-max` block that centres the
  keyboard when it fits and falls back to left-aligned horizontal scroll when it
  doesn't. Keys enlarged `size-11/12 → size-12/14`, letters `text-base →
  text-lg`, and `KEY_REM` (stagger scale) `3 → 3.5` to match.

## Recent fixes — round 5 (2026-07-10)

- **Word display blur moved to the bottom.** Round 4 flipped the tilt and (as a
  side-effect) the fade mask to the top; the intended look is the *bottom*
  (furthest-ahead) rows fading. Mask is back to bottom-only
  (`linear-gradient(to bottom, #000 0%, #000 60%, transparent)`), tilt unchanged.
- **Gaze scoring — looking away now costs points.** New pure module
  `src/lib/gaze/score.ts` computes an integrity penalty (per peek + per second
  looking down/lost, capped 75%) and a **verified score** (`verifiedWpm`). The
  results screen shows it as a distinct block whenever the camera was on —
  raw WPM stays factual, the verified score is the honesty-adjusted number.
  (Note: PB/leaderboard still rank by raw WPM; wiring the verified score into
  ranking would be a server/schema change and was left out for now.)
- **Master fails on looking away.** In `TestExperience`, a `peek-start` while
  `difficulty === "master"` now calls `engine.finish("failed")` (a
  `failCauseRef` distinguishes it so the notice reads "master allows no looking
  away from the screen" vs the typo message). Only active with the camera on +
  calibrated; peeks require a sustained 400ms look-down, so quick glances don't
  false-fail. The pure engine is unchanged — it still only fails on typos.
- **Theme dropdown now takes on the active theme's hue.** Its background was
  `color-mix(background 94%, foreground 6%)` — faithful per theme but near-black
  in every dark theme, so the hue was imperceptible and read faintly warm/red by
  contrast against the cool ambient glow. Now
  `color-mix(in srgb, var(--background) 84%, var(--primary) 16%)` — visibly blue
  in midnight, green in aurora, warm in sunset, light-blue in dawn.

## Recent fixes — round 6 (2026-07-10)

- **`.glass*` classes silently break positioning utilities — root-caused.**
  `globals.css` sets `position: relative` on `.glass` / `.glass-strong` /
  `.glass-subtle` as *unlayered* CSS, so it **overrides Tailwind's `absolute`
  utility** (utilities live in a layer; unlayered CSS wins). Any element with
  both a `.glass*` class and `absolute` is actually `position: relative`. This
  caused two reported bugs:
  - **Chart tooltip overlapping the action buttons.** The `WpmChart` (and
    identical `TrendChart`) hover tooltip has `glass-strong … absolute`; being
    relative, it rendered in-flow *below* the plot and collided with the
    results buttons. Fixed by forcing `position: "absolute"` inline (inline
    beats the unlayered class without touching the globals.css contract).
  - **IntegrityBadge (i) tooltip flicker + bleed-through.** Same cause: relative
    → the tooltip became an in-flow flex item in the badge row, so showing it
    grew the row, shifted the trigger out from under the cursor, and the
    mouseleave→hide→re-enter loop flickered. Fixed with inline
    `position: "absolute"` + `pointer-events-none`; centering moved from the
    (framer-overridden) `-translate-x-1/2` class into framer's `x: "-50%"`.
    Then, because the tooltip sits over the stat grid, its frosted
    `.glass-strong` let the tiles bleed through into a double-exposure — so it
    was switched to an **opaque** elevated surface (`color-mix(in srgb,
    --background 90%, --foreground 10%)` + border + shadow, `z-30`), same
    legibility exception already made for the theme dropdown.
  - **`ConfigBar` custom-value popover** (the "set custom" duration/word-count
    dropdown) had the same bug — relative → it rendered in-flow, taking layout
    space and wrecking the config-bar row (mode label floated up, difficulty row
    shoved down). Fixed the same way: absolute + opaque surface + framer `x`
    centering.
  - **`WordStream` "click to focus" button** likewise pinned absolute inline
    (keeps `.glass` — it's meant to float over the dimmed text) with framer
    `x/y: "-50%"` centering.
  - **Rule of thumb: never put a `.glass*` class on an element you also position
    with `absolute`/`fixed`/`sticky` — put the glass on an inner child, or force
    `position` inline. And when framer animates any transform prop (`y`/`scale`)
    it owns `transform`, so Tailwind `-translate-*` centering is ignored — use
    framer's `x`/`y` instead.** All five known instances are now fixed
    (WpmChart, TrendChart, IntegrityBadge, ConfigBar, WordStream).

## Recent fixes — round 7 (2026-09-25): UI overhaul + claim-banner bug

- **"Claim your runs" nagged signed-in users — root-caused.** Runs finished
  while signed in were POSTed to `/api/results` but never marked `synced`
  locally, so `ClaimGate` offered every one of them as a "guest run". Worse,
  `handleFinish` read `sessionStatus` from a closure captured when the engine
  was built (usually while the session was still `"loading"`), so the first run
  after every page load was never uploaded at all. Fixes: `sessionStatusRef` in
  `TestExperience`; `markSynced([id])` on a 2xx; one retry after 6.5s on a 429
  (the per-user submit throttle trips on back-to-back short tests).
  `saveResult`/`markSynced` now use idb-keyval's atomic `update()` so a
  background mark can't clobber a concurrent save.
- **`/api/results/claim` is idempotent + tolerant.** It skips runs the account
  already holds (same configKey, wpm ±0.01, durationMs ±1, createdAt within 2
  min), so claiming never duplicates live-submitted runs. It also validates
  per record, so one bad record no longer 400s the whole batch. Every handled
  id comes back in `claimed`. `ClaimGate` batches past 200, hides on 503 (no
  DB), shows errors, and has a per-tab "not now" (`sessionStorage`
  `typical:claim-dismissed`).
- **`.glass*` classes moved into `@layer components`** in globals.css, so
  Tailwind utilities (`absolute`, `bg-*`, `border-*`) now override them. This
  is the real root fix for the round-6 gotcha. The inline `position:absolute`
  hacks are now redundant but harmless; the danger button's red fill finally
  applies.
- **New shared classes/tokens:** `.popover` (opaque elevated surface, backed by
  the new `--popover` token and `bg-popover`) for every menu/tooltip/modal.
  Also `.btn-primary` (the one filled accent), `.kbd` (key caps), `.eyebrow`
  (section labels), `--grid-dot` (faint dot grid in `BackgroundGlow`).
  `buttonClasses()` is exported from GlassButton so a `<Link>` can look like a
  button without nesting a `<button>` in an `<a>` (it's a client module, so
  don't call it from server components). Icon-only GlassButtons are now square.
  `GlassPill` gained `variant="flat"` and `fullWidth`.
- **Palettes redone** for all 4 themes: midnight = ink-indigo `#8b9cff`, dawn =
  indigo `#4f5ce6` with dark hairline borders, aurora = mint `#4fe0ad`, sunset =
  coral `#ff9468`. Swatches live in `THEMES` (exported from ThemeToggle, reused
  by SettingsView).
- **Bugs fixed along the way:**
  - Picking "custom" mode never opened the text modal. The whole test block was
    keyed on seed+config, so the ConfigBar remounted and lost its state; now
    only the word stage re-keys. Custom with no text asks for the text first.
  - The custom-text modal was rendered inside the glass config bar;
    `backdrop-filter` makes that bar the containing block for `fixed` children.
  - "Revoke camera consent" never stopped the webcam stream.
  - The global `:focus-visible` rule reset `border-radius` to 6px, which
    re-shaped pills on focus.
  - Leaderboard fetches weren't aborted on filter change (stale responses
    could win).
  - The default create-next-app `favicon.ico` shadowed the brand icon
    (removed; `icon.svg` redrawn as the caret logo).
  - The nav overflowed on phones (links collapse to icons below `sm`).
- **Layout:** shared `PageHeader` (title + description) on stats, leaderboard
  and settings. The home page centres the typing stage vertically, with the
  camera controls as one quiet row under the config bar. Word tilt eased to
  `rotateX(12deg)` / `perspective: 1600px`, because the old 22deg/800px keystone
  made the edge glyphs look italic.
- Known gaps (not bugs introduced here): `/api/settings` has no client caller,
  so settings don't sync to accounts. The stats page reads only local
  IndexedDB, so a signed-in user on a new device sees no server history.

## Recent fixes — round 8 (2026-10-01): themes, tabs, logo, toasts

- **Themes rebuilt for contrast** (globals.css): backgrounds lifted off black (midnight `#10132a`, aurora `#0a1e1c`, sunset `#22120e`), near-white foregrounds, much more legible `--char-pending`, stronger glass alpha/borders/shadows. `THEMES` swatches in ThemeToggle.tsx mirror these — keep in sync.
- **New shared classes**: `.glass-chip` (the active segment in ANY tab/pill group — tinted liquid-glass lens) and `.card-title` (the one bold panel heading). `PILL_SPRING` (GlassPill.tsx) is the shared spring for every sliding indicator.
- **Tabs bigger**: GlassPill sm = h-9/14px, md = h-11; nav links h-10/15px semibold.
- **Theme picker**: no dropdown. The palette button swaps the nav's link row for a centred row of theme swatches in place (`ThemeSwatches`); NavBar owns the open state.
- **Logo**: user-supplied PNG → `src/app/icon.png`, `apple-icon.png`, `public/logo.png` (`LogoMark` in NavBar, reused in AuthPanel). `icon.svg` removed.
- **Browser title** is always "Typical" (no per-page metadata titles).
- **Page subheaders removed**: `PageHeader` has no description; stats card subtitles and settings section blurbs removed.
- **Toasts**: `src/lib/store/toast.ts` (`toast(msg)`) + `Toaster` in layout (top-right). Camera start errors and expert/master fail notices use it; the inline error/notice rows under the test are gone.
- **Zen caret**: with no words yet, WordStream parks the caret at the centre of line 0 (where the first character lands); the hint text renders on the line below.
- **Test layout**: the typing stage is no longer `flex-1 justify-center` (that floated it low with a big gap under "verify with camera"). It now sits right under the controls. ConfigBar is `w-max` so it can be wider than the max-w-5xl column and stay on one row.
- **History/leaderboard jank**: `AutoHeight` (glass/) springs content height, so filter swaps don't snap the page or clamp scroll. History rows crossfade per filter. ConfigBar's mode sub-row uses `popLayout` (was `wait`, which resized the bar twice).
- **Live WPM** is floored to a 2s window. The first keystroke used to read ~6,000 wpm. This is display-only; results are unaffected.
- Streak icon is lucide `Rabbit`.

- **Branch `theme-choices` (same day, follow-up):** added four palette themes: `basil` (basil, potting soil, cherry tomato), `cannoli` (cannoli cream, amazon, raspberry; light), `pigeon` (pigeon, almond blossom, acid lime) and `poseidon` (poseidon, norse blue, pureed pumpkin). They're registered in Providers.tsx `themes` and in `THEMES`. The nav swatch row is dots-only now (8 themes).
  - **All hue effects removed:** no drifting glow blobs or cursor orb (`BackgroundGlow` is just the dot grid, `--glow-*` tokens are gone). `.glass-chip` is neutral glass with no primary tint. `btn-primary`, the caret, logo and streak have no coloured glows.
  - **ConfigBar is two stacked pills:** row 1 is mode | amount, row 2 is punctuation/numbers | difficulty. Row 2 isn't rendered in zen.
  - **Stage top offset** is `pt-[clamp(1.5rem,7vh,4.5rem)]`, so the text block sits near the vertical centre.
  - **Toast copy is short** ("camera access denied", "face tracking timed out", "failed: you looked away"). Raw worker errors go to the console, not the toast.

- **Palette islands (theme-choices, round 9):** every theme now defines `--surface`, `--surface-foreground` and `--surface-muted`. These are opaque island colours, e.g. basil-green islands on a potting-soil background, amazon on cream, almond on pigeon, norse blue on poseidon.
  - `.island` is the opaque surface with a deep drop shadow, used by the nav, the config rail and the camera button (`GlassButton variant="island"`).
  - `.glass-chip` is filled with `--primary`, so active items must use `text-primary-foreground`.
  - basil's primary is now cherry tomato.
  - The dot grid and `BackgroundGlow` were later removed entirely (round 10); backgrounds are flat.
- **ConfigBar is a fixed left rail:** a round collapse toggle, then island 1 (mode | amount), then island 2 (modifiers | difficulty; hidden in zen). Collapsed shows icons only, with labels animating to width 0.
  - The collapsed state lives in TestExperience and persists in localStorage `nolook:rail-collapsed`; it defaults to collapsed under 1280px.
  - The rail must render OUTSIDE the transformed phase `motion.div`, otherwise `fixed` re-anchors.
  - Round 10 change: ConfigBar reports its live right edge (ResizeObserver → `onRightEdge`). TestExperience writes it to `--rail-right` on the root via ref, with no re-render.
  - `.rail-aware` pads the column by `--rail-pad`, so the text block centres in the space right of the rail and glides with a padding-left transition.
  - `.rail-counter` translates the camera row back by half the pad so it stays centred under the nav.
  - The `short:` custom variant (max-height 860px) shrinks rail items.
  - The nav header strip is `pointer-events-none`; only the pill is live. The full-width strip used to swallow clicks on the top of the rail.
- **AutoHeight gotcha:** the outer box is sized to its child, so any padding must go on a child div, never on AutoHeight's `className`. This clipped the leaderboard.
- **Turbopack gotcha (again):** CSS edits can take 10–20s or more to be served. Verify with `curl` against the served chunk before trusting a screenshot.

- **Placeholder leaderboard data:** `node prisma/seed-placeholders.mjs` replaces 40 fake users (`@placeholder.typical` emails) with 480 time-mode runs spread across today, this week and older, plus clean and assisted. `--clean` removes them; deletes cascade, so real accounts are untouched. It was run against the Neon DB on 2026-10-01.

## Keeping this file current

After any nontrivial change to this project (new module, changed contract,
new route, schema change, architectural shift), update the relevant section
above rather than leaving it stale. Small in-place edits within an existing
module generally don't need an update; new files, new conventions, or
changes to the data model / anti-cheat rules / design tokens do.

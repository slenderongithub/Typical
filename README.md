# Typical

A MonkeyType-class touch-typing trainer with a differentiator: **on-device
webcam gaze-integrity detection** that flags whether you looked down at the
keyboard during a test — no video ever leaves your browser. Wrapped in an
Apple-style liquid-glass UI.

> The app is branded **Typical**. Internal identifiers (the `package.json`
> name, IndexedDB / persisted-store keys, CSS filter ids) deliberately keep the
> historical `nolook` prefix to avoid a data/asset migration.

## Two modes of operation

Typical runs in **two tiers**, and the boundary is a single environment
variable:

- **Guest mode (zero config).** With no `DATABASE_URL`, the app is fully
  functional: every test works, results and personal bests live in the
  browser's IndexedDB, and every API route returns `503 { offline: true }`
  instead of crashing. This is the default and it deploys with no setup.
- **Accounts mode (`DATABASE_URL` set).** Adds email/password + GitHub sign-in
  (Auth.js v5), server-synced history, personal bests, and a global
  leaderboard. Guest results can be bulk-claimed into an account after sign-in.

## Local development

```bash
npm install        # also runs `prisma generate` via postinstall
npm run dev        # http://localhost:3000  (guest mode, no DB needed)
```

That's it for guest mode. To develop the account features locally, set up the
database section below.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 ·
framer-motion · zustand · Prisma 6 + PostgreSQL · Auth.js v5 ·
`@mediapipe/tasks-vision` (FaceLandmarker in a Web Worker) · zod · bcryptjs.

MediaPipe WASM + the face-landmark model are vendored in `public/` (served
same-origin, long-cache-immutable via `next.config.ts`), so the gaze feature
has **no third-party runtime dependency**.

## Environment variables

Copy `.env.example` to `.env` and fill in what you need. All are optional —
omit them all and you get guest mode.

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | accounts, leaderboard, sync | PostgreSQL connection string. Its presence is what switches the app into accounts mode. |
| `AUTH_SECRET` | **any deploy with accounts** | JWT signing secret. Generate with `openssl rand -base64 32`. Without it, sessions are forgeable — the app logs a loud warning in production. |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub sign-in (optional) | From a GitHub OAuth app. The "continue with GitHub" button hides when unset. Callback URL: `https://<your-domain>/api/auth/callback/github`. |

## Database setup (accounts mode)

Point `DATABASE_URL` at any PostgreSQL instance (Neon, Supabase, RDS, local
Postgres, …), then apply the schema:

```bash
# Production: apply the versioned migrations
npm run db:migrate      # prisma migrate deploy

# — or, for a quick dev/prototype database:
npm run db:push         # prisma db push (no migration history)
```

Other helpers: `npm run db:studio` (browse data), `npm run db:generate`
(regenerate the Prisma client after a schema change).

The initial migration lives in `prisma/migrations/0_init/`. If you evolve
`prisma/schema.prisma`, create a new migration with
`npx prisma migrate dev --name <change>` against a dev database.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (framework preset:
   **Next.js**, no overrides needed — `prisma generate` runs on `postinstall`).
2. **Guest-only deploy:** set nothing. It builds and runs.
3. **Accounts deploy:** add the environment variables above (at minimum
   `DATABASE_URL` and `AUTH_SECRET`), then run `npm run db:migrate` once
   against the production database (locally with the prod `DATABASE_URL`, or as
   a one-off job) to create the tables.

The build has no required env vars — `next build` succeeds in guest mode, so a
missing `DATABASE_URL` never breaks CI.

## Deploying elsewhere

Any Node host works. Build and run the standard Next.js way:

```bash
npm install
npm run build
npm start          # serves on $PORT (default 3000)
```

Ensure the same environment variables are present at runtime, and that the
database migrations have been applied.

## Notes

- **Camera/gaze** requires a secure context (HTTPS or `localhost`) — browsers
  gate `getUserMedia` behind it. Vercel gives you HTTPS automatically.
- All gaze processing is client-side; the camera stream and every video frame
  stay in the browser. Only anonymized test results (and, when signed in, a
  coarse keystroke-timing fingerprint for anti-cheat) are sent to the server.
- Anti-cheat: submitted runs are re-validated server-side
  (`src/lib/server/validate.ts`) for physical plausibility and bot-like timing;
  only live-submitted, signed-in, non-zen runs are leaderboard-eligible.

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/server/auth";
import { dbAvailable, getDb } from "@/lib/server/db";
import {
  checkFingerprintReuse,
  checkRateLimit,
  fingerprintSignature,
  validateResultPlausibility,
} from "@/lib/server/validate";
import type { SubmitResultPayload } from "@/lib/types";

export const runtime = "nodejs";

const tickSchema = z.object({
  second: z.number(),
  wpm: z.number(),
  raw: z.number(),
  errors: z.number(),
});

const resultSchema = z.object({
  mode: z.enum(["time", "words", "quote", "zen", "custom"]),
  // stored verbatim as JSON — cap it so one request can't park megabytes
  config: z
    .record(z.string(), z.unknown())
    .refine((c) => JSON.stringify(c).length <= 20000),
  configKey: z.string().max(80),
  wpm: z.number(),
  rawWpm: z.number(),
  accuracy: z.number(),
  consistency: z.number(),
  chars: z.object({
    correct: z.number(),
    incorrect: z.number(),
    extra: z.number(),
    missed: z.number(),
  }),
  durationMs: z.number(),
  timeline: z.array(tickSchema).max(1000),
  integrity: z.enum(["clean", "assisted", "untracked"]),
  peekCount: z.number(),
  peekTotalMs: z.number(),
  trackingLostMs: z.number(),
  keyStats: z.record(
    z.string(),
    z.object({ hits: z.number(), misses: z.number() }),
  ),
  missedWords: z.array(z.string()).max(500),
  createdAt: z.number(),
});

const bodySchema = z.object({
  result: resultSchema,
  timingFingerprint: z.array(z.number()).max(500),
});

/** Submit a finished test. Guests are accepted but never leaderboard-eligible. */
export async function POST(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(userId ?? `ip:${ip}`)) {
      return NextResponse.json(
        { error: "slow down — one result every few seconds" },
        { status: 429 },
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "malformed result" }, { status: 400 });
    }
    const payload = parsed.data as unknown as SubmitResultPayload;
    const r = parsed.data.result;

    const plausible = validateResultPlausibility(payload);
    const freshTiming = checkFingerprintReuse(
      fingerprintSignature(parsed.data.timingFingerprint),
    );
    const eligible =
      plausible.ok && freshTiming && userId !== null && r.mode !== "zen";

    const db = getDb();
    const created = await db.testResult.create({
      data: {
        userId,
        mode: r.mode,
        config: r.config as object,
        configKey: r.configKey,
        wpmRaw: r.rawWpm,
        wpmCorrect: r.wpm,
        accuracy: r.accuracy,
        consistency: r.consistency,
        charStats: r.chars,
        durationMs: Math.round(r.durationMs),
        timeline: r.timeline,
        integrityStatus: r.integrity,
        peekCount: Math.round(r.peekCount),
        peekTotalMs: Math.round(r.peekTotalMs),
        trackingLostMs: Math.round(r.trackingLostMs),
        leaderboardEligible: eligible,
      },
    });

    if (userId && plausible.ok) {
      const existing = await db.personalBest.findUnique({
        where: { userId_configKey: { userId, configKey: r.configKey } },
      });
      if (!existing || r.wpm > existing.wpm) {
        await db.personalBest.upsert({
          where: { userId_configKey: { userId, configKey: r.configKey } },
          create: {
            userId,
            configKey: r.configKey,
            wpm: r.wpm,
            resultId: created.id,
          },
          update: { wpm: r.wpm, resultId: created.id, achievedAt: new Date() },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      id: created.id,
      leaderboardEligible: eligible,
      rejectedReason: plausible.ok ? undefined : plausible.reason,
    });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

/** Paginated own-history for signed-in users. */
export async function GET(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 20),
    );
    const db = getDb();
    const [items, total] = await Promise.all([
      db.testResult.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      db.testResult.count({ where: { userId: session.user.id } }),
    ]);
    return NextResponse.json({ items, total });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

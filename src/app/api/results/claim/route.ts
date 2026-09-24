import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/server/auth";
import { dbAvailable, getDb } from "@/lib/server/db";

export const runtime = "nodejs";

const claimResultSchema = z.object({
  id: z.string().max(64),
  mode: z.enum(["time", "words", "quote", "zen", "custom"]),
  config: z.record(z.string(), z.unknown()),
  configKey: z.string().max(80),
  wpm: z.number().min(0).max(400),
  rawWpm: z.number().min(0).max(600),
  accuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  chars: z.object({
    correct: z.number(),
    incorrect: z.number(),
    extra: z.number(),
    missed: z.number(),
  }),
  durationMs: z.number().min(0),
  timeline: z.array(z.unknown()).max(1000),
  integrity: z.enum(["clean", "assisted", "untracked"]),
  peekCount: z.number().min(0),
  peekTotalMs: z.number().min(0),
  trackingLostMs: z.number().min(0),
  createdAt: z.number(),
});

const bodySchema = z.object({
  results: z.array(z.unknown()).min(1).max(200),
});

/** A live-submitted copy of a run lands within seconds of its local timestamp. */
const DUPLICATE_WINDOW_MS = 2 * 60_000;

/**
 * Bulk-import guest history into the signed-in account. Claimed runs are
 * stored for personal history but never leaderboard-eligible — only runs
 * submitted live (with keystroke timing) can rank.
 *
 * Idempotent: runs the account already holds (e.g. submitted live, or claimed
 * from another tab) are skipped rather than duplicated, and malformed records
 * are dropped individually instead of failing the whole batch. Every id that
 * was handled either way is returned in `claimed` so the client can stop
 * offering it.
 */
export async function POST(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "malformed history" }, { status: 400 });
    }

    const handled: string[] = [];
    const valid: z.infer<typeof claimResultSchema>[] = [];
    for (const raw of parsed.data.results) {
      const r = claimResultSchema.safeParse(raw);
      if (r.success) valid.push(r.data);
      else if (
        raw &&
        typeof raw === "object" &&
        typeof (raw as { id?: unknown }).id === "string"
      ) {
        handled.push((raw as { id: string }).id); // unusable — stop offering it
      }
    }

    const userId = session.user.id;
    const db = getDb();

    let fresh = valid;
    if (valid.length > 0) {
      const times = valid.map((r) => r.createdAt);
      const existing = await db.testResult.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Math.min(...times) - DUPLICATE_WINDOW_MS),
            lte: new Date(Math.max(...times) + DUPLICATE_WINDOW_MS),
          },
        },
        select: { configKey: true, wpmCorrect: true, durationMs: true, createdAt: true },
      });
      fresh = valid.filter(
        (r) =>
          !existing.some(
            (e) =>
              e.configKey === r.configKey &&
              Math.abs(e.wpmCorrect - r.wpm) < 0.01 &&
              Math.abs(e.durationMs - Math.round(r.durationMs)) <= 1 &&
              Math.abs(e.createdAt.getTime() - r.createdAt) <= DUPLICATE_WINDOW_MS,
          ),
      );
    }

    if (fresh.length > 0) {
      await db.testResult.createMany({
        data: fresh.map((r) => ({
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
          timeline: r.timeline as object[],
          integrityStatus: r.integrity,
          peekCount: Math.round(r.peekCount),
          peekTotalMs: Math.round(r.peekTotalMs),
          trackingLostMs: Math.round(r.trackingLostMs),
          leaderboardEligible: false,
          createdAt: new Date(r.createdAt),
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      claimed: [...handled, ...valid.map((r) => r.id)],
      imported: fresh.length,
    });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

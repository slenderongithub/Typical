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
  results: z.array(claimResultSchema).min(1).max(200),
});

/**
 * Bulk-import guest history into the signed-in account. Claimed runs are
 * stored for personal history but never leaderboard-eligible — only runs
 * submitted live (with keystroke timing) can rank.
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
    const userId = session.user.id;
    const db = getDb();
    await db.testResult.createMany({
      data: parsed.data.results.map((r) => ({
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
    return NextResponse.json({
      ok: true,
      claimed: parsed.data.results.map((r) => r.id),
    });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

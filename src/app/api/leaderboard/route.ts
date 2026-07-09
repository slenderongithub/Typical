import { NextResponse } from "next/server";

import { dbAvailable, getDb } from "@/lib/server/db";
import type { LeaderboardEntry } from "@/lib/types";

export const runtime = "nodejs";

const WINDOWS: Record<string, number | null> = {
  all: null,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

/** Global leaderboard — best eligible run per user, clean-only by default. */
export async function GET(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const url = new URL(req.url);
    const configKey =
      url.searchParams.get("configKey") ?? "time-30-p0-n0-normal";
    const windowKey = url.searchParams.get("window") ?? "all";
    const integrity = url.searchParams.get("integrity") ?? "clean";

    const windowMs = WINDOWS[windowKey] ?? null;
    const db = getDb();

    const rows = await db.testResult.findMany({
      where: {
        leaderboardEligible: true,
        configKey,
        userId: { not: null },
        ...(integrity === "clean" ? { integrityStatus: "clean" } : {}),
        ...(windowMs
          ? { createdAt: { gte: new Date(Date.now() - windowMs) } }
          : {}),
      },
      orderBy: { wpmCorrect: "desc" },
      take: 200,
      include: { user: { select: { displayName: true, name: true } } },
    });

    // best row per user
    const seen = new Set<string>();
    const entries: LeaderboardEntry[] = [];
    for (const row of rows) {
      if (!row.userId || seen.has(row.userId)) continue;
      seen.add(row.userId);
      entries.push({
        rank: entries.length + 1,
        displayName: row.user?.displayName ?? row.user?.name ?? "anonymous",
        wpm: row.wpmCorrect,
        accuracy: row.accuracy,
        consistency: row.consistency,
        integrity: row.integrityStatus as LeaderboardEntry["integrity"],
        createdAt: row.createdAt.getTime(),
      });
      if (entries.length >= 50) break;
    }

    return NextResponse.json(
      { entries, offline: false },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

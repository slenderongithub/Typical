import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/server/auth";
import { dbAvailable, getDb } from "@/lib/server/db";
import { readJson } from "@/lib/server/guard";
import { displayNameSchema } from "@/lib/server/validate";

export const runtime = "nodejs";

/** Account-synced settings blob (theme, sound, default config). */
export async function GET() {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }
    const user = await getDb().user.findUnique({
      where: { id: session.user.id },
      select: { settings: true, displayName: true },
    });
    return NextResponse.json({
      settings: user?.settings ?? null,
      displayName: user?.displayName ?? null,
    });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

const putSchema = z.object({
  settings: z.record(z.string(), z.unknown()).optional(),
  displayName: displayNameSchema.optional(),
});

export async function PUT(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }
    const body = await readJson(req, 16_384);
    if (!body.ok) return body.res;
    const parsed = putSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid settings" }, { status: 400 });
    }
    await getDb().user.update({
      where: { id: session.user.id },
      data: {
        ...(parsed.data.settings !== undefined
          ? { settings: parsed.data.settings as object }
          : {}),
        ...(parsed.data.displayName !== undefined
          ? { displayName: parsed.data.displayName }
          : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

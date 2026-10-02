import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/server/auth";
import { dbAvailable, getDb } from "@/lib/server/db";

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
  settings: z
    .record(z.string(), z.unknown())
    .refine((s) => JSON.stringify(s).length <= 20000)
    .optional(),
  displayName: z.string().trim().min(2).max(40).optional(),
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
    const parsed = putSchema.safeParse(await req.json());
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

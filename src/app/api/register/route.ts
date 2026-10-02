import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { dbAvailable, getDb } from "@/lib/server/db";
import { clientIp, readJson, securityLog } from "@/lib/server/guard";
import {
  checkRegisterRateLimit,
  displayNameSchema,
} from "@/lib/server/validate";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  displayName: displayNameSchema,
});

export async function POST(req: Request) {
  if (!dbAvailable()) {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  const ip = clientIp(req);
  if (!checkRegisterRateLimit(`register:${ip}`)) {
    securityLog("register.rate_limited", { ip });
    return NextResponse.json(
      { error: "too many attempts — please wait a few minutes" },
      { status: 429 },
    );
  }
  try {
    const body = await readJson(req, 4_096);
    if (!body.ok) return body.res;
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid registration details" },
        { status: 400 },
      );
    }
    const { email, password, displayName } = parsed.data;
    const db = getDb();
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "an account with this email already exists" },
        { status: 409 },
      );
    }
    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName,
        name: displayName,
      },
    });
    securityLog("register.created", { userId: user.id, ip });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ offline: true }, { status: 503 });
  }
}

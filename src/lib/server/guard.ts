import { NextResponse } from "next/server";

/**
 * Request hygiene shared by every mutating API route: same-origin check
 * (CSRF), a hard body-size cap, the client IP for rate limits, and a
 * structured security-event log line.
 */

/**
 * Client IP for rate-limit keys. Prefers the platform-set `x-real-ip`; the
 * *last* `x-forwarded-for` hop is the one our proxy appended — the first is
 * whatever the client claimed, so keying on it lets anyone dodge limits.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = req.headers.get("x-forwarded-for")?.split(",");
  return hops?.[hops.length - 1]?.trim() || "unknown";
}

/** One JSON line per security event — grep/ship `"security":true`. */
export function securityLog(
  event: string,
  details: Record<string, unknown> = {},
): void {
  console.warn(
    JSON.stringify({
      security: true,
      event,
      at: new Date().toISOString(),
      ...details,
    }),
  );
}

type JsonBody = { ok: true; data: unknown } | { ok: false; res: NextResponse };

/**
 * Reads a JSON body for a state-changing request. Rejects cross-site callers
 * (browsers always send `Origin` on POST/PUT; a mismatch means another site is
 * riding the user's session cookie) and bodies over `maxBytes`, streaming so
 * an oversized chunked upload is cut off instead of buffered whole.
 */
export async function readJson(
  req: Request,
  maxBytes: number,
): Promise<JsonBody> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== host) {
      securityLog("csrf.origin_mismatch", {
        origin,
        host,
        path: new URL(req.url).pathname,
      });
      return {
        ok: false,
        res: NextResponse.json(
          { error: "cross-site request blocked" },
          { status: 403 },
        ),
      };
    }
  }

  const tooLarge = () => ({
    ok: false as const,
    res: NextResponse.json({ error: "request too large" }, { status: 413 }),
  });
  if (Number(req.headers.get("content-length")) > maxBytes) return tooLarge();

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  try {
    const text = Buffer.concat(chunks).toString("utf8");
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "malformed json" }, { status: 400 }),
    };
  }
}

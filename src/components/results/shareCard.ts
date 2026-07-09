/**
 * Client-side PNG share card — hand-drawn on canvas so it matches the live
 * theme (token colors are read from the document at render time).
 */

import type { SavedResult } from "@/lib/types";

const W = 1200;
const H = 630;

function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function modeLine(result: SavedResult): string {
  const c = result.config;
  const base =
    c.mode === "time"
      ? `time ${c.duration}s`
      : c.mode === "words"
        ? `${c.wordCount} words`
        : c.mode === "quote"
          ? `quote · ${c.quoteLength}`
          : c.mode;
  const extras = [
    c.punctuation ? "punctuation" : null,
    c.numbers ? "numbers" : null,
    c.difficulty !== "normal" ? c.difficulty : null,
  ].filter(Boolean);
  return extras.length > 0 ? `${base} · ${extras.join(" · ")}` : base;
}

/** Render the 1200×630 result card and return it as a PNG blob. */
export async function renderShareCard(result: SavedResult): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  const bg = token("--background", "#07090f");
  const fg = token("--foreground", "#eef1f7");
  const muted = token("--muted-foreground", "#8b93a7");
  const primary = token("--primary", "#6ea8ff");
  const success = token("--success", "#30d158");
  const warning = token("--warning", "#ffd60a");
  const border = token("--glass-border", "rgba(255,255,255,0.1)");
  const glow1 = token("--glow-1", "#1d3a8a");
  const glow2 = token("--glow-2", "#4c1d95");

  const sans =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';

  // backdrop + ambient glows
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 150, 90, 500, glow1, 0.5);
  glow(ctx, 1080, 560, 520, glow2, 0.45);

  // frosted card
  const cx = 90;
  const cy = 80;
  const cw = W - 180;
  const ch = H - 160;
  ctx.save();
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // top inner highlight
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(cx, cy, cw, 1.5);
  ctx.restore();

  // wordmark
  ctx.fillStyle = primary;
  ctx.font = `600 30px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Typical", cx + 48, cy + 68);
  const markWidth = ctx.measureText("Typical").width;
  ctx.fillStyle = muted;
  ctx.font = `400 20px ${sans}`;
  ctx.fillText("typing, verified", cx + 48 + markWidth + 14, cy + 68);

  // hero wpm
  const wpm = Math.round(result.wpm);
  ctx.fillStyle = fg;
  ctx.font = `650 170px ${sans}`;
  ctx.fillText(String(wpm), cx + 44, cy + 268);
  const wpmWidth = ctx.measureText(String(wpm)).width;
  ctx.fillStyle = muted;
  ctx.font = `500 40px ${sans}`;
  ctx.fillText("wpm", cx + 44 + wpmWidth + 22, cy + 268);

  // secondary stats line
  ctx.fillStyle = fg;
  ctx.font = `500 28px ${sans}`;
  const statLine = `accuracy ${Math.round(result.accuracy)}%   ·   consistency ${Math.round(
    result.consistency,
  )}%   ·   ${Math.round(result.durationMs / 1000)}s   ·   ${modeLine(result)}`;
  ctx.fillText(statLine, cx + 48, cy + 340);

  // integrity line
  const integrity =
    result.integrity === "clean"
      ? { color: success, text: "clean run — eyes never left the screen" }
      : result.integrity === "assisted"
        ? {
            color: warning,
            text: `assisted — ${result.peekCount} peek${result.peekCount === 1 ? "" : "s"} · ${(
              result.peekTotalMs / 1000
            ).toFixed(1)}s looking down`,
          }
        : { color: muted, text: "untracked — camera was off" };

  ctx.fillStyle = integrity.color;
  ctx.beginPath();
  ctx.arc(cx + 58, cy + 398, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(integrity.text, cx + 80, cy + 407);

  ctx.fillStyle = muted;
  ctx.font = `400 20px ${sans}`;
  ctx.fillText(
    new Date(result.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    cx + 48,
    cy + ch - 40,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("png encode failed"))),
      "image/png",
    );
  });
}

/** Render + trigger a download of the share card. */
export async function downloadShareCard(result: SavedResult): Promise<void> {
  const blob = await renderShareCard(result);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `typical-${Math.round(result.wpm)}wpm.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

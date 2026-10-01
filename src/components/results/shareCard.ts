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

/** Rounded pill with text; returns its width so pills can be laid out in a row. */
function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  opts: {
    fill: string;
    fillAlpha?: number;
    color: string;
    font: string;
    dot?: string;
  },
): number {
  ctx.font = opts.font;
  const padX = 22;
  const dotW = opts.dot ? 22 : 0;
  const w = ctx.measureText(text).width + padX * 2 + dotW;
  const h = 48;
  ctx.globalAlpha = opts.fillAlpha ?? 1;
  ctx.fillStyle = opts.fill;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (opts.dot) {
    ctx.fillStyle = opts.dot;
    ctx.beginPath();
    ctx.arc(x + padX + 6, y + h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX + dotW, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

/**
 * Render the 1200×630 result card in the app's island language: the theme's
 * flat background, one opaque surface island with a deep shadow, the accent
 * as a filled chip, and the run's wpm curve in an inset panel.
 */
export async function renderShareCard(result: SavedResult): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  const bg = token("--background", "#10132a");
  const surface = token("--surface", "#1f2550");
  const onSurface = token("--surface-foreground", "#f7f8ff");
  const surfaceMuted = token("--surface-muted", "#b3badf");
  const primary = token("--primary", "#9dabff");
  const onPrimary = token("--primary-foreground", "#0a0e2b");
  const success = token("--success", "#4ee39a");
  const warning = token("--warning", "#ffcf5c");
  // the page's own font (next/font gives it a hashed family name)
  const sans =
    getComputedStyle(document.body).fontFamily ||
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const logo = await loadImage("/logo.png");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // the island
  const ix = 56;
  const iy = 52;
  const iw = W - 112;
  const ih = H - 104;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = surface;
  roundRect(ctx, ix, iy, iw, ih, 44);
  ctx.fill();
  ctx.restore();

  // header: logo + wordmark, mode chip on the right
  const pad = 52;
  if (logo) ctx.drawImage(logo, ix + pad, iy + 44, 52, 52);
  ctx.fillStyle = onSurface;
  ctx.font = `800 34px ${sans}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Typical", ix + pad + (logo ? 66 : 0), iy + 71);
  ctx.textBaseline = "alphabetic";

  ctx.font = `700 22px ${sans}`;
  const mode = modeLine(result);
  const modeW = ctx.measureText(mode).width + 44;
  pill(ctx, ix + iw - pad - modeW, iy + 47, mode, {
    fill: primary,
    color: onPrimary,
    font: `700 22px ${sans}`,
  });

  // hero number
  ctx.fillStyle = surfaceMuted;
  ctx.font = `700 20px ${sans}`;
  ctx.fillText("WORDS PER MINUTE", ix + pad, iy + 168);
  ctx.fillStyle = onSurface;
  ctx.font = `800 210px ${sans}`;
  ctx.fillText(String(Math.round(result.wpm)), ix + pad - 8, iy + 352);

  // the run's curve in an inset panel
  const px = ix + iw * 0.47;
  const py = iy + 140;
  const pw = ix + iw - pad - px;
  const ph = 218;
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = onSurface;
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.fill();
  ctx.globalAlpha = 1;
  const tl = result.timeline;
  if (tl.length > 1) {
    const max = Math.max(...tl.map((t) => Math.max(t.wpm, t.raw)), 1) * 1.1;
    const at = (i: number, v: number): [number, number] => [
      px + 28 + (i / (tl.length - 1)) * (pw - 56),
      py + ph - 28 - (v / max) * (ph - 56),
    ];
    // raw, faint
    ctx.beginPath();
    tl.forEach((t, i) =>
      i ? ctx.lineTo(...at(i, t.raw)) : ctx.moveTo(...at(i, t.raw)),
    );
    ctx.strokeStyle = surfaceMuted;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
    // net wpm, accent
    ctx.beginPath();
    tl.forEach((t, i) =>
      i ? ctx.lineTo(...at(i, t.wpm)) : ctx.moveTo(...at(i, t.wpm)),
    );
    ctx.strokeStyle = primary;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // stat chips
  const chipFont = `700 22px ${sans}`;
  let cx = ix + pad;
  const cy = iy + ih - pad - 48;
  for (const text of [
    `${Math.round(result.accuracy)}% accuracy`,
    `${Math.round(result.consistency)}% consistency`,
    `${(result.durationMs / 1000).toFixed(result.durationMs < 60000 ? 1 : 0)}s`,
  ]) {
    cx +=
      pill(ctx, cx, cy, text, {
        fill: onSurface,
        fillAlpha: 0.1,
        color: onSurface,
        font: chipFont,
      }) + 12;
  }
  const integrity =
    result.integrity === "clean"
      ? { dot: success, text: "clean run" }
      : result.integrity === "assisted"
        ? {
            dot: warning,
            text: `assisted · ${result.peekCount} peek${result.peekCount === 1 ? "" : "s"}`,
          }
        : { dot: surfaceMuted, text: "untracked" };
  pill(ctx, cx, cy, integrity.text, {
    fill: onSurface,
    fillAlpha: 0.1,
    color: onSurface,
    font: chipFont,
    dot: integrity.dot,
  });

  // date, bottom right
  ctx.fillStyle = surfaceMuted;
  ctx.font = `600 20px ${sans}`;
  ctx.textAlign = "right";
  ctx.fillText(
    new Date(result.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    ix + iw - pad,
    cy + 31,
  );
  ctx.textAlign = "left";

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

"use client";

/**
 * WpmChart — hand-rolled responsive SVG chart of a test's per-second timeline.
 *
 * Series treatment (design-system spec):
 * - net wpm  → primary 2.5px monotone-cubic line, animated pathLength draw on mount
 * - raw wpm  → primary area wash at 10% opacity + 1.5px line at 35% opacity
 * - errors   → danger "×" glyphs near the baseline with a 2px surface halo
 * Gridlines are 1px foreground-8% hairlines; all label text wears text tokens,
 * never a series color. Hover/keyboard layer: crosshair snapped to the nearest
 * second + one glass tooltip (whole plot is the hit area).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { TickSample } from "@/lib/types";
import { clamp } from "@/lib/utils";

export interface WpmChartProps {
  timeline: TickSample[];
  /** Plot height in px (legend row excluded). */
  height?: number;
}

const PAD = { top: 14, right: 14, bottom: 26, left: 40 };
const HAIRLINE = "color-mix(in oklch, var(--foreground) 8%, transparent)";
const CROSSHAIR = "color-mix(in oklch, var(--foreground) 25%, transparent)";
const DRAW_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const TOOLTIP_W = 150;

interface Pt {
  x: number;
  y: number;
}

interface ChartModel {
  pts: { x: number; net: number; raw: number; sample: TickSample }[];
  netPath: string;
  rawPath: string;
  areaPath: string;
  yTicks: { v: number; y: number }[];
  xTicks: { t: number; x: number }[];
  plot: { left: number; right: number; top: number; bottom: number };
  /** ≥ 8px per spec; shrinks when seconds are tightly packed */
  errGlyphSize: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const fmtT = (t: number) => String(Math.round(t * 10) / 10);

/** Fritsch–Carlson monotone cubic interpolation → SVG cubic-bezier path. */
function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const d = pts[i + 1].x - pts[i].x;
    dx.push(d);
    slope.push(d === 0 ? 0 : (pts[i + 1].y - pts[i].y) / d);
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  m.push(slope[n - 2]);
  let d = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(pts[i + 1].x)} ${r2(pts[i + 1].y)}`;
  }
  return d;
}

function buildModel(timeline: TickSample[], width: number, height: number): ChartModel | null {
  if (width < 80 || timeline.length === 0) return null;
  const left = PAD.left;
  const right = width - PAD.right;
  const top = PAD.top;
  const bottom = height - PAD.bottom;

  const t0 = timeline[0].second;
  const t1 = timeline[timeline.length - 1].second;
  const span = Math.max(1e-6, t1 - t0);
  const single = timeline.length === 1;

  // 3 clean y steps rounded to 10s → 4 tick labels including 0.
  const maxV = Math.max(10, ...timeline.map((s) => Math.max(s.wpm, s.raw)));
  const step = Math.ceil(maxV / 30) * 10;
  const yMax = step * 3;

  const x = (t: number) => (single ? (left + right) / 2 : left + ((t - t0) / span) * (right - left));
  const y = (v: number) => bottom - (clamp(v, 0, yMax) / yMax) * (bottom - top);

  const pts = timeline.map((s) => ({ x: x(s.second), net: y(s.wpm), raw: y(s.raw), sample: s }));
  const netPath = monotonePath(pts.map((p) => ({ x: p.x, y: p.net })));
  const rawPath = monotonePath(pts.map((p) => ({ x: p.x, y: p.raw })));
  const areaPath =
    pts.length > 1
      ? `${rawPath} L ${r2(pts[pts.length - 1].x)} ${r2(bottom)} L ${r2(pts[0].x)} ${r2(bottom)} Z`
      : "";

  const yTicks = [0, 1, 2, 3].map((i) => ({ v: i * step, y: y(i * step) }));

  const xSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const xStep = xSteps.find((s) => span / s <= 6) ?? 600;
  const xTicks: { t: number; x: number }[] = [];
  for (let t = Math.ceil(t0 / xStep) * xStep; t <= t1 + 1e-6; t += xStep) {
    xTicks.push({ t, x: x(t) });
  }

  const perSecond = single ? right - left : (right - left) / span;
  return {
    pts,
    netPath,
    rawPath,
    areaPath,
    yTicks,
    xTicks,
    plot: { left, right, top, bottom },
    errGlyphSize: perSecond < 10 ? 9 : 12,
  };
}

/** Responsive wpm-over-time chart. Keyboard: arrows move the crosshair. */
export function WpmChart({ timeline, height = 220 }: WpmChartProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset hover when a new run's data arrives
  useEffect(() => setHover(null), [timeline]);

  const model = useMemo(() => buildModel(timeline, width, height), [timeline, width, height]);
  const hasErrors = useMemo(() => timeline.some((s) => s.errors > 0), [timeline]);

  const hovered = model && hover !== null && hover < model.pts.length ? model.pts[hover] : null;

  const moveHover = (delta: number) => {
    if (!model) return;
    setHover((h) => clamp((h ?? model.pts.length - 1) + delta, 0, model.pts.length - 1));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!model) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        moveHover(1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        moveHover(-1);
        break;
      case "Home":
        setHover(0);
        break;
      case "End":
        setHover(model.pts.length - 1);
        break;
      case "Escape":
        setHover(null);
        return;
      default:
        return;
    }
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!model || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < model.pts.length; i++) {
      const d = Math.abs(model.pts[i].x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const tipLeft = hovered
    ? Math.max(4, hovered.x + 14 + TOOLTIP_W > width ? hovered.x - TOOLTIP_W - 8 : hovered.x + 14)
    : 0;

  const last = timeline[timeline.length - 1];
  const label = last
    ? `wpm over time — finished at ${Math.round(last.wpm)} wpm; use left and right arrow keys to inspect each second`
    : "wpm over time — no per-second data";

  return (
    <div className="w-full">
      {/* legend — line-keys, never boxes; text stays muted */}
      <div className="mb-2 flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[2px] w-4 rounded-full bg-primary" />
          wpm
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[1.5px] w-4 rounded-full bg-primary/35" />
          raw
        </span>
        {hasErrors && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="text-[11px] font-bold leading-none text-danger">
              ×
            </span>
            errors
          </span>
        )}
      </div>

      <div
        ref={wrapRef}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="relative w-full rounded-2xl outline-offset-4"
        style={{ height }}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
      >
        {!model && timeline.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            no per-second data for this run
          </div>
        )}

        {model && (
          <svg width={width} height={height} className="block" aria-hidden="true">
            {/* gridlines + y tick labels (clean 10s) */}
            {model.yTicks.map(({ v, y }) => (
              <g key={v}>
                <line
                  x1={model.plot.left}
                  x2={model.plot.right}
                  y1={y}
                  y2={y}
                  stroke={HAIRLINE}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={model.plot.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* x tick labels in seconds */}
            {model.xTicks.map(({ t, x }) => (
              <text
                key={t}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {fmtT(t)}s
              </text>
            ))}

            {/* raw series: 10% area wash + 1.5px line at 35% */}
            {model.areaPath && (
              <motion.path
                d={model.areaPath}
                fill="var(--primary)"
                fillOpacity={0.1}
                stroke="none"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
              />
            )}
            <motion.path
              d={model.rawPath}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.08, ease: DRAW_EASE }}
            />

            {/* net series: 2.5px primary line on top */}
            <motion.path
              d={model.netPath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: DRAW_EASE }}
            />

            {/* single-sample fallback: dots instead of invisible zero-length paths */}
            {model.pts.length === 1 && (
              <>
                <circle cx={model.pts[0].x} cy={model.pts[0].raw} r={3.5} fill="var(--primary)" fillOpacity={0.35} />
                <circle cx={model.pts[0].x} cy={model.pts[0].net} r={4.5} fill="var(--primary)" />
              </>
            )}

            {/* error ticks: danger × near the baseline, 2px surface halo */}
            <motion.g
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              {model.pts
                .filter((p) => p.sample.errors > 0)
                .map((p) => (
                  <text
                    key={p.sample.second}
                    x={p.x}
                    y={model.plot.bottom - 5}
                    textAnchor="middle"
                    fontSize={model.errGlyphSize}
                    fontWeight={700}
                    className="fill-danger"
                    paintOrder="stroke"
                    stroke="var(--background)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  >
                    ×
                  </text>
                ))}
            </motion.g>

            {/* crosshair + snapped markers */}
            {hovered && (
              <g>
                <line
                  x1={hovered.x}
                  x2={hovered.x}
                  y1={model.plot.top}
                  y2={model.plot.bottom}
                  stroke={CROSSHAIR}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.raw}
                  r={3}
                  fill="var(--primary)"
                  fillOpacity={0.5}
                  stroke="var(--background)"
                  strokeWidth={2}
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.net}
                  r={4}
                  fill="var(--primary)"
                  stroke="var(--background)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {/* glass tooltip — values strong first, labels muted after */}
        {hovered && (
          <div
            className="glass-strong pointer-events-none absolute z-10 rounded-xl px-3 py-2"
            // `.glass-strong` sets `position: relative` (unlayered CSS, so it
            // beats Tailwind's `absolute` utility) — force absolute inline, or
            // the tooltip drops out of the plot and collides with the buttons.
            style={{ position: "absolute", left: tipLeft, top: PAD.top + 4, width: TOOLTIP_W }}
          >
            <div className="text-[10px] font-medium text-faint-foreground">
              {fmtT(hovered.sample.second)}s
            </div>
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                <span aria-hidden className="h-[2px] w-3.5 shrink-0 rounded-full bg-primary" />
                <span className="font-semibold tabular-nums text-foreground">
                  {Math.round(hovered.sample.wpm)}
                </span>
                <span className="text-muted-foreground">wpm</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span aria-hidden className="h-[1.5px] w-3.5 shrink-0 rounded-full bg-primary/35" />
                <span className="font-semibold tabular-nums text-foreground">
                  {Math.round(hovered.sample.raw)}
                </span>
                <span className="text-muted-foreground">raw</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span aria-hidden className="w-3.5 shrink-0 text-center text-[10px] font-bold leading-none text-danger">
                  ×
                </span>
                <span className="font-semibold tabular-nums text-foreground">{hovered.sample.errors}</span>
                <span className="text-muted-foreground">errors</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {hovered
          ? `${fmtT(hovered.sample.second)} seconds: ${Math.round(hovered.sample.wpm)} wpm, ${Math.round(hovered.sample.raw)} raw, ${hovered.sample.errors} errors`
          : ""}
      </span>
    </div>
  );
}

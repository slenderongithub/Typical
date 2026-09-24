"use client";

/**
 * Shared mini trend chart for the stats dashboard (single primary series +
 * optional secondary). Same craft rules as WpmChart: 2px lines, 10% area
 * wash, hairline grid, token-colored text, crosshair + glass tooltip,
 * keyboard-inspectable.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { clamp } from "@/lib/utils";

export interface TrendPoint {
  t: number;
  value: number;
  secondary?: number;
  /** tooltip heading, e.g. a date */
  label: string;
}

export interface TrendChartProps {
  points: TrendPoint[];
  height?: number;
  valueLabel: string;
  secondaryLabel?: string;
  /** y-axis rounding step base (default 10) */
  tickBase?: number;
  area?: boolean;
}

const PAD = { top: 12, right: 12, bottom: 22, left: 36 };
const HAIRLINE = "color-mix(in oklch, var(--foreground) 8%, transparent)";
const CROSSHAIR = "color-mix(in oklch, var(--foreground) 25%, transparent)";

function linePath(pts: { x: number; y: number }[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export function TrendChart({
  points,
  height = 180,
  valueLabel,
  secondaryLabel,
  tickBase = 10,
  area = true,
}: TrendChartProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) =>
      setWidth(Math.round(es[0]?.contentRect.width ?? el.clientWidth)),
    );
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const model = useMemo(() => {
    if (width < 80 || points.length === 0) return null;
    const left = PAD.left;
    const right = width - PAD.right;
    const top = PAD.top;
    const bottom = height - PAD.bottom;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const maxV = Math.max(
      tickBase,
      ...points.map((p) => Math.max(p.value, p.secondary ?? 0)),
    );
    const step = Math.ceil(maxV / (3 * tickBase)) * tickBase;
    const yMax = step * 3;
    const single = points.length === 1;
    const x = (t: number) =>
      single ? (left + right) / 2 : left + ((t - t0) / span) * (right - left);
    const y = (v: number) => bottom - (clamp(v, 0, yMax) / yMax) * (bottom - top);
    const pts = points.map((p) => ({
      x: x(p.t),
      y: y(p.value),
      y2: p.secondary !== undefined ? y(p.secondary) : null,
      p,
    }));
    const main = linePath(pts);
    const areaPath =
      pts.length > 1 && area
        ? `${main} L ${pts[pts.length - 1].x.toFixed(2)} ${bottom} L ${pts[0].x.toFixed(2)} ${bottom} Z`
        : "";
    const secondary = points.some((p) => p.secondary !== undefined)
      ? linePath(pts.filter((q) => q.y2 !== null).map((q) => ({ x: q.x, y: q.y2! })))
      : "";
    return {
      pts,
      main,
      areaPath,
      secondary,
      yTicks: [0, 1, 2, 3].map((i) => ({ v: i * step, y: y(i * step) })),
      plot: { left, right, top, bottom },
    };
  }, [points, width, height, tickBase, area]);

  const hovered =
    model && hover !== null && hover < model.pts.length
      ? model.pts[hover]
      : null;

  const onPointerMove = (e: React.PointerEvent) => {
    if (!model || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    model.pts.forEach((q, i) => {
      const d = Math.abs(q.x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!model) return;
    const move = (d: number) =>
      setHover((h) => clamp((h ?? model.pts.length - 1) + d, 0, model.pts.length - 1));
    if (e.key === "ArrowRight") move(1);
    else if (e.key === "ArrowLeft") move(-1);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const tipLeft = hovered
    ? Math.max(4, hovered.x + 130 > width ? hovered.x - 126 : hovered.x + 12)
    : 0;

  return (
    <div className="w-full">
      {secondaryLabel && model?.secondary && (
        <div className="mb-1.5 flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[2px] w-4 rounded-full bg-primary" />
            {valueLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[1.5px] w-4 rounded-full bg-primary/35" />
            {secondaryLabel}
          </span>
        </div>
      )}
      <div
        ref={wrapRef}
        role="img"
        aria-label={`${valueLabel} over time — arrow keys inspect points`}
        tabIndex={0}
        className="relative w-full outline-offset-4"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
      >
        {model && (
          <svg width={width} height={height} className="block" aria-hidden>
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
                  x={model.plot.left - 7}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={10.5}
                  className="fill-muted-foreground"
                >
                  {v}
                </text>
              </g>
            ))}
            {model.areaPath && (
              <path d={model.areaPath} fill="var(--primary)" fillOpacity={0.1} />
            )}
            {model.secondary && (
              <path
                d={model.secondary}
                fill="none"
                stroke="var(--primary)"
                strokeOpacity={0.35}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <motion.path
              d={model.main}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
            {model.pts.length === 1 && (
              <circle
                cx={model.pts[0].x}
                cy={model.pts[0].y}
                r={4}
                fill="var(--primary)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            )}
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
                  cy={hovered.y}
                  r={4}
                  fill="var(--primary)"
                  stroke="var(--background)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}
        {!model && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            not enough data yet
          </div>
        )}
        {hovered && (
          <div
            className="popover pointer-events-none absolute z-10 rounded-xl px-3 py-2"
            // `.glass-strong` forces `position: relative` (unlayered, beats the
            // `absolute` utility) — pin it absolute inline so the tooltip stays
            // in the plot instead of dropping into the content below.
            style={{ position: "absolute", left: tipLeft, top: PAD.top + 2, width: 122 }}
          >
            <div className="text-[10px] font-medium text-faint-foreground">
              {hovered.p.label}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5 text-xs">
              <span className="font-semibold tabular-nums text-foreground">
                {Math.round(hovered.p.value * 10) / 10}
              </span>
              <span className="text-muted-foreground">{valueLabel}</span>
            </div>
            {hovered.p.secondary !== undefined && secondaryLabel && (
              <div className="flex items-baseline gap-1.5 text-xs">
                <span className="font-semibold tabular-nums text-foreground">
                  {Math.round(hovered.p.secondary)}
                </span>
                <span className="text-muted-foreground">{secondaryLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export interface GlassSurfaceProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Optional fixed size — by default the surface is sized by className (w-full h-auto). */
  width?: number | string;
  height?: number | string;
  /** px, applied inline so the displacement map stays in sync. */
  borderRadius?: number;
  /** Base feDisplacementMap scale; the G/B channels get +10 / +20 chromatic offsets. */
  distortionScale?: number;
}

/** Box-shadow stack mirrored from `.glass-strong` in globals.css. */
const GLASS_SHADOW =
  "inset 0 1px 0 0 var(--glass-highlight), inset 0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 8px 32px -8px var(--glass-shadow), 0 2px 8px -2px var(--glass-shadow)";

/**
 * SVG-filter backdrop displacement only renders in Chromium; Safari and
 * Firefox silently drop the backdrop entirely, so they must take the fallback.
 * UA sniff is the only reliable signal here — CSS.supports lies.
 */
function detectSvgFilterSupport(): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined") return false;
  const ua = navigator.userAgent;
  if (/firefox|fxios/i.test(ua)) return false;
  const isSafari = /^((?!chrome|chromium|crios|edg|android).)*safari/i.test(ua);
  if (isSafari) return false;
  return CSS.supports("backdrop-filter", "url(#nolook-probe) saturate(1.6)");
}

/**
 * Displacement map: neutral gray (no displacement) in the center, red/blue
 * edge gradients (x/y displacement vectors) around the rim — this is what
 * produces the liquid "lensing" at the surface's edges.
 */
function buildDisplacementMap(
  width: number,
  height: number,
  radius: number,
): string {
  const edge = Math.min(width, height) * 0.035;
  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="red" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="black"/>
  <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#red)"/>
  <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#blue)" style="mix-blend-mode: difference"/>
  <rect x="${edge}" y="${edge}" width="${width - edge * 2}" height="${height - edge * 2}" rx="${radius}" fill="hsl(0 0% 50% / 0.93)" style="filter: blur(11px)"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ISOLATE_R = "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0";
const ISOLATE_G = "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0";
const ISOLATE_B = "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0";

/**
 * The hero "liquid glass" surface: an feImage displacement map fed through
 * three per-channel feDisplacementMaps with slight chromatic offsets, screened
 * back together — the backdrop refracts through the edges like real glass.
 * Chromium-only; elsewhere (and during SSR) it renders as `.glass-strong`.
 * Reserve it for hero surfaces (results card, nav); use `.glass` classes
 * everywhere else — the filter is not free.
 */
export function GlassSurface({
  children,
  className,
  style,
  width,
  height,
  borderRadius = 24,
  distortionScale = -140,
}: GlassSurfaceProps) {
  const rawId = useId();
  const filterId = `glass-surface-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client capability detection must run post-hydration
    setSupported(detectSvgFilterSupport());
  }, []);

  // Regenerate the displacement map whenever the surface is resized.
  useEffect(() => {
    if (!supported) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setDims((prev) => {
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          return prev && prev.w === w && prev.h === h ? prev : { w, h };
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [supported]);

  const mapUri = useMemo(
    () => (dims ? buildDisplacementMap(dims.w, dims.h, borderRadius) : null),
    [dims, borderRadius],
  );

  const active = supported && mapUri !== null;

  const sizeStyle: CSSProperties = {};
  if (width !== undefined) sizeStyle.width = width;
  if (height !== undefined) sizeStyle.height = height;

  const surfaceStyle: CSSProperties = active
    ? {
        backdropFilter: `url(#${filterId}) saturate(1.6)`,
        background: "var(--glass-subtle)",
        border: "1px solid var(--glass-border)",
        boxShadow: GLASS_SHADOW,
      }
    : {};

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        width === undefined && "w-full",
        height === undefined && "h-auto",
        !active && "glass-strong",
        className,
      )}
      style={{ borderRadius, ...sizeStyle, ...surfaceStyle, ...style }}
    >
      {active && dims && (
        <svg
          width="0"
          height="0"
          aria-hidden
          style={{ position: "absolute", overflow: "hidden" }}
        >
          <defs>
            <filter
              id={filterId}
              colorInterpolationFilters="sRGB"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feImage
                x="0"
                y="0"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                href={mapUri ?? undefined}
                result="map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispR"
              />
              <feColorMatrix
                in="dispR"
                type="matrix"
                values={ISOLATE_R}
                result="chanR"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale + 10}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispG"
              />
              <feColorMatrix
                in="dispG"
                type="matrix"
                values={ISOLATE_G}
                result="chanG"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale + 20}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispB"
              />
              <feColorMatrix
                in="dispB"
                type="matrix"
                values={ISOLATE_B}
                result="chanB"
              />
              <feBlend in="chanR" in2="chanG" mode="screen" result="blendRG" />
              <feBlend in="blendRG" in2="chanB" mode="screen" result="blendRGB" />
              <feGaussianBlur in="blendRGB" stdDeviation="0.7" />
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </div>
  );
}

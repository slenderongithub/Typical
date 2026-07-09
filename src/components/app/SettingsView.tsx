"use client";

import { motion } from "framer-motion";
import { Check, Download, LogIn, LogOut, Trash2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GlassButton, GlassPanel } from "@/components/glass";
import { startThemeTransition } from "@/components/glass/theme-transition";
import { useGazeStore } from "@/lib/gaze/store";
import { clearHistory, exportHistory } from "@/lib/storage/local";
import { useSettings } from "@/lib/store/settings";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEMES = [
  { name: "midnight", swatch: "#6ea8ff", bg: "#07090f" },
  { name: "dawn", swatch: "#007aff", bg: "#eef0f6" },
  { name: "aurora", swatch: "#34d399", bg: "#050d0c" },
  { name: "sunset", swatch: "#fb923c", bg: "#0f0709" },
] as const;

/** Animated glass switch. */
function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-6 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-glass-subtle"
    >
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <span
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors duration-300",
          checked
            ? "border-transparent bg-primary"
            : "border-glass-border bg-glass",
        )}
      >
        <motion.span
          className="size-5 shrink-0 rounded-full bg-foreground shadow-sm"
          animate={{ x: checked ? 18 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          style={checked ? { backgroundColor: "var(--primary-foreground)" } : undefined}
        />
      </span>
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel pad="md" className="w-full">
      <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-1">{children}</div>
    </GlassPanel>
  );
}

export function SettingsView() {
  const settings = useSettings();
  const gaze = useGazeStore();
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
  useEffect(() => setMounted(true), []);

  const set = (patch: Partial<AppSettings>) => settings.set(patch);

  const onExport = async () => {
    const json = await exportHistory();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "typical-history.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      {[
        <Section key="appearance" title="appearance">
          <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-4">
            {THEMES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() =>
                  startThemeTransition(() => setTheme(t.name))
                }
                className={cn(
                  "glass-interactive relative flex flex-col items-center gap-2 rounded-2xl border p-4",
                  mounted && theme === t.name
                    ? "border-primary/60 bg-glass-strong"
                    : "border-glass-border bg-glass",
                )}
              >
                <span
                  className="flex h-10 w-full items-center justify-center rounded-xl border border-glass-border"
                  style={{ backgroundColor: t.bg }}
                >
                  <span
                    className="size-4 rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{t.name}</span>
                {mounted && theme === t.name && (
                  <span className="absolute right-2 top-2 text-primary">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Section>,

        <Section key="behavior" title="typing behavior">
          <Toggle
            label="live stats"
            hint="show wpm and accuracy while typing"
            checked={settings.liveStats}
            onChange={(v) => set({ liveStats: v })}
          />
          <Toggle
            label="smooth caret"
            hint="spring-animated caret instead of instant jumps"
            checked={settings.smoothCaret}
            onChange={(v) => set({ smoothCaret: v })}
          />
          <Toggle
            label="quick restart"
            hint="tab restarts instantly — off requires tab then enter"
            checked={settings.quickRestart}
            onChange={(v) => set({ quickRestart: v })}
          />
        </Section>,

        <Section key="gaze" title="gaze & privacy">
          <p className="px-4 pb-2 text-xs leading-relaxed text-muted-foreground">
            Gaze verification uses head-pose and eye-state heuristics from your
            webcam, processed entirely in your browser. No video is ever
            recorded or uploaded — only transient numeric landmarks.
          </p>
          <Toggle
            label="pause on peek"
            hint="freeze the test while you're looking down"
            checked={settings.pauseOnPeek}
            onChange={(v) => set({ pauseOnPeek: v })}
          />
          <Toggle
            label="camera preview"
            hint="show the small live preview during tests"
            checked={settings.showCameraPreview}
            onChange={(v) => set({ showCameraPreview: v })}
          />
          {gaze.consented && (
            <div className="px-4 pt-2">
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  gaze.setConsented(false);
                  gaze.setCameraOn(false);
                  gaze.setCalibrated(false);
                }}
              >
                revoke camera consent
              </GlassButton>
            </div>
          )}
        </Section>,

        <Section key="data" title="your data">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            <GlassButton
              size="sm"
              variant="ghost"
              icon={<Download className="size-3.5" />}
              onClick={() => void onExport()}
            >
              export history
            </GlassButton>
            {!confirmClear ? (
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Trash2 className="size-3.5" />}
                onClick={() => setConfirmClear(true)}
              >
                clear local history
              </GlassButton>
            ) : (
              <GlassButton
                size="sm"
                variant="danger"
                icon={<Trash2 className="size-3.5" />}
                onClick={() => {
                  void clearHistory().then(() => {
                    setConfirmClear(false);
                    setCleared(true);
                  });
                }}
              >
                really delete everything?
              </GlassButton>
            )}
            {cleared && (
              <span className="text-xs text-muted-foreground">
                local history cleared
              </span>
            )}
          </div>
        </Section>,

        <Section key="account" title="account">
          <div className="flex items-center justify-between px-4 py-2">
            {status === "authenticated" ? (
              <>
                <span className="text-sm text-foreground">
                  {session?.user?.name ?? session?.user?.email}
                </span>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  icon={<LogOut className="size-3.5" />}
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  sign out
                </GlassButton>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  guest mode — history lives in this browser
                </span>
                <Link href="/login">
                  <GlassButton
                    size="sm"
                    variant="primary"
                    icon={<LogIn className="size-3.5" />}
                  >
                    sign in
                  </GlassButton>
                </Link>
              </>
            )}
          </div>
        </Section>,
      ].map((section, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: {
              opacity: 1,
              y: 0,
              transition: { type: "spring", stiffness: 300, damping: 30 },
            },
          }}
        >
          {section}
        </motion.div>
      ))}
    </motion.div>
  );
}

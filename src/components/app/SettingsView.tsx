"use client";

import { motion } from "framer-motion";
import { Check, Download, LogIn, LogOut, Trash2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonClasses, GlassButton, GlassPanel } from "@/components/glass";
import { startThemeTransition } from "@/components/glass/theme-transition";
import { THEMES } from "@/components/glass/ThemeToggle";
import { getController, useGazeStore } from "@/lib/gaze/store";
import { clearHistory, exportHistory } from "@/lib/storage/local";
import { useSettings } from "@/lib/store/settings";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One settings line: copy on the left, a control on the right. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-foreground">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[13px] text-muted-foreground">{hint}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Accessible switch — the whole row stays readable, the track is the control. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-[2.625rem] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300",
        checked
          ? "bg-primary"
          : "bg-glass-strong ring-1 ring-inset ring-glass-border",
      )}
    >
      <motion.span
        className="size-[1.125rem] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
        animate={{ x: checked ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        style={{
          backgroundColor: checked
            ? "var(--primary-foreground)"
            : "var(--muted-foreground)",
        }}
      />
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
      <h2 className="card-title">{title}</h2>
      <div className="mt-2 divide-y divide-glass-border">{children}</div>
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

  // an armed "really delete?" disarms itself if left alone
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

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

  const who = session?.user?.name ?? session?.user?.email ?? "signed in";

  const sections = [
    <Section key="appearance" title="appearance">
      <div
        role="radiogroup"
        aria-label="theme"
        className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4"
      >
        {THEMES.map((t) => {
          const active = mounted && theme === t.name;
          return (
            <button
              key={t.name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.name}
              onClick={() => {
                if (!active) startThemeTransition(() => setTheme(t.name));
              }}
              className={cn(
                // a miniature of the site in that theme: flat background,
                // nav + rail islands, typing lines with the accent caret
                "relative aspect-[16/11] overflow-hidden rounded-[1.25rem] text-left shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)] transition-transform duration-300 hover:-translate-y-1",
                active
                  ? "ring-[3px] ring-primary ring-offset-[3px] ring-offset-background"
                  : "ring-1 ring-black/10",
              )}
              style={{ backgroundColor: t.bg }}
            >
              <span aria-hidden className="absolute inset-0">
                {/* nav island */}
                <span
                  className="absolute left-1/2 top-[9%] flex h-[13%] w-[56%] -translate-x-1/2 items-center gap-[6%] rounded-full px-[3%] shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]"
                  style={{ backgroundColor: t.surface }}
                >
                  <span
                    className="h-[56%] w-[26%] rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span
                    className="h-[22%] w-[18%] rounded-full opacity-45"
                    style={{ backgroundColor: t.onSurface }}
                  />
                  <span
                    className="h-[22%] w-[18%] rounded-full opacity-45"
                    style={{ backgroundColor: t.onSurface }}
                  />
                </span>
                {/* rail island */}
                <span
                  className="absolute left-[5%] top-[30%] flex h-[46%] w-[9%] flex-col items-center gap-[12%] rounded-full pt-[3%] shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]"
                  style={{ backgroundColor: t.surface }}
                >
                  <span
                    className="aspect-square w-[64%] rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span
                    className="aspect-square w-[34%] rounded-full opacity-45"
                    style={{ backgroundColor: t.onSurface }}
                  />
                  <span
                    className="aspect-square w-[34%] rounded-full opacity-45"
                    style={{ backgroundColor: t.onSurface }}
                  />
                </span>
                {/* typing lines: typed, caret, pending */}
                <span className="absolute left-[24%] right-[8%] top-[38%] flex flex-col gap-[0.4rem]">
                  <span className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-[34%] rounded-full"
                      style={{ backgroundColor: t.fg }}
                    />
                    <span
                      className="h-3 w-[2px] rounded-full"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span
                      className="h-1.5 flex-1 rounded-full opacity-35"
                      style={{ backgroundColor: t.fg }}
                    />
                  </span>
                  <span
                    className="h-1.5 w-[86%] rounded-full opacity-35"
                    style={{ backgroundColor: t.fg }}
                  />
                </span>
              </span>
              {/* name chip, island style */}
              <span
                className="absolute bottom-[8%] right-[5%] flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2.5 text-[13px] font-bold shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]"
                style={{ backgroundColor: t.surface, color: t.onSurface }}
              >
                {t.name}
                {active && (
                  <span
                    className="flex size-4 items-center justify-center rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  >
                    <Check
                      className="size-3"
                      strokeWidth={3.5}
                      style={{ color: t.bg }}
                    />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Section>,

    <Section key="behavior" title="typing">
      <Row label="live stats" hint="show time, wpm and accuracy while typing">
        <Switch
          label="live stats"
          checked={settings.liveStats}
          onChange={(v) => set({ liveStats: v })}
        />
      </Row>
      <Row label="smooth caret" hint="glide between letters instead of jumping">
        <Switch
          label="smooth caret"
          checked={settings.smoothCaret}
          onChange={(v) => set({ smoothCaret: v })}
        />
      </Row>
      <Row
        label="quick restart"
        hint="tab restarts instantly — off requires tab, then enter"
      >
        <Switch
          label="quick restart"
          checked={settings.quickRestart}
          onChange={(v) => set({ quickRestart: v })}
        />
      </Row>
    </Section>,

    <Section key="gaze" title="gaze & privacy">
      <Row
        label="pause on peek"
        hint="freeze the test while you're looking down"
      >
        <Switch
          label="pause on peek"
          checked={settings.pauseOnPeek}
          onChange={(v) => set({ pauseOnPeek: v })}
        />
      </Row>
      <Row label="camera preview" hint="show a small live preview during tests">
        <Switch
          label="camera preview"
          checked={settings.showCameraPreview}
          onChange={(v) => set({ showCameraPreview: v })}
        />
      </Row>
      {gaze.consented && (
        <Row
          label="camera consent"
          hint="granted — revoke to be asked again next time"
        >
          <GlassButton
            size="sm"
            onClick={() => {
              // actually release the webcam — flipping the flags alone left
              // the stream (and the camera light) running
              try {
                getController().stop();
              } catch {}
              gaze.setConsented(false);
              gaze.setCameraOn(false);
              gaze.setCalibrated(false);
              gaze.setStatus("inactive");
            }}
          >
            revoke
          </GlassButton>
        </Row>
      )}
    </Section>,

    <Section key="data" title="your data">
      <Row
        label="export history"
        hint="every run, personal best and streak as JSON"
      >
        <GlassButton
          size="sm"
          icon={<Download />}
          onClick={() => void onExport()}
        >
          export
        </GlassButton>
      </Row>
      <Row
        label="clear local history"
        hint={
          cleared
            ? "done — this browser's history is empty"
            : "deletes runs, bests and streak stored in this browser"
        }
      >
        <GlassButton
          size="sm"
          variant="danger"
          icon={<Trash2 />}
          onClick={() => {
            if (!confirmClear) {
              setConfirmClear(true);
              return;
            }
            void clearHistory().then(() => {
              setConfirmClear(false);
              setCleared(true);
            });
          }}
        >
          {confirmClear ? "click again to confirm" : "clear"}
        </GlassButton>
      </Row>
    </Section>,

    <Section key="account" title="account">
      {status === "authenticated" ? (
        <Row
          label={who}
          hint={
            session?.user?.email && session.user.email !== who
              ? session.user.email
              : "results sync to your account"
          }
        >
          <GlassButton
            size="sm"
            icon={<LogOut />}
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            sign out
          </GlassButton>
        </Row>
      ) : (
        <Row
          label="guest mode"
          hint="history lives in this browser — sign in to sync and rank"
        >
          <Link
            href="/login"
            className={buttonClasses({
              variant: "primary",
              size: "sm",
              hasIcon: true,
            })}
          >
            <LogIn aria-hidden className="size-[1.1em]" />
            sign in
          </Link>
        </Row>
      )}
    </Section>,
  ];

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      {sections.map((section) => (
        <motion.div
          key={section.key}
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

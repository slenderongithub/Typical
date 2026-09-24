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
        <div className="text-sm font-medium text-foreground">{label}</div>
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
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel pad="md" className="w-full">
      <h2 className="eyebrow">{title}</h2>
      {description && (
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
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
        className="grid grid-cols-2 gap-3 py-3.5 sm:grid-cols-4"
      >
        {THEMES.map((t) => {
          const active = mounted && theme === t.name;
          return (
            <button
              key={t.name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (!active) startThemeTransition(() => setTheme(t.name));
              }}
              className={cn(
                "group flex flex-col gap-2.5 rounded-2xl p-2 text-left transition-colors",
                active
                  ? "bg-glass-strong ring-2 ring-primary"
                  : "ring-1 ring-glass-border hover:bg-glass-strong",
              )}
            >
              {/* a miniature of the typing surface in that theme */}
              <span
                aria-hidden
                className="flex h-16 w-full flex-col justify-center gap-1.5 rounded-xl px-3 ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: t.bg }}
              >
                <span className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-7 rounded-full"
                    style={{ backgroundColor: t.fg }}
                  />
                  <span
                    className="h-2.5 w-[2px] rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span
                    className="h-1.5 w-5 rounded-full opacity-30"
                    style={{ backgroundColor: t.fg }}
                  />
                </span>
                <span
                  className="h-1.5 w-12 rounded-full opacity-30"
                  style={{ backgroundColor: t.fg }}
                />
              </span>
              <span className="flex items-center justify-between px-1 pb-0.5">
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t.name}
                </span>
                {active && <Check className="size-3.5 text-primary" />}
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

    <Section
      key="gaze"
      title="gaze & privacy"
      description="Gaze verification reads head pose and eye state from your webcam, entirely inside your browser. No video is ever recorded or uploaded — only a few numbers, used for a moment and thrown away."
    >
      <Row label="pause on peek" hint="freeze the test while you're looking down">
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
      <Row label="export history" hint="every run, personal best and streak as JSON">
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
            className={buttonClasses({ variant: "primary", size: "sm", hasIcon: true })}
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

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AtSign,
  Crown,
  Feather,
  FileText,
  Hash,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Quote,
  SlidersHorizontal,
  Timer,
  WholeWord,
  Zap,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { GlassButton, PILL_SPRING } from "@/components/glass";
import type {
  Difficulty,
  QuoteLength,
  TestConfig,
  TestMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rail widths (px, incl. island padding) — TestExperience keeps text clear of them. */
export const RAIL_WIDTH = { expanded: 172, collapsed: 52 } as const;

interface RailOption {
  value: string;
  label: string;
  /** accessible name when `label` alone is ambiguous (e.g. "sec") */
  aria?: string;
  /** shown alone when the rail is collapsed */
  icon: ReactNode;
  title?: string;
}

/** A short number or letter used in place of an icon. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-extrabold leading-none tabular-nums tracking-tight">
      {children}
    </span>
  );
}

const MODES: RailOption[] = [
  { value: "time", label: "time", icon: <Timer /> },
  { value: "words", label: "words", icon: <WholeWord /> },
  { value: "quote", label: "quote", icon: <Quote /> },
  { value: "zen", label: "zen", icon: <Leaf /> },
  { value: "custom", label: "custom", icon: <FileText /> },
];

const DURATIONS = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];
const QUOTE_LENGTHS: { value: QuoteLength; glyph: string }[] = [
  { value: "short", glyph: "S" },
  { value: "medium", glyph: "M" },
  { value: "long", glyph: "L" },
  { value: "all", glyph: "∞" },
];
const DIFFICULTIES: RailOption[] = [
  {
    value: "normal",
    label: "normal",
    icon: <Feather />,
    title: "mistakes are allowed",
  },
  {
    value: "expert",
    label: "expert",
    icon: <Zap />,
    title: "fails on any word committed with an error",
  },
  {
    value: "master",
    label: "master",
    icon: <Crown />,
    title: "fails on any mistake — or any look away, with the camera on",
  },
];

const ITEM =
  "relative flex h-9 w-full select-none items-center rounded-full px-2.5 text-sm font-semibold transition-colors duration-200";
const ITEM_IDLE =
  "text-surface-muted hover:bg-surface-foreground/10 hover:text-surface-foreground";

/** Label that slides shut when the rail collapses, leaving only the icon. */
function RailLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="relative overflow-hidden whitespace-nowrap"
      initial={false}
      animate={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
      transition={reduce ? { duration: 0 } : PILL_SPRING}
    >
      <span className="block pl-2.5 pr-1.5">{children}</span>
    </motion.span>
  );
}

function RailIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="relative flex size-5 shrink-0 items-center justify-center [&>svg]:size-[18px]"
    >
      {children}
    </span>
  );
}

/** Vertical single-choice group; the active chip slides between items. */
function RailGroup({
  label,
  options,
  value,
  onChange,
  collapsed,
}: {
  label: string;
  options: RailOption[];
  value: string;
  onChange: (v: string) => void;
  collapsed: boolean;
}) {
  const layoutId = useId();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const hasActive = options.some((o) => o.value === value);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      next = (idx + 1) % options.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (idx - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    ref.current
      ?.querySelectorAll<HTMLButtonElement>("button[role=radio]")
      [next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-0.5"
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.aria ?? o.label}
            title={o.title ?? o.aria ?? o.label}
            tabIndex={active || (!hasActive && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(ITEM, active ? "text-primary-foreground" : ITEM_IDLE)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="glass-chip absolute inset-0 rounded-full"
                transition={reduce ? { duration: 0 } : PILL_SPRING}
              />
            )}
            <RailIcon>{o.icon}</RailIcon>
            <RailLabel collapsed={collapsed}>{o.label}</RailLabel>
          </button>
        );
      })}
    </div>
  );
}

/** Independent on/off item (punctuation / numbers). */
function RailToggle({
  active,
  onClick,
  icon,
  label,
  collapsed,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        ITEM,
        "border",
        active
          ? "glass-chip text-primary-foreground"
          : cn("border-transparent", ITEM_IDLE),
      )}
    >
      <RailIcon>{icon}</RailIcon>
      <RailLabel collapsed={collapsed}>{label}</RailLabel>
    </button>
  );
}

function RailDivider() {
  return (
    <span aria-hidden className="mx-2.5 my-1 h-px bg-surface-foreground/15" />
  );
}

/** Custom duration / word count — the input pops out to the right of the rail. */
function CustomValue({
  active,
  value,
  onSubmit,
  unit,
  collapsed,
}: {
  active: boolean;
  value: number;
  onSubmit: (v: number) => void;
  unit: string;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft from committed prop value
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`custom ${unit}`}
        title={`custom ${unit}`}
        className={cn(
          ITEM,
          "border",
          active
            ? "glass-chip text-primary-foreground"
            : cn("border-transparent", ITEM_IDLE),
        )}
      >
        <RailIcon>
          {active ? <Glyph>{value}</Glyph> : <SlidersHorizontal />}
        </RailIcon>
        <RailLabel collapsed={collapsed}>{active ? unit : "custom"}</RailLabel>
      </button>
      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, x: -6, scale: 0.95, y: "-50%" }}
            animate={{ opacity: 1, x: 0, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, x: -6, scale: 0.95, y: "-50%" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="popover absolute left-full top-1/2 z-30 ml-4 flex items-center gap-1.5 rounded-2xl p-1.5"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = Math.floor(Number(draft));
              if (Number.isFinite(v) && v >= 5 && v <= 100000) {
                onSubmit(v);
                setOpen(false);
              }
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
              className="h-8 w-24 rounded-xl border border-glass-border bg-glass px-3 text-sm tabular-nums text-foreground outline-none placeholder:text-faint-foreground focus:border-primary/60 focus-visible:outline-none"
              placeholder={unit}
              aria-label={`custom ${unit}`}
            />
            <GlassButton size="sm" variant="primary" type="submit">
              set
            </GlassButton>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Custom-text modal for pasting a passage. */
function CustomTextModal({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft each time the modal opens
    if (open) setDraft(initial);
  }, [open, initial]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="custom text"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        >
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            className="popover relative w-full max-w-lg rounded-3xl p-6"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              your own text
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              paste or type any passage — at least 10 characters
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              autoFocus
              className="w-full resize-none rounded-2xl border border-glass-border bg-glass p-4 font-mono text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-faint-foreground focus:border-primary/60 focus-visible:outline-none"
              placeholder="once upon a midnight dreary…"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <span className="mr-auto text-xs tabular-nums text-faint-foreground">
                {draft.trim().length} chars
              </span>
              <GlassButton variant="ghost" onClick={onClose}>
                cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                disabled={draft.trim().length < 10}
                onClick={() => {
                  onSave(draft.trim());
                  onClose();
                }}
              >
                use this text
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ConfigBarProps {
  config: TestConfig;
  onChange: (c: TestConfig) => void;
  disabled?: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * The test-configuration rail: floating islands down the left edge —
 * a collapse toggle, then "what to type" (mode | amount), then "how hard"
 * (modifiers | difficulty). Collapsed, every item shrinks to its icon.
 */
export function ConfigBar({
  config,
  onChange,
  disabled,
  collapsed,
  onCollapsedChange,
}: ConfigBarProps) {
  const [textModal, setTextModal] = useState(false);

  const patch = (p: Partial<TestConfig>) => onChange({ ...config, ...p });
  const hasModifiers = config.mode === "time" || config.mode === "words";

  const amount =
    config.mode === "time" ? (
      <>
        <RailGroup
          label="test duration in seconds"
          collapsed={collapsed}
          options={DURATIONS.map((d) => ({
            value: String(d),
            label: "sec",
            aria: `${d} seconds`,
            icon: <Glyph>{d}</Glyph>,
          }))}
          value={
            DURATIONS.includes(config.duration) ? String(config.duration) : ""
          }
          onChange={(v) => patch({ duration: Number(v) })}
        />
        <CustomValue
          active={!DURATIONS.includes(config.duration)}
          value={config.duration}
          unit="seconds"
          collapsed={collapsed}
          onSubmit={(duration) => patch({ duration })}
        />
      </>
    ) : config.mode === "words" ? (
      <>
        <RailGroup
          label="word count"
          collapsed={collapsed}
          options={WORD_COUNTS.map((d) => ({
            value: String(d),
            label: "words",
            aria: `${d} words`,
            icon: <Glyph>{d}</Glyph>,
          }))}
          value={
            WORD_COUNTS.includes(config.wordCount)
              ? String(config.wordCount)
              : ""
          }
          onChange={(v) => patch({ wordCount: Number(v) })}
        />
        <CustomValue
          active={!WORD_COUNTS.includes(config.wordCount)}
          value={config.wordCount}
          unit="words"
          collapsed={collapsed}
          onSubmit={(wordCount) => patch({ wordCount })}
        />
      </>
    ) : config.mode === "quote" ? (
      <RailGroup
        label="quote length"
        collapsed={collapsed}
        options={QUOTE_LENGTHS.map((l) => ({
          value: l.value,
          label: l.value,
          icon: <Glyph>{l.glyph}</Glyph>,
        }))}
        value={config.quoteLength}
        onChange={(quoteLength) =>
          patch({ quoteLength: quoteLength as QuoteLength })
        }
      />
    ) : config.mode === "custom" ? (
      <button
        type="button"
        title="edit text"
        aria-label="edit text"
        onClick={() => setTextModal(true)}
        className={cn(ITEM, ITEM_IDLE)}
      >
        <RailIcon>
          <PencilLine />
        </RailIcon>
        <RailLabel collapsed={collapsed}>edit text</RailLabel>
      </button>
    ) : null;

  return (
    <>
      <nav
        aria-label="test settings"
        className={cn(
          "fixed left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-start gap-3 transition-opacity duration-300 sm:left-5",
          disabled && "pointer-events-none opacity-25",
        )}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "expand test settings" : "collapse test settings"
          }
          title={collapsed ? "expand" : "collapse"}
          className="island flex size-[52px] items-center justify-center rounded-full text-surface-foreground transition-transform active:scale-95"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </button>

        <div className="flex flex-col items-stretch gap-3">
          {/* island 1 — what to type */}
          <div className="island flex flex-col rounded-[1.5rem] p-1.5">
            <RailGroup
              label="test mode"
              collapsed={collapsed}
              options={MODES}
              value={config.mode}
              onChange={(mode) => {
                // custom with no text yet would start an empty test — ask for the
                // passage first; saving it switches the mode
                if (mode === "custom" && !config.customText) setTextModal(true);
                else patch({ mode: mode as TestMode });
              }}
            />
            {amount && (
              <>
                <RailDivider />
                <div className="flex flex-col gap-0.5">{amount}</div>
              </>
            )}
          </div>

          {/* island 2 — how hard (zen has neither modifiers nor difficulty) */}
          {config.mode !== "zen" && (
            <div className="island flex flex-col rounded-[1.5rem] p-1.5">
              {hasModifiers && (
                <>
                  <div className="flex flex-col gap-0.5">
                    <RailToggle
                      active={config.punctuation}
                      onClick={() =>
                        patch({ punctuation: !config.punctuation })
                      }
                      icon={<AtSign />}
                      label="punctuation"
                      collapsed={collapsed}
                    />
                    <RailToggle
                      active={config.numbers}
                      onClick={() => patch({ numbers: !config.numbers })}
                      icon={<Hash />}
                      label="numbers"
                      collapsed={collapsed}
                    />
                  </div>
                  <RailDivider />
                </>
              )}
              <RailGroup
                label="difficulty"
                collapsed={collapsed}
                options={DIFFICULTIES}
                value={config.difficulty}
                onChange={(difficulty) =>
                  patch({ difficulty: difficulty as Difficulty })
                }
              />
            </div>
          )}
        </div>
      </nav>

      {/* outside the rail: its transform would become the containing block
          for fixed descendants and trap the "full-screen" modal */}
      <CustomTextModal
        open={textModal}
        initial={config.customText ?? ""}
        onSave={(customText) => patch({ customText, mode: "custom" })}
        onClose={() => setTextModal(false)}
      />
    </>
  );
}

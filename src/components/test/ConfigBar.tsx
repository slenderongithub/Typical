"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Hash, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";

import { GlassButton, GlassPill } from "@/components/glass";
import type {
  Difficulty,
  QuoteLength,
  TestConfig,
  TestMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: { value: TestMode; label: string }[] = [
  { value: "time", label: "time" },
  { value: "words", label: "words" },
  { value: "quote", label: "quote" },
  { value: "zen", label: "zen" },
  { value: "custom", label: "custom" },
];

const DURATIONS = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];
const QUOTE_LENGTHS: QuoteLength[] = ["short", "medium", "long", "all"];
const DIFFICULTIES: Difficulty[] = ["normal", "expert", "master"];
const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  normal: "mistakes are allowed",
  expert: "fails on any word committed with an error",
  master: "fails on any mistake — or any look away, with the camera on",
};

const BAR =
  "glass-strong flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-x-1 gap-y-1.5 rounded-full p-1.5";

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-1.5 hidden h-5 w-px bg-glass-border sm:block"
    />
  );
}

/** Toggle chip for punctuation / numbers. */
function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-200",
        active
          ? "glass-chip text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("[&>svg]:size-4", active && "text-primary")}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

/** Inline custom-value popover (durations / word counts). */
function CustomValue({
  active,
  value,
  onSubmit,
  unit,
}: {
  active: boolean;
  value: number;
  onSubmit: (v: number) => void;
  unit: string;
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
        className={cn(
          "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
          active
            ? "glass-chip text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
        aria-expanded={open}
      >
        {active ? value : "custom"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, y: 6, scale: 0.95, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: 6, scale: 0.95, x: "-50%" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="popover absolute left-1/2 top-full z-30 mt-2.5 flex items-center gap-1.5 rounded-2xl p-1.5"
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
}

/** The test-configuration toolbar — two stacked glass rows: what to type, then how hard. */
export function ConfigBar({ config, onChange, disabled }: ConfigBarProps) {
  const [textModal, setTextModal] = useState(false);

  const patch = (p: Partial<TestConfig>) => onChange({ ...config, ...p });
  const hasModifiers = config.mode === "time" || config.mode === "words";

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center gap-2.5 transition-opacity duration-300",
          disabled && "pointer-events-none opacity-30",
        )}
      >
        {/* row 1 — what to type: mode | its amount */}
        <div className={BAR}>
          <GlassPill
            size="sm"
            variant="flat"
            ariaLabel="test mode"
            options={MODES}
            value={config.mode}
            onChange={(mode) => {
              // custom with no text yet would start an empty test — ask for the
              // passage first; saving it switches the mode
              if (mode === "custom" && !config.customText) setTextModal(true);
              else patch({ mode: mode as TestMode });
            }}
          />

          <Divider />

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={config.mode}
              className="flex items-center gap-0.5"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {config.mode === "time" && (
                <>
                  <GlassPill
                    size="sm"
                    variant="flat"
                    ariaLabel="test duration in seconds"
                    options={DURATIONS.map((d) => ({
                      value: String(d),
                      label: String(d),
                    }))}
                    value={
                      DURATIONS.includes(config.duration)
                        ? String(config.duration)
                        : ""
                    }
                    onChange={(v) => patch({ duration: Number(v) })}
                  />
                  <CustomValue
                    active={!DURATIONS.includes(config.duration)}
                    value={config.duration}
                    unit="seconds"
                    onSubmit={(duration) => patch({ duration })}
                  />
                </>
              )}

              {config.mode === "words" && (
                <>
                  <GlassPill
                    size="sm"
                    variant="flat"
                    ariaLabel="word count"
                    options={WORD_COUNTS.map((d) => ({
                      value: String(d),
                      label: String(d),
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
                    onSubmit={(wordCount) => patch({ wordCount })}
                  />
                </>
              )}

              {config.mode === "quote" && (
                <GlassPill
                  size="sm"
                  variant="flat"
                  ariaLabel="quote length"
                  options={QUOTE_LENGTHS.map((l) => ({ value: l, label: l }))}
                  value={config.quoteLength}
                  onChange={(quoteLength) =>
                    patch({ quoteLength: quoteLength as QuoteLength })
                  }
                />
              )}

              {config.mode === "custom" && (
                <button
                  type="button"
                  onClick={() => setTextModal(true)}
                  className="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <PencilLine aria-hidden className="size-3.5" />
                  edit text
                </button>
              )}

              {config.mode === "zen" && (
                <span className="flex h-9 items-center px-4 text-sm font-medium text-muted-foreground">
                  no target — just type
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* row 2 — how hard: modifiers | difficulty (zen has neither) */}
        {config.mode !== "zen" && (
          <div className={BAR}>
            {hasModifiers && (
              <>
                <div className="flex items-center gap-0.5">
                  <ToggleChip
                    active={config.punctuation}
                    onClick={() => patch({ punctuation: !config.punctuation })}
                    icon={<AtSign />}
                    label="punctuation"
                  />
                  <ToggleChip
                    active={config.numbers}
                    onClick={() => patch({ numbers: !config.numbers })}
                    icon={<Hash />}
                    label="numbers"
                  />
                </div>
                <Divider />
              </>
            )}

            <GlassPill
              size="sm"
              variant="flat"
              ariaLabel="difficulty"
              options={DIFFICULTIES.map((d) => ({
                value: d,
                label: (
                  <span
                    title={DIFFICULTY_HINTS[d]}
                    className={cn(
                      d === "master" &&
                        config.difficulty === "master" &&
                        "text-danger",
                      d === "expert" &&
                        config.difficulty === "expert" &&
                        "text-warning",
                    )}
                  >
                    {d}
                  </span>
                ),
              }))}
              value={config.difficulty}
              onChange={(difficulty) =>
                patch({ difficulty: difficulty as Difficulty })
              }
            />
          </div>
        )}
      </div>

      {/* outside the glass bar: backdrop-filter makes it the containing block
          for fixed descendants, which would trap the "full-screen" modal */}
      <CustomTextModal
        open={textModal}
        initial={config.customText ?? ""}
        onSave={(customText) => patch({ customText, mode: "custom" })}
        onClose={() => setTextModal(false)}
      />
    </>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Hash } from "lucide-react";
import { useEffect, useState } from "react";

import { GlassButton, GlassPill } from "@/components/glass";
import type { Difficulty, QuoteLength, TestConfig, TestMode } from "@/lib/types";
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
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-200",
        active
          ? "bg-glass-strong text-primary shadow-[inset_0_1px_0_0_var(--glass-highlight)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span aria-hidden className="[&>svg]:size-3.5">
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
          "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
          active
            ? "bg-glass-strong text-foreground shadow-[inset_0_1px_0_0_var(--glass-highlight)]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        custom
      </button>
      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, y: 6, scale: 0.95, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: 6, scale: 0.95, x: "-50%" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            // Opaque, absolutely-positioned popover. `.glass-strong` would force
            // position:relative (unlayered CSS beats the `absolute` utility),
            // dropping the form in-flow and wrecking the config-bar row; drop it
            // for a solid surface. Centering lives in framer's `x` because
            // animating y/scale makes framer own the whole transform (so a
            // `-translate-x-1/2` class is silently ignored).
            style={{
              position: "absolute",
              background:
                "color-mix(in srgb, var(--background) 90%, var(--foreground) 10%)",
              boxShadow:
                "0 14px 36px -12px var(--glass-shadow), 0 2px 8px -3px var(--glass-shadow)",
            }}
            className="absolute left-1/2 top-full z-30 mt-2 flex items-center gap-2 rounded-2xl border border-glass-border p-2"
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
              className="w-20 rounded-xl bg-glass px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-faint-foreground"
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
        >
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="glass-strong relative w-full max-w-lg rounded-3xl p-6"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <h2 className="mb-1 text-base font-semibold text-foreground">
              your own text
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              paste or type any passage — at least 10 characters
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              autoFocus
              className="w-full resize-none rounded-2xl bg-glass p-4 font-mono text-sm text-foreground outline-none placeholder:text-faint-foreground"
              placeholder="once upon a midnight dreary…"
            />
            <div className="mt-4 flex justify-end gap-2">
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

/** The test-configuration toolbar — one glass surface, everything animated. */
export function ConfigBar({ config, onChange, disabled }: ConfigBarProps) {
  const [textModal, setTextModal] = useState(false);

  const patch = (p: Partial<TestConfig>) => onChange({ ...config, ...p });

  return (
    <motion.div
      className={cn(
        "glass flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-2 rounded-full px-2.5 py-2 transition-opacity duration-300",
        disabled && "pointer-events-none opacity-40",
      )}
      layout
    >
      <GlassPill
        size="sm"
        ariaLabel="test mode"
        options={MODES}
        value={config.mode}
        onChange={(mode) => {
          patch({ mode: mode as TestMode });
          if (mode === "custom" && !config.customText) setTextModal(true);
        }}
      />

      <span aria-hidden className="mx-1 h-5 w-px bg-glass-border" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={config.mode}
          className="flex items-center gap-0.5"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        >
          {config.mode === "time" && (
            <>
              <GlassPill
                size="sm"
                ariaLabel="test duration in seconds"
                options={DURATIONS.map((d) => ({ value: String(d), label: String(d) }))}
                value={DURATIONS.includes(config.duration) ? String(config.duration) : ""}
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
                ariaLabel="word count"
                options={WORD_COUNTS.map((d) => ({ value: String(d), label: String(d) }))}
                value={WORD_COUNTS.includes(config.wordCount) ? String(config.wordCount) : ""}
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
              ariaLabel="quote length"
              options={QUOTE_LENGTHS.map((l) => ({ value: l, label: l }))}
              value={config.quoteLength}
              onChange={(quoteLength) =>
                patch({ quoteLength: quoteLength as QuoteLength })
              }
            />
          )}

          {config.mode === "custom" && (
            <GlassButton size="sm" variant="ghost" onClick={() => setTextModal(true)}>
              edit text
            </GlassButton>
          )}

          {config.mode === "zen" && (
            <span className="px-2 text-[0.8125rem] text-faint-foreground">
              no target — just type
            </span>
          )}
        </motion.div>
      </AnimatePresence>

      {(config.mode === "time" || config.mode === "words") && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-glass-border" />
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
        </>
      )}

      {config.mode !== "zen" && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-glass-border" />
          <GlassPill
            size="sm"
            ariaLabel="difficulty"
            options={DIFFICULTIES.map((d) => ({
              value: d,
              label: (
                <span className={cn(d === "master" && "text-danger")}>{d}</span>
              ),
            }))}
            value={config.difficulty}
            onChange={(difficulty) =>
              patch({ difficulty: difficulty as Difficulty })
            }
          />
        </>
      )}

      <CustomTextModal
        open={textModal}
        initial={config.customText ?? ""}
        onSave={(customText) => patch({ customText, mode: "custom" })}
        onClose={() => setTextModal(false)}
      />
    </motion.div>
  );
}

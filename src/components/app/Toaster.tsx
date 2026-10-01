"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, Info, X } from "lucide-react";

import { useToasts } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/** Top-right notification stack — errors and notices that shouldn't shove layout. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed right-4 top-24 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2.5 sm:right-6 lg:top-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            role="alert"
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="popover pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 pr-2.5"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                t.tone === "danger" ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary",
              )}
            >
              {t.tone === "danger" ? (
                <CircleAlert aria-hidden className="size-[18px]" />
              ) : (
                <Info aria-hidden className="size-[18px]" />
              )}
            </span>
            <p className="flex-1 pt-1.5 text-sm font-medium leading-snug text-foreground">
              {t.message}
            </p>
            <button
              type="button"
              aria-label="dismiss"
              onClick={() => dismiss(t.id)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-glass-strong hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

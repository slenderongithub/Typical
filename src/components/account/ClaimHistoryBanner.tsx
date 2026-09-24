"use client";

import { motion } from "framer-motion";
import { CloudUpload, Loader2, X } from "lucide-react";
import { useState } from "react";

import { GlassButton } from "@/components/glass";

export interface ClaimHistoryBannerProps {
  unsyncedCount: number;
  onClaim: () => Promise<void>;
  onDismiss: () => void;
}

/** Offer to attach runs from this browser that aren't in the account yet. */
export function ClaimHistoryBanner({
  unsyncedCount,
  onClaim,
  onDismiss,
}: ClaimHistoryBannerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (unsyncedCount === 0) return null;

  const plural = unsyncedCount === 1 ? "" : "s";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="glass mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl py-3 pl-4 pr-3"
      role="region"
      aria-label="sync local runs"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <CloudUpload className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {unsyncedCount} run{plural} in this browser {unsyncedCount === 1 ? "isn't" : "aren't"} in
          your account yet
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {error
            ? "couldn't reach the server — try again in a moment"
            : "add them to your synced history — anything already there is skipped"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <GlassButton
          size="sm"
          variant="primary"
          disabled={busy}
          icon={busy ? <Loader2 className="animate-spin" /> : undefined}
          onClick={() => {
            setBusy(true);
            setError(false);
            void onClaim()
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "syncing…" : `sync ${unsyncedCount} run${plural}`}
        </GlassButton>
        <GlassButton
          size="sm"
          variant="ghost"
          aria-label="not now"
          title="not now"
          icon={<X />}
          onClick={onDismiss}
        />
      </div>
    </motion.div>
  );
}

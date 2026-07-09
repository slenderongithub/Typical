"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, Loader2 } from "lucide-react";
import { useState } from "react";

import { GlassButton } from "@/components/glass";

export interface ClaimHistoryBannerProps {
  unsyncedCount: number;
  onClaim: () => Promise<void>;
}

/** Offer to attach local guest runs to the freshly signed-in account. */
export function ClaimHistoryBanner({
  unsyncedCount,
  onClaim,
}: ClaimHistoryBannerProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (unsyncedCount === 0 || done) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="glass mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <CloudUpload className="size-4 text-primary" />
          <p className="text-sm text-foreground">
            you have{" "}
            <span className="font-semibold">{unsyncedCount} guest run{unsyncedCount === 1 ? "" : "s"}</span>{" "}
            in this browser —{" "}
            <span className="text-muted-foreground">
              claim them to your account
            </span>
          </p>
        </div>
        <GlassButton
          size="sm"
          variant="primary"
          disabled={busy}
          icon={busy ? <Loader2 className="animate-spin" /> : undefined}
          onClick={() => {
            setBusy(true);
            void onClaim()
              .then(() => setDone(true))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "claiming…" : "claim runs"}
        </GlassButton>
      </motion.div>
    </AnimatePresence>
  );
}

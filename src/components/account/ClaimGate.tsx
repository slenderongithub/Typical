"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { getResults, markSynced } from "@/lib/storage/local";
import type { SavedResult } from "@/lib/types";

import { ClaimHistoryBanner } from "./ClaimHistoryBanner";

/**
 * Shows the claim banner when a signed-in user has unsynced guest runs in
 * this browser; claiming bulk-imports them and marks them synced locally.
 */
export function ClaimGate() {
  const { status } = useSession();
  const [unsynced, setUnsynced] = useState<SavedResult[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    void getResults().then((all) => {
      if (alive) setUnsynced(all.filter((r) => !r.synced));
    });
    return () => {
      alive = false;
    };
  }, [status]);

  if (status !== "authenticated" || unsynced.length === 0) return null;

  const claim = async () => {
    const res = await fetch("/api/results/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        results: unsynced.slice(0, 200).map((r) => ({
          id: r.id,
          mode: r.mode,
          config: r.config,
          configKey: r.configKey,
          wpm: r.wpm,
          rawWpm: r.rawWpm,
          accuracy: r.accuracy,
          consistency: r.consistency,
          chars: r.chars,
          durationMs: r.durationMs,
          timeline: r.timeline,
          integrity: r.integrity,
          peekCount: r.peekCount,
          peekTotalMs: r.peekTotalMs,
          trackingLostMs: r.trackingLostMs,
          createdAt: r.createdAt,
        })),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { claimed?: string[] };
      await markSynced(data.claimed ?? []);
      setUnsynced([]);
    } else {
      throw new Error("claim failed");
    }
  };

  return <ClaimHistoryBanner unsyncedCount={unsynced.length} onClaim={claim} />;
}

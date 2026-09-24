"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { getResults, markSynced } from "@/lib/storage/local";
import type { SavedResult } from "@/lib/types";

import { ClaimHistoryBanner } from "./ClaimHistoryBanner";

/** The claim endpoint accepts at most this many runs per request. */
const BATCH = 200;
/** Per-tab "not now" — the offer returns next visit, never nags within one. */
const DISMISS_KEY = "typical:claim-dismissed";

function toPayload(r: SavedResult) {
  return {
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
  };
}

/**
 * Shows the claim banner when a signed-in user has runs in this browser that
 * never reached their account (played as a guest, or a live sync failed);
 * claiming bulk-imports them and marks them synced locally. The server skips
 * any run the account already holds, so claiming never duplicates history.
 */
export function ClaimGate() {
  const { status } = useSession();
  const [unsynced, setUnsynced] = useState<SavedResult[]>([]);
  // safe to read on first render: nothing renders until the session resolves
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && !!sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return false;
    }
  });

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

  if (status !== "authenticated" || hidden || unsynced.length === 0) {
    return null;
  }

  const claim = async () => {
    const done = new Set<string>();
    for (let i = 0; i < unsynced.length; i += BATCH) {
      const res = await fetch("/api/results/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          results: unsynced.slice(i, i + BATCH).map(toPayload),
        }),
      });
      if (res.status === 503) {
        // no database behind this deploy — there's nothing to claim into
        setHidden(true);
        return;
      }
      if (!res.ok) throw new Error("claim failed");
      const data = (await res.json()) as { claimed?: string[] };
      const ids = data.claimed ?? [];
      await markSynced(ids);
      ids.forEach((id) => done.add(id));
    }
    setUnsynced((prev) => prev.filter((r) => !done.has(r.id)));
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setHidden(true);
  };

  return (
    <ClaimHistoryBanner
      unsyncedCount={unsynced.length}
      onClaim={claim}
      onDismiss={dismiss}
    />
  );
}

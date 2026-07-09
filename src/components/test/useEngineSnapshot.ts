"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { TypingEngine } from "@/lib/engine/engine";
import type { EngineSnapshot } from "@/lib/types";

const noopSubscribe = () => () => {};

/**
 * Subscribe a component to an engine. Snapshot identity only changes when the
 * engine emits, so re-renders track real state changes exactly.
 */
export function useEngineSnapshot(
  engine: TypingEngine | null,
): EngineSnapshot | null {
  const subscribe = useCallback(
    (fn: () => void) => (engine ? engine.subscribe(fn) : noopSubscribe()),
    [engine],
  );
  const getSnapshot = useCallback(
    () => (engine ? engine.getSnapshot() : null),
    [engine],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

"use client";

import { useSettings } from "@/lib/store/settings";

/** Quiet keyboard-affordance line under the test. */
export function RestartHint() {
  const quickRestart = useSettings((s) => s.quickRestart);
  return (
    <p className="typing-chrome flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
      <kbd className="kbd">tab</kbd>
      {!quickRestart && (
        <>
          <span aria-hidden>+</span>
          <kbd className="kbd">enter</kbd>
        </>
      )}
      <span className="ml-0.5">restart</span>
      <span aria-hidden className="mx-2 text-glass-border">
        |
      </span>
      <kbd className="kbd">esc</kbd>
      <span className="ml-0.5">end test</span>
    </p>
  );
}

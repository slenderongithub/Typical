"use client";

import { useSettings } from "@/lib/store/settings";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="glass-subtle rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Quiet keyboard-affordance line under the test. */
export function RestartHint() {
  const quickRestart = useSettings((s) => s.quickRestart);
  return (
    <p className="flex items-center gap-2 text-xs text-faint-foreground">
      {quickRestart ? (
        <>
          <Kbd>tab</Kbd> restart
        </>
      ) : (
        <>
          <Kbd>tab</Kbd> + <Kbd>enter</Kbd> restart
        </>
      )}
      <span aria-hidden>·</span>
      <Kbd>esc</Kbd> end
    </p>
  );
}

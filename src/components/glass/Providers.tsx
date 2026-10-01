"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-level client providers. next-themes drives the Typical themes as root
 * classes; dawn is the default (midnight's tokens double as the :root fallback
 * in globals.css).
 * `disableTransitionOnChange` is intentionally NOT set — theme switches are
 * animated via the View Transitions polygon reveal (see theme-transition.ts).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      themes={["midnight", "dawn", "aurora", "sunset", "basil", "cannoli", "pigeon", "poseidon"]}
      defaultTheme="dawn"
      enableSystem={false}
    >
      {children}
    </ThemeProvider>
  );
}

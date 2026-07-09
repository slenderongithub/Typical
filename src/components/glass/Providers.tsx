"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-level client providers. next-themes drives the four Typical themes as
 * root classes (midnight is the :root default in globals.css).
 * `disableTransitionOnChange` is intentionally NOT set — theme switches are
 * animated via the View Transitions polygon reveal (see theme-transition.ts).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      themes={["midnight", "dawn", "aurora", "sunset"]}
      defaultTheme="midnight"
      enableSystem={false}
    >
      {children}
    </ThemeProvider>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";

import "./globals.css";

import { NavBar } from "@/components/app/NavBar";
import { BackgroundGlow, Providers } from "@/components/glass";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Typical — typing, verified", template: "%s · Typical" },
  description:
    "A touch-typing speed test that verifies you never looked down at the keyboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <SessionProvider>
            <BackgroundGlow />
            <NavBar />
            <main className="flex flex-1 flex-col px-4 pb-16 pt-28">
              {children}
            </main>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}

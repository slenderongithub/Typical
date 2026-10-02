import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";

import "./globals.css";

import { Footer } from "@/components/app/Footer";
import { NavBar } from "@/components/app/NavBar";
import { Toaster } from "@/components/app/Toaster";
import { Providers } from "@/components/glass";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Typical",
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
            <a
              href="#main"
              className="sr-only rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
            >
              skip to content
            </a>
            <NavBar />
            <Toaster />
            <main
              id="main"
              tabIndex={-1}
              className="flex flex-1 flex-col px-4 pb-6 pt-32 outline-none short:pb-3 short:pt-24">
              {children}
            </main>
            <Footer />
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}

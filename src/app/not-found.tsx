"use client";

import Link from "next/link";

import { buttonClasses } from "@/components/glass";

/** Themed 404 — Next's built-in one paints its own white background. */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 pb-24 text-center">
      <span className="text-8xl font-extrabold tracking-[-0.05em] text-primary">404</span>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        this page doesn&apos;t exist
      </h1>
      <Link href="/" className={buttonClasses({ variant: "primary" })}>
        back to typing
      </Link>
    </div>
  );
}

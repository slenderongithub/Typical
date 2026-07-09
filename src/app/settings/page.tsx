import type { Metadata } from "next";

import { SettingsView } from "@/components/app/SettingsView";

export const metadata: Metadata = { title: "settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
        settings
      </h1>
      <SettingsView />
    </div>
  );
}

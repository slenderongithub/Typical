import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { SettingsView } from "@/components/app/SettingsView";

export const metadata: Metadata = { title: "settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="settings"
        description="preferences are saved in this browser"
      />
      <SettingsView />
    </div>
  );
}

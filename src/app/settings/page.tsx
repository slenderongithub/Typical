import { PageHeader } from "@/components/app/PageHeader";
import { SettingsView } from "@/components/app/SettingsView";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="settings" />
      <SettingsView />
    </div>
  );
}

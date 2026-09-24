import type { Metadata } from "next";

import { ClaimGate } from "@/components/account/ClaimGate";
import { PageHeader } from "@/components/app/PageHeader";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata: Metadata = { title: "stats" };

export default function StatsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="your stats"
        description="every run, trend and weak key — computed from your history in this browser"
      />
      <ClaimGate />
      <StatsDashboard />
    </div>
  );
}

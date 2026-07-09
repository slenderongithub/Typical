import type { Metadata } from "next";

import { ClaimGate } from "@/components/account/ClaimGate";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata: Metadata = { title: "stats" };

export default function StatsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
        your stats
      </h1>
      <ClaimGate />
      <StatsDashboard />
    </div>
  );
}

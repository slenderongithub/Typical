import { ClaimGate } from "@/components/account/ClaimGate";
import { PageHeader } from "@/components/app/PageHeader";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export default function StatsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="your stats" />
      <ClaimGate />
      <StatsDashboard />
    </div>
  );
}

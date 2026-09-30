import { PageHeader } from "@/components/app/PageHeader";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="leaderboard" />
      <LeaderboardView />
    </div>
  );
}

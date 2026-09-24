import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = { title: "leaderboard" };

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="leaderboard"
        description="personal bests from signed-in, live-submitted runs — clean runs by default"
      />
      <LeaderboardView />
    </div>
  );
}

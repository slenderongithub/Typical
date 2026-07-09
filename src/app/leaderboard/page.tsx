import type { Metadata } from "next";

import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = { title: "leaderboard" };

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
        leaderboard
      </h1>
      <LeaderboardView />
    </div>
  );
}

"use client";

import { Leaderboard } from "../../components/Leaderboard";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto py-8">
        <Leaderboard />
      </div>
    </div>
  );
}

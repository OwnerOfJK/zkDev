import { NextRequest, NextResponse } from "next/server";

interface LeaderboardEntry {
  username: string;
  avatar_url: string;
  total_commits: number;
  repositories: string[];
  isCurrentUser: boolean;
}

export async function GET(request: NextRequest) {
  const userSession = request.cookies.get("user_session")?.value;

  if (!userSession) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userInfo = JSON.parse(userSession);
    const accessToken = userInfo.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "No access token found" }, { status: 401 });
    }

    // For demo purposes, we'll return mock data since we would need a database
    // to store and aggregate data from multiple users for a real leaderboard
    const mockLeaderboardData: LeaderboardEntry[] = [
      {
        username: userInfo.username,
        avatar_url: userInfo.avatar_url || "",
        total_commits: 125,
        repositories: ["repo1", "repo2", "repo3"],
        isCurrentUser: true,
      },
      {
        username: "developer1",
        avatar_url: "https://github.com/developer1.png",
        total_commits: 98,
        repositories: ["awesome-project", "web-app"],
        isCurrentUser: false,
      },
      {
        username: "coder123",
        avatar_url: "https://github.com/coder123.png",
        total_commits: 87,
        repositories: ["api-service", "frontend-lib"],
        isCurrentUser: false,
      },
      {
        username: "devmaster",
        avatar_url: "https://github.com/devmaster.png",
        total_commits: 76,
        repositories: ["blockchain-app", "smart-contracts"],
        isCurrentUser: false,
      },
    ];

    // Sort by total commits descending
    const sortedData = mockLeaderboardData.sort((a, b) => b.total_commits - a.total_commits);

    return NextResponse.json(sortedData);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

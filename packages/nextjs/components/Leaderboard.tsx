import { useEffect, useState } from "react";
import Image from "next/image";

interface LeaderboardEntry {
  username: string;
  avatar_url: string;
  total_commits: number;
  repositories: string[];
  isCurrentUser: boolean;
}

export const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        const response = await fetch("/api/auth/github/leaderboard", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard data");
        }
        const data = await response.json();
        setLeaderboardData(data);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        setError("Failed to load leaderboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Loading Leaderboard...</h2>
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-500 mb-4">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Developer Leaderboard</h2>
      <div className="bg-base-200 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-base-300">
              <th className="px-6 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                Developer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                Total Commits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                Top Repositories
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {leaderboardData.map((entry, index) => (
              <tr key={entry.username} className={`hover:bg-base-300/50 ${entry.isCurrentUser ? "bg-primary/10" : ""}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-base-content">#{index + 1}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <Image
                        className="rounded-full"
                        src={entry.avatar_url}
                        alt={entry.username}
                        width={40}
                        height={40}
                        sizes="40px"
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-base-content">
                        {entry.username}
                        {entry.isCurrentUser && (
                          <span className="ml-2 text-xs bg-primary text-primary-content px-2 py-1 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-base-content">{entry.total_commits.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-base-content">
                    {entry.repositories.slice(0, 3).join(", ")}
                    {entry.repositories.length > 3 && "..."}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

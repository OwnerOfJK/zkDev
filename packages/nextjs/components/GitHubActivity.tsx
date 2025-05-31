import { useEffect, useState } from "react";

interface GitHubActivity {
  commits: Array<{
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
  pullRequests: any[];
  issues: any[];
  repositories: Array<{
    id: number;
    name: string;
    description: string;
    stargazers_count: number;
    watchers_count: number;
    forks_count: number;
    commit_count: number;
  }>;
}

interface UserInfo {
  id: string;
  displayName: string;
  provider: string;
  accessToken: string;
}

export const GitHubActivity = () => {
  const [activity, setActivity] = useState<GitHubActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user info");
        }

        const data = await response.json();
        setUserInfo(data);
      } catch (error) {
        console.error("Error fetching user info:", error);
        setError("Failed to load user info");
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!userInfo?.accessToken) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/github/activity`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch GitHub activity");
        }

        const data = await response.json();
        setActivity(data);
      } catch (error) {
        console.error("Error fetching GitHub activity:", error);
        setError("Failed to load GitHub activity");
      } finally {
        setLoading(false);
      }
    };

    if (userInfo?.accessToken) {
      fetchActivity();
    }
  }, [userInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Loading GitHub Activity...</h2>
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

  if (!activity) {
    return null;
  }

  // Sort repositories by commit count
  const sortedRepositories = [...activity.repositories].sort((a, b) => b.commit_count - a.commit_count);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">GitHub Activity</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-base-200 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Repositories</h3>
          <p className="text-3xl font-bold">{activity.repositories.length}</p>
        </div>

        <div className="bg-base-200 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Commits</h3>
          <p className="text-3xl font-bold">{activity.commits.length}</p>
        </div>

        <div className="bg-base-200 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Pull Requests</h3>
          <p className="text-3xl font-bold">{activity.pullRequests.length}</p>
        </div>

        <div className="bg-base-200 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Issues</h3>
          <p className="text-3xl font-bold">{activity.issues.length}</p>
        </div>
      </div>

      {/* Recent Repositories */}
      <div className="bg-base-200 p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Top Repositories by Commits</h3>
        <div className="space-y-4">
          {sortedRepositories.slice(0, 5).map(repo => (
            <div key={repo.id} className="border-b border-base-300 pb-4 last:border-0">
              <h4 className="font-bold">{repo.name}</h4>
              <p className="text-sm text-base-content/70 mb-2">{repo.description || "No description"}</p>
              <div className="flex gap-4 text-sm">
                <span>⭐ {repo.stargazers_count}</span>
                <span>👁️ {repo.watchers_count}</span>
                <span>🍴 {repo.forks_count}</span>
                <span>📝 {repo.commit_count} commits</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

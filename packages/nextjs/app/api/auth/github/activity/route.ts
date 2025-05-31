import { NextRequest, NextResponse } from "next/server";

interface GitHubRepository {
  id: number;
  name: string;
  description: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  commit_count?: number;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
  repository: {
    id: number;
    name: string;
  };
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  repository: {
    id: number;
    name: string;
  };
}

interface GitHubSearchResponse<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
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

    const headers = {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Fetch user's repositories
    const reposResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers,
    });

    if (!reposResponse.ok) {
      throw new Error(`Failed to fetch repositories: ${reposResponse.status}`);
    }

    const repositories = (await reposResponse.json()) as GitHubRepository[];

    // Fetch commits using search API
    const commitsResponse = await fetch(
      `https://api.github.com/search/commits?q=author:${userInfo.username}&per_page=100`,
      {
        headers: {
          ...headers,
          Accept: "application/vnd.github.cloak-preview", // required for commit search
        },
      },
    );

    let commits: GitHubCommit[] = [];
    if (commitsResponse.ok) {
      const commitsData = (await commitsResponse.json()) as GitHubSearchResponse<GitHubCommit>;
      commits = commitsData.items || [];
    }

    // Calculate commit counts per repository
    const commitCounts = new Map<number, number>();
    commits.forEach(commit => {
      const repoId = commit.repository.id;
      commitCounts.set(repoId, (commitCounts.get(repoId) || 0) + 1);
    });

    // Add commit counts to repositories
    const repositoriesWithCommits = repositories.map(repo => ({
      ...repo,
      commit_count: commitCounts.get(repo.id) || 0,
    }));

    // Fetch user's pull requests
    const prsResponse = await fetch(
      `https://api.github.com/search/issues?q=author:${userInfo.username}+is:pr&per_page=100`,
      {
        headers,
      },
    );

    let pullRequests: GitHubIssue[] = [];
    if (prsResponse.ok) {
      const prsData = (await prsResponse.json()) as GitHubSearchResponse<GitHubIssue>;
      pullRequests = prsData.items || [];
    }

    // Fetch user's issues
    const issuesResponse = await fetch(
      `https://api.github.com/search/issues?q=author:${userInfo.username}+is:issue&per_page=100`,
      {
        headers,
      },
    );

    let issues: GitHubIssue[] = [];
    if (issuesResponse.ok) {
      const issuesData = (await issuesResponse.json()) as GitHubSearchResponse<GitHubIssue>;
      issues = issuesData.items || [];
    }

    // Log the response sizes for debugging
    console.log("Response sizes:", {
      repositories: repositoriesWithCommits.length,
      commits: commits.length,
      pullRequests: pullRequests.length,
      issues: issues.length,
    });

    return NextResponse.json({
      commits,
      pullRequests,
      issues,
      repositories: repositoriesWithCommits,
    });
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch GitHub activity",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

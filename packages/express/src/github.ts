import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// Constants
const REPO_LIMIT = process.env.REPO_LIMIT ? parseInt(process.env.REPO_LIMIT, 10) : 5;
const LOG_FILE = "gh_query2.log";

// Types
interface GitHubRepository {
  id: number;
  name: string;
  description: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  commit_count?: number;
  owner: {
    login: string;
  };
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

interface GitHubSearchResponse<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

// Helper Functions
function logBoth(message: string) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + "\n");
}

async function fetchProof(url: string, accessToken: string): Promise<string> {
  console.log("Fetching proof for URL:", url);
  
  const command = `vlayer web-proof-fetch \
      --notary "https://test-notary.vlayer.xyz" \
      --url "${url}" \
      -H "Authorization: token ${accessToken}" \
      -H "Accept: application/vnd.github.cloak-preview" \
      --max-recv-data 7000`;
      
  console.log("Executing command:", command);
  const { stdout, stderr } = await execAsync(command);

  if (stderr) {
    console.error("vlayer error output:", stderr);
    throw new Error(`Failed to generate proof: ${stderr}`);
  }

  console.log("Proof generated successfully");
  console.log("Proof length:", stdout.length);
  return stdout;
}

async function getReposWithCommitsByUser(username: string, accessToken: string) {
  const perPage = 100;
  let page = 1;
  const repos = new Map();
  let hasMore = true;

  while (hasMore && page <= 10 && repos.size < REPO_LIMIT) {
    const url = `https://api.github.com/search/commits?q=author:${username}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.cloak-preview",
        Authorization: `token ${accessToken}`,
      },
    });
    
    if (!res.ok) {
      console.error("GitHub API error:", res.status, await res.text());
      break;
    }
    
    const data = await res.json() as GitHubSearchResponse<GitHubCommit>;
    if (!data.items || data.items.length === 0) break;
    
    for (const item of data.items) {
      const repo = item.repository;
      repos.set(repo.id, repo.name);
      if (repos.size >= REPO_LIMIT) break;
    }
    
    hasMore = data.items.length === perPage && repos.size < REPO_LIMIT;
    page++;
  }
  
  return repos;
}

async function getCommitCountForRepo(owner: string, repo: string, username: string, accessToken: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${username}&per_page=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });
  
  if (!res.ok) {
    console.error(
      `Error fetching commits for ${owner}/${repo}:`,
      res.status,
      await res.text()
    );
    return 0;
  }
  
  const link = res.headers.get("link");
  if (link) {
    const match = link.match(/&page=(\d+)>; rel="last"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  const data = await res.json() as GitHubCommit[];
  return data.length;
}

export async function generateGitHubProof(username: string, accessToken: string) {
  const githubUrl = `https://api.github.com/search/commits?q=author:${username}&per_page=1`;
  
  // First, let's fetch and log the GitHub response
  console.log("Fetching GitHub data from:", githubUrl);
  const githubResponse = await fetch(githubUrl, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.cloak-preview",
    },
  });
  
  const githubData = await githubResponse.json() as GitHubSearchResponse<GitHubCommit>;
  console.log("GitHub API Response:", JSON.stringify(githubData, null, 2));
  console.log("Response size:", JSON.stringify(githubData).length, "bytes");

  // Generate the proof
  const proof = await fetchProof(githubUrl, accessToken);
  
  return {
    proof,
    githubData
  };
}

export async function queryGithub(username: string, accessToken: string) {
  const repos = await getReposWithCommitsByUser(username, accessToken);
  logBoth("Repos with commits by " + username + ":");
  
  // Sort repos by name alphabetically
  const sortedRepos = Array.from(repos.entries()).sort((a, b) =>
    a[1].localeCompare(b[1])
  );
  
  for (const [id, name] of sortedRepos) {
    // Get owner from repo API
    const repoUrl = `https://api.github.com/repositories/${id}`;
    const repoRes = await fetch(repoUrl, {
      headers: { Authorization: `token ${accessToken}` },
    });
    
    if (!repoRes.ok) {
      logBoth(
        `Error fetching repo info for ID ${id}, Name ${name}: HTTP ${repoRes.status}`
      );
      continue;
    }

    const repoInfo = await repoRes.json() as GitHubRepository;
    const owner = repoInfo.owner?.login;
    if (!owner) {
      logBoth(`No owner found for repo ${name}`);
      continue;
    }
    
    const commitCount = await getCommitCountForRepo(owner, name, username, accessToken);

    // Get stars, forks, and views
    let stars = repoInfo.stargazers_count;
    let forks = repoInfo.forks_count;
    let views = null;
    
    try {
      const viewsUrl = `https://api.github.com/repos/${owner}/${name}/traffic/views`;
      const viewsRes = await fetch(viewsUrl, {
        headers: { Authorization: `token ${accessToken}` },
      });
      if (viewsRes.ok) {
        const viewsData = await viewsRes.json() as { count: number };
        views = viewsData.count;
      }
    } catch (e) {
      // ignore errors for views
    }

    logBoth(
      `ID: ${id}, Name: ${name}, Commits by ${username}: ${commitCount}, Stars: ${stars}, Forks: ${forks}, Views: ${
        views !== null ? views : "N/A"
      }`
    );
  }
} 
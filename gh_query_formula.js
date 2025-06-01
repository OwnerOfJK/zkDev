// Basic Node.js script using GitHub REST API to compute contribution score
// Install dependencies: npm install node-fetch dotenv

const fetch = require("node-fetch");
require("dotenv").config();

const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN; // Store your token in .env file
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

const REPO_LIMIT = parseInt(process.env.REPO_LIMIT, 10);

async function getRepoMetadata(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: HEADERS,
  });
  const data = await res.json();
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    default_branch: data.default_branch,
  };
}

async function getContributorsCount(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors`, {
    headers: HEADERS,
  });
  const data = await res.json();
  return data.length;
}

async function getCommitsByUser(owner, repo, branch, username) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?author=${username}&sha=${branch}`,
    { headers: HEADERS }
  );
  const commits = await res.json();
  return commits;
}

async function getCommitStats(owner, repo, sha) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  return data.stats || { additions: 0, deletions: 0 };
}

function calculateRIS(stars, forks, contributors) {
  // RIS: Repository Importance Score
  return (
    Math.log2(stars + 1) * 2 + Math.log2(forks + 1) * 1.5 + contributors * 0.5
  );
}

async function calculateContributionScore(owner, repo, username) {
  const { stars, forks, default_branch } = await getRepoMetadata(owner, repo);
  const contributors = await getContributorsCount(owner, repo);
  const RIS = calculateRIS(stars, forks, contributors); // RIS: Repository Importance Score

  const commits = await getCommitsByUser(owner, repo, default_branch, username);

  let totalAdditions = 0;
  let productionCommits = 0;
  for (const commit of commits) {
    const stats = await getCommitStats(owner, repo, commit.sha);
    totalAdditions += stats.additions;

    if (commit.files) {
      const touchesProduction = commit.files.some(
        (file) =>
          file.filename.startsWith("src/") || file.filename.startsWith("lib/")
      );
      if (touchesProduction) productionCommits++;
    }
  }

  const CQS = commits.length * 2 + totalAdditions / 100; // CQS: Contribution Quality Score
  const PPB = productionCommits * 5; // PPB: Production Participation Bonus
  const finalScore = RIS * (CQS + PPB);

  // Log only the metrics used in the calculation
  console.log(`\n--- Metrics for ${owner}/${repo} ---`);
  console.log("Stars:", stars);
  console.log("Forks:", forks);
  console.log("Contributors:", contributors);
  console.log("Commits by user:", commits.length);
  console.log("Total additions:", totalAdditions);
  console.log("Production commits:", productionCommits);
  console.log("RIS (Repository Importance Score):", RIS);
  console.log("CQS (Contribution Quality Score):", CQS);
  console.log("PPB (Production Participation Bonus):", PPB);
  console.log("Final Score:", Math.round(finalScore));
  console.log("--- End metrics ---\n");

  return Math.round(finalScore); // Return the score for summary
}

async function getReposWithUserCommits(username) {
  let page = 1;
  const perPage = 100;
  const repos = new Set();

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/search/commits?q=author:${username}&per_page=${perPage}&page=${page}`,
      {
        headers: {
          ...HEADERS,
          Accept: "application/vnd.github.cloak-preview", // Required for commit search
        },
      }
    );
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      if (item.repository) {
        repos.add(`${item.repository.owner.login}/${item.repository.name}`);
      }
    }
    if (data.items.length < perPage) break;
    page++;
  }
  return Array.from(repos);
}

async function calculateAllContributions(username) {
  const repos = await getReposWithUserCommits(username);
  const summary = [];
  for (const repo of repos.slice(0, REPO_LIMIT)) {
    const [owner, name] = repo.split("/");
    const score = await calculateContributionScore(owner, name, username);
    summary.push({ repo: `${owner}/${name}`, score });
  }
  // Print summary
  console.log("\n===== Contribution Score Summary =====");
  for (const entry of summary) {
    console.log(`${entry.repo}: ${entry.score} points`);
  }
  console.log("======================================\n");
}

// Helper to extract metrics for Solidity
async function extractRepoMetricsForSolidity(username) {
  const repos = await getReposWithUserCommits(username);
  const metrics = [];
  for (const repo of repos.slice(0, REPO_LIMIT)) {
    const [owner, name] = repo.split("/");
    const { stars, forks, default_branch } = await getRepoMetadata(owner, name);
    const contributors = await getContributorsCount(owner, name);
    const commits = await getCommitsByUser(
      owner,
      name,
      default_branch,
      username
    );
    let totalAdditions = 0;
    let productionCommits = 0;
    for (const commit of commits) {
      const stats = await getCommitStats(owner, name, commit.sha);
      totalAdditions += stats.additions;
      if (commit.files) {
        const touchesProduction = commit.files.some(
          (file) =>
            file.filename.startsWith("src/") || file.filename.startsWith("lib/")
        );
        if (touchesProduction) productionCommits++;
      }
    }
    metrics.push({
      stars,
      forks,
      contributors,
      commitsByUser: commits.length,
      totalAdditions,
      productionCommits,
    });
  }
  console.log("\nSolidity input array for this contributor:");
  console.log(JSON.stringify(metrics, null, 2));
  return metrics;
}

// Example usage:
calculateAllContributions("mrizhakov");
extractRepoMetricsForSolidity("mrizhakov");

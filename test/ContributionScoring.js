const { expect } = require("chai");
const hre = require("hardhat");
require("dotenv").config();

// Import fetch globally if not available
if (typeof fetch === "undefined") {
  global.fetch = require("node-fetch");
}

const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN;

// Validate GitHub token
if (!TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is not set");
}

// Mask token for logging
const maskedToken = TOKEN.slice(0, 4) + "..." + TOKEN.slice(-4);
console.log("Using GitHub token:", maskedToken);

const HEADERS = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

const REPO_LIMIT = parseInt(process.env.REPO_LIMIT, 10) || 10;

// GitHub API functions
async function getRepoMetadata(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    default_branch: data.default_branch || "main",
  };
}

async function getContributorsCount(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    return 0;
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function getCommitsByUser(owner, repo, branch, username) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?author=${username}&sha=${branch}`,
    { headers: HEADERS }
  );
  if (!res.ok) {
    return [];
  }
  const commits = await res.json();
  return Array.isArray(commits) ? commits : [];
}

async function getCommitStats(owner, repo, sha) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}`,
    { headers: HEADERS }
  );
  if (!res.ok) {
    return { additions: 0, deletions: 0 };
  }
  const data = await res.json();
  return data.stats || { additions: 0, deletions: 0 };
}

async function getReposWithUserCommits(username) {
  let page = 1;
  const perPage = 100;
  const repos = new Set();

  try {
    while (true) {
      const res = await fetch(
        `${GITHUB_API}/search/commits?q=author:${username}&per_page=${perPage}&page=${page}`,
        {
          headers: {
            ...HEADERS,
            Accept: "application/vnd.github.cloak-preview",
          },
        }
      );

      if (!res.ok) {
        console.error(`GitHub API error: ${res.status} ${res.statusText}`);
        break;
      }

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
  } catch (error) {
    console.error("Error fetching repos:", error);
  }

  return Array.from(repos);
}

async function getMetricsForSolidity(username) {
  console.log(`\nStarting metrics collection for ${username}`);

  const repos = await getReposWithUserCommits(username);
  console.log(`Found ${repos.length} repositories:`, repos);

  const metrics = [];
  for (const repo of repos.slice(0, REPO_LIMIT)) {
    try {
      console.log(`\nProcessing repository: ${repo}`);
      const [owner, name] = repo.split("/");

      console.log("Fetching repo metadata...");
      const { stars, forks, default_branch } = await getRepoMetadata(
        owner,
        name
      );
      console.log(
        `Metadata: stars=${stars}, forks=${forks}, default_branch=${default_branch}`
      );

      console.log("Fetching contributors count...");
      const contributors = await getContributorsCount(owner, name);
      console.log(`Contributors count: ${contributors}`);

      console.log("Fetching commits...");
      const commits = await getCommitsByUser(
        owner,
        name,
        default_branch,
        username
      );
      console.log(`Found ${commits.length} commits`);

      let totalAdditions = 0;
      let productionCommits = 0;

      console.log("Processing commit stats...");
      for (const commit of commits) {
        const stats = await getCommitStats(owner, name, commit.sha);
        totalAdditions += stats.additions;
        if (commit.files) {
          const touchesProduction = commit.files.some(
            (file) =>
              file.filename.startsWith("src/") ||
              file.filename.startsWith("lib/")
          );
          if (touchesProduction) productionCommits++;
        }
      }

      console.log(
        `Stats: additions=${totalAdditions}, productionCommits=${productionCommits}`
      );

      metrics.push({
        stars,
        forks,
        contributors,
        commitsByUser: commits.length,
        totalAdditions,
        productionCommits,
      });
    } catch (error) {
      console.error(`Error processing repo ${repo}:`, error);
      // Continue with next repo
    }
  }
  return metrics;
}

describe("ContributionScoring", function () {
  // Increase timeout for API calls
  this.timeout(30000);

  let contract;

  before(async function () {
    if (!process.env.GITHUB_TOKEN) {
      console.warn("Warning: GITHUB_TOKEN not set in environment");
    }

    const ContributionScoring = await hre.ethers.getContractFactory(
      "ContributionScoring"
    );
    contract = await ContributionScoring.deploy();
    await contract.waitForDeployment();
  });

  it("calculates total score from real GitHub data", async function () {
    try {
      // Get real GitHub data
      const username = "mrizhakov";
      console.log(`\nFetching GitHub data for user: ${username}`);

      const metrics = await getMetricsForSolidity(username);
      console.log("\nFetched metrics:", JSON.stringify(metrics, null, 2));

      if (!metrics.length) {
        console.warn("Warning: No metrics data found");
      }

      // Format metrics for Solidity contract
      const formattedMetrics = metrics.map((m) => [
        m.stars,
        m.forks,
        m.contributors,
        m.commitsByUser,
        m.totalAdditions,
        m.productionCommits,
      ]);

      console.log("\nFormatted metrics for contract:", formattedMetrics);

      // Calculate score using the contract
      const score = await contract.calculateTotalScore(formattedMetrics);
      console.log("\nTotal Score:", score.toString());

      expect(score).to.be.gt(0);
    } catch (error) {
      console.error("\nTest failed with error:", error);
      throw error;
    }
  });
});

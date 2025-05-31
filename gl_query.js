require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("fs");

const GITLAB_USER = process.env.GITLAB_USER;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const REPO_LIMIT = parseInt(process.env.REPO_LIMIT, 10) || 5;
const LOG_FILE = "gl_query.log";

function logBoth(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + "\n");
}

if (!GITLAB_USER || !GITLAB_TOKEN) {
  logBoth("GITLAB_USER or GITLAB_TOKEN not set in .env");
  process.exit(1);
}

let apiRequestCount = 0;

async function getGitlabUserId(username) {
  // GitLab API: Search for user by username
  const url = `https://gitlab.com/api/v4/users?username=${username}`;
  apiRequestCount++;
  const res = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN,
    },
  });
  if (!res.ok) {
    logBoth(`Error searching for user ${username}: HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  // logBoth(`API response (getGitlabUserId): ${JSON.stringify(data, null, 2)}`);
  if (!data || data.length === 0) {
    logBoth(`User '${username}' not found on GitLab.`);
    return null;
  }
  logBoth(`User '${username}' found on GitLab (id: ${data[0].id}).`);
  return data[0].id;
}

async function getReposWithCommitsByUser(userId) {
  let page = 1;
  const perPage = 100;
  const repos = new Map();
  let hasMore = true;
  const seenProjectIds = new Set();
  let authorName = null;

  while (hasMore && repos.size < REPO_LIMIT) {
    // Search for projects the user contributed to
    const url = `https://gitlab.com/api/v4/users/${userId}/events?action=pushed&per_page=${perPage}&page=${page}`;
    apiRequestCount++;
    const res = await fetch(url, {
      headers: {
        "PRIVATE-TOKEN": GITLAB_TOKEN,
      },
    });
    if (!res.ok) {
      logBoth("GitLab API error: " + res.status + " " + (await res.text()));
      break;
    }
    const data = await res.json();
    if (!data || data.length === 0) break;
    for (const event of data) {
      if (!authorName && event.author && event.author.name) {
        authorName = event.author.name;
      }
      if (event.project_id && !seenProjectIds.has(event.project_id)) {
        seenProjectIds.add(event.project_id);
        // Fetch project info to get the name
        const projectInfo = await getProjectInfo(event.project_id);
        if (projectInfo && projectInfo.name) {
          repos.set(event.project_id, projectInfo.name);
        }
        if (repos.size >= REPO_LIMIT) break;
      }
    }
    hasMore = data.length === perPage && repos.size < REPO_LIMIT;
    page++;
  }
  return { repos, authorName };
}

async function getCommitCountForRepo(projectId, authorName) {
  // GitLab API: List repository commits, filter by author name
  let page = 1;
  let perPage = 100;
  let totalCommits = 0;
  let hasMore = true;
  while (hasMore) {
    const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/commits?author=${encodeURIComponent(
      authorName
    )}&per_page=${perPage}&page=${page}`;
    apiRequestCount++;
    const res = await fetch(url, {
      headers: {
        "PRIVATE-TOKEN": GITLAB_TOKEN,
      },
    });
    if (!res.ok) {
      logBoth(`Error fetching commits for project ${projectId}: ${res.status}`);
      break;
    }
    const data = await res.json();
    totalCommits += data.length;
    hasMore = data.length === perPage;
    page++;
  }
  return totalCommits;
}

async function getProjectInfo(projectId) {
  const url = `https://gitlab.com/api/v4/projects/${projectId}`;
  apiRequestCount++;
  const res = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN,
    },
  });
  if (!res.ok) {
    logBoth(
      `Error fetching project info for ID ${projectId}: HTTP ${res.status}`
    );
    return null;
  }
  const data = await res.json();
  logBoth(
    `API response (getProjectInfo, project ${projectId}): ${JSON.stringify(
      data,
      null,
      2
    )}`
  );
  return data;
}

function calculateRIS(stars, forks, contributors) {
  // RIS: Repository Importance Score
  return (
    Math.log2(stars + 1) * 2 + Math.log2(forks + 1) * 1.5 + contributors * 0.5
  );
}

async function getContributorsCount(projectId) {
  // GitLab API: List project members (approximates contributors)
  const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/contributors`;
  apiRequestCount++;
  const res = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN,
    },
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.length;
}

async function getCommitsByUser(projectId, authorName) {
  // Get all commits by user (paginated)
  let page = 1;
  let perPage = 100;
  let commits = [];
  let hasMore = true;
  while (hasMore) {
    const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/commits?author=${encodeURIComponent(
      authorName
    )}&per_page=${perPage}&page=${page}`;
    apiRequestCount++;
    const res = await fetch(url, {
      headers: {
        "PRIVATE-TOKEN": GITLAB_TOKEN,
      },
    });
    if (!res.ok) break;
    const data = await res.json();
    commits = commits.concat(data);
    hasMore = data.length === perPage;
    page++;
  }
  return commits;
}

async function getCommitStats(projectId, sha) {
  // GitLab API: Get a single commit (includes stats)
  const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/commits/${sha}`;
  apiRequestCount++;
  const res = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN,
    },
  });
  if (!res.ok) return { additions: 0, deletions: 0 };
  const data = await res.json();
  return data.stats || { additions: 0, deletions: 0 };
}

async function calculateContributionScore(projectId, name, authorName) {
  const projectInfo = await getProjectInfo(projectId);
  if (!projectInfo) return null;
  const stars = projectInfo.star_count;
  const forks = projectInfo.forks_count;
  const contributors = await getContributorsCount(projectId);
  const RIS = calculateRIS(stars, forks, contributors); // RIS: Repository Importance Score

  const commits = await getCommitsByUser(projectId, authorName);
  let totalAdditions = 0;
  let productionCommits = 0;
  for (const commit of commits) {
    const stats = await getCommitStats(projectId, commit.id);
    totalAdditions += stats.additions;
    // GitLab commit has 'stats' but not 'files', so we can't check file paths directly
    // Optionally, you could fetch the diff for each commit, but that's expensive
    // We'll skip productionCommits or set to 0 for now
  }
  // If you want to fetch diffs and check for src/ or lib/ files, add that logic here
  // For now, productionCommits = 0

  const CQS = commits.length * 2 + totalAdditions / 100; // CQS: Contribution Quality Score
  const PPB = productionCommits * 5; // PPB: Production Participation Bonus
  const finalScore = RIS * (CQS + PPB);

  // Log only the metrics used in the calculation
  logBoth(`\n--- Metrics for ${name} ---`);
  logBoth(`Stars: ${stars}`);
  logBoth(`Forks: ${forks}`);
  logBoth(`Contributors: ${contributors}`);
  logBoth(`Commits by user: ${commits.length}`);
  logBoth(`Total additions: ${totalAdditions}`);
  logBoth(`Production commits: ${productionCommits}`);
  logBoth(`RIS (Repository Importance Score): ${RIS}`);
  logBoth(`CQS (Contribution Quality Score): ${CQS}`);
  logBoth(`PPB (Production Participation Bonus): ${PPB}`);
  logBoth(`Final Score: ${Math.round(finalScore)}`);
  logBoth(
    `Formula: Final Score = (${RIS.toFixed(2)}) * (${CQS.toFixed(
      2
    )} + ${PPB.toFixed(2)}) = ${finalScore.toFixed(2)}`
  );
  logBoth(`--- End metrics ---\n`);

  return Math.round(finalScore);
}

(async () => {
  const userId = await getGitlabUserId(GITLAB_USER);
  if (!userId) {
    logBoth("Aborting: user not found.");
    return;
  }
  const { repos, authorName } = await getReposWithCommitsByUser(userId);
  logBoth("Repos identified for user '" + GITLAB_USER + "':");
  for (const [id, name] of repos.entries()) {
    logBoth(`  ID: ${id}, Name: ${name}`);
  }
  logBoth("Repos with commits by " + GITLAB_USER + ":");
  // Sort repos by name alphabetically
  const sortedRepos = Array.from(repos.entries()).sort((a, b) =>
    a[1].localeCompare(b[1])
  );
  const summary = [];
  for (const [id, name] of sortedRepos) {
    const score = authorName
      ? await calculateContributionScore(id, name, authorName)
      : null;
    if (score !== null) summary.push({ repo: name, score });
  }
  // Print summary
  logBoth("\n===== Contribution Score Summary =====");
  for (const entry of summary) {
    logBoth(`${entry.repo}: ${entry.score} points`);
  }
  logBoth("======================================\n");
  logBoth(`Total API requests made: ${apiRequestCount}`);
})();

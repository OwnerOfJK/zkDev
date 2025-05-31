require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("fs");

const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_LIMIT = parseInt(process.env.REPO_LIMIT, 10) || 5;
const LOG_FILE = "gh_query2.log";

function logBoth(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + "\n");
}

if (!GITHUB_USER || !GITHUB_TOKEN) {
  logBoth("GITHUB_USER or GITHUB_TOKEN not set in .env");
  process.exit(1);
}

let apiRequestCount = 0;

async function getReposWithCommitsByUser(username) {
  const perPage = 100;
  let page = 1;
  const repos = new Map();
  let hasMore = true;

  while (hasMore && page <= 10 && repos.size < REPO_LIMIT) {
    // limit to 1000 results for safety
    const url = `https://api.github.com/search/commits?q=author:${username}&per_page=${perPage}&page=${page}`;
    apiRequestCount++;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.cloak-preview", // required for commit search
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    if (!res.ok) {
      console.error("GitHub API error:", res.status, await res.text());
      break;
    }
    const data = await res.json();
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

async function getCommitCountForRepo(owner, repo, username) {
  apiRequestCount++;
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${username}&per_page=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
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
    // Parse the last page number from the link header
    const match = link.match(/&page=(\d+)>; rel="last"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  // If no link header, check the number of items returned
  const data = await res.json();
  return data.length;
}

(async () => {
  const repos = await getReposWithCommitsByUser(GITHUB_USER);
  logBoth("Repos with commits by " + GITHUB_USER + ":");
  // Sort repos by name alphabetically
  const sortedRepos = Array.from(repos.entries()).sort((a, b) =>
    a[1].localeCompare(b[1])
  );
  for (const [id, name] of sortedRepos) {
    // Get owner from repo API (need to fetch full repo info)
    const repoUrl = `https://api.github.com/repositories/${id}`;
    apiRequestCount++;
    const repoRes = await fetch(repoUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    if (!repoRes.ok) {
      logBoth(
        `Error fetching repo info for ID ${id}, Name ${name}: HTTP ${repoRes.status}`
      );
      continue;
    }
    const repoInfo = await repoRes.json();
    const owner = repoInfo.owner.login;
    const commitCount = await getCommitCountForRepo(owner, name, GITHUB_USER);

    // Get stars, forks, and views
    // For views, need to use traffic API
    let stars = repoInfo.stargazers_count;
    let forks = repoInfo.forks_count;
    let views = null;
    try {
      const viewsUrl = `https://api.github.com/repos/${owner}/${name}/traffic/views`;
      apiRequestCount++;
      const viewsRes = await fetch(viewsUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      });
      if (viewsRes.ok) {
        const viewsData = await viewsRes.json();
        views = viewsData.count;
      }
    } catch (e) {
      // ignore errors for views
    }

    logBoth(
      `ID: ${id}, Name: ${name}, Commits by ${GITHUB_USER}: ${commitCount}, Stars: ${stars}, Forks: ${forks}, Views: ${
        views !== null ? views : "N/A"
      }`
    );
  }
  logBoth(`Total API requests made: ${apiRequestCount}`);
})();

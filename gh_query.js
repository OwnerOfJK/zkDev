require("dotenv").config();
const fetch = require("node-fetch");
const path = require("path");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

// List of file extensions considered as code/text (expand as needed)
const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".html",
  ".css",
  ".json",
  ".md",
  ".sh",
  ".yml",
  ".yaml",
  ".xml",
  ".swift",
  ".kt",
  ".m",
  ".pl",
  ".scala",
  ".sql",
  ".txt",
];

function isCodeFile(filename) {
  return CODE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJSON(url, timeoutMs = 20000, retryCount = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset");
      const retryAfter = res.headers.get("retry-after");
      console.log(`Rate limit headers for ${url}:`);
      console.log(`  x-ratelimit-remaining: ${remaining}`);
      console.log(`  x-ratelimit-reset: ${reset}`);
      console.log(`  retry-after: ${retryAfter}`);
      if (remaining === "0" && reset) {
        const now = Math.floor(Date.now() / 1000);
        const waitSec = Math.max(parseInt(reset) - now, 1);
        console.log(
          `Rate limit exceeded. Waiting ${waitSec} seconds until reset...`
        );
        await sleep(waitSec * 1000);
        if (retryCount < 5) return fetchJSON(url, timeoutMs, retryCount + 1);
        throw new Error(
          `Rate limit exceeded and max retries reached for ${url}`
        );
      } else if (retryAfter) {
        const waitSec = parseInt(retryAfter);
        console.log(
          `Secondary rate limit. Waiting ${waitSec} seconds before retrying...`
        );
        await sleep(waitSec * 1000);
        if (retryCount < 5) return fetchJSON(url, timeoutMs, retryCount + 1);
        throw new Error(
          `Secondary rate limit and max retries reached for ${url}`
        );
      } else {
        // Exponential backoff for unknown secondary rate limit
        const waitSec = Math.pow(2, retryCount + 1);
        console.log(
          `Possible secondary rate limit. Waiting ${waitSec} seconds before retrying...`
        );
        await sleep(waitSec * 1000);
        if (retryCount < 5) return fetchJSON(url, timeoutMs, retryCount + 1);
        throw new Error(
          `Secondary rate limit and max retries reached for ${url}`
        );
      }
    }
    if (!res.ok) {
      if (res.status === 409) return { skip: true, status: 409 };
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    console.error(`Error fetching ${url}: ${e.message}`);
    throw e;
  }
}

async function getAllUserRepos(username) {
  let repos = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`;
    const data = await fetchJSON(url);
    repos = repos.concat(data);
    hasMore = data.length === 100;
    page++;
  }
  return repos;
}

async function userHasCommitsOnBranch(repoFullName, branch, username) {
  const url = `https://api.github.com/repos/${repoFullName}/commits?sha=${branch}&author=${username}&per_page=1`;
  const data = await fetchJSON(url);
  if (data.skip && data.status === 409) return "skip";
  return data.length > 0;
}

async function getLatestCommitSha(repoFullName, branch) {
  const url = `https://api.github.com/repos/${repoFullName}/commits/${branch}`;
  const data = await fetchJSON(url);
  return data.sha;
}

async function getTree(repoFullName, sha) {
  const url = `https://api.github.com/repos/${repoFullName}/git/trees/${sha}?recursive=1`;
  const data = await fetchJSON(url);
  if (!data.tree) return [];
  return data.tree.filter((item) => item.type === "blob");
}

async function getFileContent(repoFullName, fileSha) {
  const url = `https://api.github.com/repos/${repoFullName}/git/blobs/${fileSha}`;
  const data = await fetchJSON(url);
  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return "";
}

async function getCommitCount(repoFullName, branch, username) {
  // Build the URL for commits on the branch, optionally filtered by author
  let url = `https://api.github.com/repos/${repoFullName}/commits?sha=${branch}&per_page=1`;
  if (username) url += `&author=${username}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    if (res.status === 409) return 0; // Empty branch
    throw new Error(`Failed to fetch commits: ${res.status}`);
  }

  // Check for pagination
  const link = res.headers.get("link");
  if (!link) {
    // Only one page, check if there is a commit
    const data = await res.json();
    return data.length;
  }

  // Parse the 'last' page number from the Link header
  const match = link.match(/&page=(\d+)>; rel="last"/);
  if (match) {
    return parseInt(match[1], 10);
  } else {
    // Fallback: only one page
    const data = await res.json();
    return data.length;
  }
}

async function countLinesInRepo(repoFullName, branch) {
  try {
    console.log(
      `  Getting latest commit SHA for ${repoFullName} (${branch})...`
    );
    const sha = await getLatestCommitSha(repoFullName, branch);
    console.log(`  Getting tree for commit ${sha}...`);
    const files = await getTree(repoFullName, sha);
    let totalLines = 0;
    let fileCount = 0;
    for (const file of files) {
      fileCount++;
      if (file.size > 1000000) {
        console.log(
          `    Skipping large file: ${file.path} (${file.size} bytes)`
        );
        continue;
      }
      if (!isCodeFile(file.path)) {
        console.log(`    Skipping non-code file: ${file.path}`);
        continue;
      }
      let content = "";
      try {
        console.log(
          `    Fetching file ${file.path} (${fileCount}/${files.length})...`
        );
        content = await getFileContent(repoFullName, file.sha);
      } catch (e) {
        if (e.message.includes("403")) {
          throw new Error(`403 error for repo ${repoFullName}`);
        }
        console.log(`    Error fetching file ${file.path}: ${e.message}`);
        continue;
      }
      const nonPrintable = (content.match(/[^\x09-\x0d\x20-\x7e]/g) || [])
        .length;
      if (content.length > 0 && nonPrintable / content.length > 0.1) {
        console.log(`    Skipping binary file: ${file.path}`);
        continue;
      }
      const lineCount = content.split("\n").length;
      totalLines += lineCount;
      console.log(`    Counted ${lineCount} lines in ${file.path}`);
    }
    return totalLines;
  } catch (e) {
    if (e.message.includes("403")) {
      throw new Error(`403 error for repo ${repoFullName}`);
    }
    throw e;
  }
}

async function main() {
  const repos = await getAllUserRepos(USERNAME);
  const result = [];
  for (const repo of repos) {
    const branch = repo.default_branch;
    if (!branch) {
      console.log(
        `Skipping repo (no default branch): ${repo.full_name}, ID: ${repo.id}`
      );
      continue;
    }
    let hasCommits;
    try {
      hasCommits = await userHasCommitsOnBranch(
        repo.full_name,
        branch,
        USERNAME
      );
    } catch (e) {
      console.log(
        `Skipping repo (error): ${repo.full_name}, ID: ${repo.id} (${e.message})`
      );
      continue;
    }
    if (hasCommits === "skip") {
      console.log(
        `Skipping repo (empty or missing branch): ${repo.full_name}, ID: ${repo.id}`
      );
      continue;
    }
    if (hasCommits) {
      result.push({ name: repo.full_name, id: repo.id, branch });
      console.log(`Repo: ${repo.full_name}, ID: ${repo.id}`);
    }
  }

  for (const repo of result) {
    try {
      console.log(
        `\nProcessing repo: ${repo.name} (ID: ${repo.id}, branch: ${repo.branch})`
      );
      const lineCount = await countLinesInRepo(repo.name, repo.branch);
      console.log(
        `Lines in ${repo.name} (ID: ${repo.id}, branch: ${repo.branch}): ${lineCount}`
      );
    } catch (e) {
      if (e.message.includes("403")) {
        console.log(
          `403 error for repo ${repo.name}, skipping to next repository.`
        );
        continue;
      }
      console.log(`Error counting lines for ${repo.name}: ${e.message}`);
    }
  }
}

main().catch(console.error);

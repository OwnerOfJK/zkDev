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

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    // Return a special object for 409 errors (empty repo or missing branch)
    if (res.status === 409) return { skip: true, status: 409 };
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
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

async function countLinesInRepo(repoFullName, branch) {
  const sha = await getLatestCommitSha(repoFullName, branch);
  const files = await getTree(repoFullName, sha);
  let totalLines = 0;
  for (const file of files) {
    if (file.size > 1000000) continue; // skip large files
    if (!isCodeFile(file.path)) continue; // skip non-code files
    let content = "";
    try {
      content = await getFileContent(repoFullName, file.sha);
    } catch (e) {
      continue; // skip files that can't be fetched
    }
    // crude binary check: skip if >10% non-printable chars
    const nonPrintable = (content.match(/[^\x09-\x0d\x20-\x7e]/g) || []).length;
    if (content.length > 0 && nonPrintable / content.length > 0.1) continue;
    totalLines += content.split("\n").length;
  }
  return totalLines;
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

  // For each repo, count and log the number of lines in the current branch (code/text files only)
  for (const repo of result) {
    try {
      const lineCount = await countLinesInRepo(repo.name, repo.branch);
      console.log(
        `Lines in ${repo.name} (ID: ${repo.id}, branch: ${repo.branch}): ${lineCount}`
      );
    } catch (e) {
      console.log(`Error counting lines for ${repo.name}: ${e.message}`);
    }
  }
}

main().catch(console.error);

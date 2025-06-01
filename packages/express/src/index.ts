// @ts-nocheck
import express, { Request, Response, NextFunction, Application } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createVlayerClient } from '@vlayer/sdk';
import {
  getConfig,
  createContext,
  deployVlayerContracts,
  writeEnvVariables,
} from '@vlayer/sdk/config';
import proverSpec from "../../foundry/out/GithubProover.sol/GithubProver.json" assert { type: "json" };
import fetch from 'node-fetch';
import * as fs from 'fs';

dotenv.config();

const execAsync = promisify(exec);

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      provider: string;
      accessToken: string;
      photos?: { value: string }[];
      [key: string]: any;
    }
  }
}

const app: Application = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport session setup
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

passport.deserializeUser((obj: Express.User, done) => {
  done(null, obj);
});

// GitHub Strategy configuration
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback'
  },
  (accessToken: string, _refreshToken: string, profile: any, done: any) => {
    console.log(accessToken, profile);
    // Store the access token in the user object
    const user = {
      ...profile,
      accessToken
    };
    process.nextTick(() => {
      return done(null, user);
    });
  }
));

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) { 
    return next(); 
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Auth routes
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/github/error' }),
  (_req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
  }
);

// Get user data
app.get('/auth/user', ensureAuthenticated, (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  
  const userInfo = {
    id: req.user.id,
    displayName: req.user.username,
    provider: req.user.provider,
    accessToken: req.user.accessToken
  };
  res.json(userInfo);
});

app.get('/auth/github/error', (_req: Request, res: Response) => {
  res.status(400).json({ error: 'Error logging in via Github' });
});

app.get('/auth/signout', (req: Request, res: Response) => {
  req.logout(() => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`);
  });
});

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

// Get GitHub activity
app.get('/auth/github/activity', ensureAuthenticated, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  try {
    const accessToken = req.user.accessToken;
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const headers = {
      Authorization: `token ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    // Fetch user's repositories
    const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers,
    });
    const repositories = (await reposResponse.json()) as GitHubRepository[];

    // Fetch commits using search API
    const commitsResponse = await fetch(`https://api.github.com/search/commits?q=author:${req.user.username}&per_page=100`, {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.cloak-preview', // required for commit search
      },
    });
    const commitsData = (await commitsResponse.json()) as GitHubSearchResponse<GitHubCommit>;
    const commits = commitsData.items || [];

    // Calculate commit counts per repository
    const commitCounts = new Map<number, number>();
    commits.forEach(commit => {
      const repoId = commit.repository.id;
      commitCounts.set(repoId, (commitCounts.get(repoId) || 0) + 1);
    });

    // Add commit counts to repositories
    const repositoriesWithCommits = repositories.map(repo => ({
      ...repo,
      commit_count: commitCounts.get(repo.id) || 0
    }));

    // Fetch user's pull requests
    const prsResponse = await fetch(`https://api.github.com/search/issues?q=author:${req.user.username}+is:pr&per_page=100`, {
      headers,
    });
    const prsData = (await prsResponse.json()) as GitHubSearchResponse<GitHubIssue>;
    const pullRequests = prsData.items || [];

    // Fetch user's issues
    const issuesResponse = await fetch(`https://api.github.com/search/issues?q=author:${req.user.username}+is:issue&per_page=100`, {
      headers,
    });
    const issuesData = (await issuesResponse.json()) as GitHubSearchResponse<GitHubIssue>;
    const issues = issuesData.items || [];

    // Log the response sizes for debugging
    console.log('Response sizes:', {
      repositories: repositoriesWithCommits.length,
      commits: commits.length,
      pullRequests: pullRequests.length,
      issues: issues.length,
    });

    res.json({
      commits,
      pullRequests,
      issues,
      repositories: repositoriesWithCommits,
    });
  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch GitHub activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

interface GitHubCommitSearchItem {
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

// Get leaderboard data
app.get('/auth/github/leaderboard', async (_req: Request, res: Response) => {
  try {
    // For now, we'll use a mock array of users
    // In a real application, you would fetch this from your database
    const users = [
      { username: 'user1', avatar_url: 'https://github.com/identicons/user1.png' },
      { username: 'user2', avatar_url: 'https://github.com/identicons/user2.png' },
      // Add more users as needed
    ];

    const leaderboardData = await Promise.all(
      users.map(async (user) => {
        try {
          const response = await fetch(`https://api.github.com/search/commits?q=author:${user.username}&per_page=100`, {
            headers: {
              Accept: 'application/vnd.github.cloak-preview',
            },
          });
          const data = await response.json() as GitHubSearchResponse<GitHubCommitSearchItem>;
          return {
            username: user.username,
            avatar_url: user.avatar_url,
            total_commits: data.total_count || 0,
            repositories: data.items?.map(item => item.repository.name) || [],          };
        } catch (error) {
          console.error(`Error fetching data for user ${user.username}:`, error);
          return {
            username: user.username,
            avatar_url: user.avatar_url,
            total_commits: 0,
            repositories: [],
          };
        }
      })
    );

    // Sort by total commits in descending order
    const sortedLeaderboard = leaderboardData.sort((a, b) => b.total_commits - a.total_commits);

    res.json(sortedLeaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Test route
app.get('/test', (_req: Request, res: Response): void => {
  res.json({ message: 'Express server is working!' });
});

/*===========================
  Web proof generation
===========================*/

// Add this new endpoint before the catch-all route
app.get("/api/github/proof", ensureAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Starting web proof generation...");
    
    if (!req.user) {
      console.log("No user found in request");
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = req.user as Express.User;
    console.log("User found:", { 
      id: user.id, 
      username: user.username,
      hasAccessToken: !!user.accessToken 
    });

    const username = user.username;

    // Get data from Github API + notarize each request
    await queryGithub(username);
    } catch (error) {
      console.error("Detailed error in web proof generation:", error);
      res.status(500).json({ 
        error: "Failed to generate proof", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }


  });
    /*const githubUrl = `https://api.github.com/search/commits?q=author:${username}&per_page=1`;
    
    // First, let's fetch and log the GitHub response
    console.log("Fetching GitHub data from:", githubUrl);
    const githubResponse = await fetch(githubUrl, {
      headers: {
        Authorization: `token ${user.accessToken}`,
        Accept: "application/vnd.github.cloak-preview",
      },
    });
    
    const githubData = await githubResponse.json();
    console.log("GitHub API Response:", JSON.stringify(githubData, null, 2));
    console.log("Response size:", JSON.stringify(githubData).length, "bytes");

    // Now generate the proof with the same URL
    const command = `vlayer web-proof-fetch \
      --notary "https://test-notary.vlayer.xyz" \
      --url "${githubUrl}" \
      -H "Authorization: token ${user.accessToken}" \
      -H "Accept: application/vnd.github.cloak-preview"`;

    console.log("Executing command:", command);

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.error("vlayer error output:", stderr);
      res.status(500).json({ error: "Failed to generate proof", details: stderr });
      return;
    }

    console.log("Proof generated successfully");
    console.log("Proof length:", stdout.length);
    */

    // Return both the proof and the GitHub data for debugging
    /*res.json({ 
      proof: stdout,
      githubData: githubData
    });
    console.log(githubData);
  } catch (error) {
    console.error("Detailed error in web proof generation:", error);
    res.status(500).json({ 
      error: "Failed to generate proof", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});*/

/*===========================
  Queries to github API
===========================*/


// const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_LIMIT = process.env.REPO_LIMIT ? parseInt(process.env.REPO_LIMIT, 10) : 5;
const LOG_FILE = "gh_query2.log";

async function fetchProof(url: string): Promise<string> {

  console.log("Fetching proof for URL:", url);
  
  const command = `vlayer web-proof-fetch \
      --notary "https://test-notary.vlayer.xyz" \
      --url "${url}" \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github.cloak-preview" \
      --max-recv-data 9000`;
      console.log("Executing command:", command);
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        console.error("vlayer error output:", stderr);
        //res.status(500).json({ error: "Failed to generate proof", details: stderr });
        //return;
      }
      /*await exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing command: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`, stdout.length);
        console.error(`stderr: ${stderr}`);
      });*/
      console.log("Proof generated successfully");
      console.log("Proof length:", stdout.length);
      return stdout;
}

function logBoth(message:string) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + "\n");
}

if ( !GITHUB_TOKEN) {
  logBoth("GITHUB_TOKEN not set in .env");
  process.exit(1);
}

let apiRequestCount = 0;

async function getReposWithCommitsByUser(username:string) {
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

const prover = process.env.VITE_PROVER_ADDRESS ; 
const verifier = process.env.VITE_VERIFIER_ADDRESS ; 

//@ts-ignore
async function callProver(webProof:string) {
  console.log("Calling prover");
  
  const vlayer = createVlayerClient();
  const config = getConfig(); //also in _deploy.ts
  const { chain, _ethClient, _account, _proverUrl, _confirmations, _notaryUrl } =
    createContext(config);
  
  console.log("⏳ Proving...");
  const hash = await vlayer.prove({
    address: prover,
    functionName: "main",
    proverAbi: proverSpec.abi,
    args: [
      {
        webProofJson: webProof,//.toString(),
      },
    ],
    chainId: chain.id,
    gasLimit: config.gasLimit,
  });
  const result = await vlayer.waitForProvingResult({ hash });
  const [_proof, _avgPrice] = result;
  console.log("✅ Proof generated");
}

async function getCommitCountForRepo(owner:string, repo:string, username:string) {
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
  const webProof = await fetchProof(url); //let's make them in parallel
  callProver(webProof);
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

const queryGithub = async (username:string) => {
(async () => {
  const repos = await getReposWithCommitsByUser(username);
  logBoth("Repos with commits by " + username + ":");
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
    const commitCount = await getCommitCountForRepo(owner, name, username);

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
      `ID: ${id}, Name: ${name}, Commits by ${username}: ${commitCount}, Stars: ${stars}, Forks: ${forks}, Views: ${
        views !== null ? views : "N/A"
      }`
    );
  }
  logBoth(`Total API requests made: ${apiRequestCount}`);
})();
}

//===========================
// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

export default app;

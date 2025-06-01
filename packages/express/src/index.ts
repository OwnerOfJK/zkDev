import express, { Request, Response, NextFunction, Application } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GitLabStrategy } from 'passport-gitlab2';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateGitHubProof } from './github';

dotenv.config();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      provider: string;
      accessToken: string;
      photos?: { value: string }[];
      [key: string]: unknown;
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
    //console.log(accessToken, profile);
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

// GitLab Strategy configuration
passport.use(new GitLabStrategy({
    clientID: process.env.GITLAB_CLIENT_ID || '',
    clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    callbackURL: process.env.GITLAB_CALLBACK_URL || 'http://localhost:4000/auth/gitlab/callback'
  },
  (accessToken: string, _refreshToken: string, profile: any, done: any) => {
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
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/account`);
  }
);

// GitLab auth routes
app.get('/auth/gitlab',
  passport.authenticate('gitlab', { scope: ['read_user'] })
);

app.get('/auth/gitlab/callback',
  passport.authenticate('gitlab', { failureRedirect: '/auth/gitlab/error' }),
  (_req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/account`);
  }
);

app.get('/auth/gitlab/error', (_req: Request, res: Response) => {
  res.status(400).json({ error: 'Error logging in via GitLab' });
});

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

interface GitHubLanguage {
  [key: string]: number;
}

interface GitHubStats {
  totalAccounts: number;
  totalRepos: number;
  totalCommits: number;
  totalStars: number;
  totalForks: number;
  topLanguages: Array<{
    name: string;
    count: number;
  }>;
}

// Helper function to get language stats for a repository
async function getRepositoryLanguages(owner: string, repo: string, accessToken: string): Promise<GitHubLanguage> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  const data = await response.json() as GitHubLanguage;
  // Filter out the status field if it exists
  const { status, ...languages } = data;
  console.log(languages);
  return languages;
}

// Get GitHub stats
app.get('/auth/github/stats', ensureAuthenticated, async (req: Request, res: Response) => {
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
        Accept: 'application/vnd.github.cloak-preview',
      },
    });
    const commitsData = (await commitsResponse.json()) as GitHubSearchResponse<GitHubCommit>;

    // Calculate total stats
    const totalRepos = repositories.length;
    const totalCommits = commitsData.total_count || 0;
    const totalStars = repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repositories.reduce((sum, repo) => sum + repo.forks_count, 0);

    // Get language stats for each repository
    const languageStats = new Map<string, number>();
    for (const repo of repositories) {
      const languages = await getRepositoryLanguages(req.user.username, repo.name, accessToken);
      for (const [lang, bytes] of Object.entries(languages)) {
        languageStats.set(lang, (languageStats.get(lang) || 0) + bytes);
      }
    }

    // Convert language stats to array and sort by count
    const topLanguages = Array.from(languageStats.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Get top 5 languages

    const stats: GitHubStats = {
      totalAccounts: 1, // For now, we only support one account
      totalRepos,
      totalCommits,
      totalStars,
      totalForks,
      topLanguages,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching GitHub stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch GitHub stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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

    const { proof,  } = await generateGitHubProof(user.username, user.accessToken);
    
    // Return only the proof
    res.json({ proof });
  } catch (error) {
    console.error("Detailed error in web proof generation:", error);
    res.status(500).json({ 
      error: "Failed to generate proof", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Add new endpoint for calling the prover
app.post("/api/github/prove", ensureAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const { webProof } = req.body;
    
    if (!webProof) {
      res.status(400).json({ error: "No web proof provided" });
      return;
    }

    // Forward the proof to the frontend for processing
    res.json({ 
      success: true, 
      message: "Proof received, please process it on the frontend using the vlayer SDK"
    });
  } catch (error) {
    console.error("Error in prover call:", error);
    res.status(500).json({ 
      error: "Failed to process proof", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

export default app;

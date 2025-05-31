import express, { Request, Response, NextFunction, Application } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      provider: string;
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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Test route
app.get('/test', (_req: Request, res: Response): void => {
  res.json({ message: 'Express server is working!' });
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

export default app;

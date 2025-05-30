import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import config from '../config/env';

const router = express.Router();

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface GithubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  [key: string]: any;
}

router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json() as TokenResponse;
    
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error });
    }
    
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });

    const userData = await userResponse.json() as GithubUser;
    res.json(userData);
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Initiate GitHub OAuth flow
router.get('/github', (_req: Request, res: Response) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&scope=user`;
  res.redirect(redirectUrl);
});

export default router;
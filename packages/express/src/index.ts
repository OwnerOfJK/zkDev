import express, { Request, Response, NextFunction, Application } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { createVlayerClient } from "@vlayer/sdk";
import { createExtensionWebProofProvider } from '@vlayer/sdk/web_proof'
import {
  startPage,
  expectUrl,
  notarize,
} from '@vlayer/sdk/web_proof'
import webProofProver from "../out/WebProofProver.sol/WebProofProver.json";

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
    clientSecret: process.env.GITHUB_SECRET_KEY || '',
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback'
  },
  (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
    // For simplicity, we're just returning the GitHub profile
    // In a real app, you'd want to store this in a database
    process.nextTick(() => {
      return done(null, profile);
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
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success`);
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
    provider: req.user.provider
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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Test route
app.get('/test', (_req: Request, res: Response): void => {
  res.json({ message: 'Express server is working!' });
});

// Test vlayer route
app.get('/test-vlayer', (_req: Request, res: Response): void => {
  testVlayer();
  res.json({ message: 'Vlayer server is working!' });
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

export default app;


async function testVlayer() {
  const vlayer = createVlayerClient(); //just for broser extension ? 
  console.log(vlayer);
  /*const hash = await vlayer.prove({
    address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    proverAbi: proverSpec.abi,
    functionName: 'main',
    args: ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 123],
    chainId: chain.id,
  });*/

  const webProofProvider = createExtensionWebProofProvider({
    wsProxyUrl: "ws://localhost:3003",
  })
  //default providers: 
  //notaryUrl: https://test-notary.vlayer.xyz
  //wsProxyUrl: wss://test-wsproxy.vlayer.xyz


  // all args required by prover contract function except webProof itself
  const commitmentArgs = ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045']

  const proverCallCommitment = {
    address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    functionName: 'main',
    commitmentArgs,
    chainId: process.env.VLAYER_PROVER_CHAIN,
    proverAbi: webProofProver.abi,
  }

  webProofProvider.requestWebProof({
    proverCallCommitment,
    logoUrl: 'http://twitterswap.com/logo.png',
    steps: [
      startPage('https://x.com/i/flow/login', 'Go to x.com login page'),
      expectUrl('https://x.com/home', 'Log in'),
      notarize('https://api.x.com/1.1/account/settings.json', 'GET', 'Generate Proof of Twitter profile', []),
    ],
  });

  webProofProvider.addEventListeners(
    ExtensionMessageType.ProofDone,
    ({ payload: { presentationJson } }) => {
      const webProof = JSON.stringify({ presentationJson });
      prove(webProof);
    },
  );


}
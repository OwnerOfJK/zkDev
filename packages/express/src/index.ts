import express, { Request, Response, NextFunction, Application } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
/*import { createVlayerClient } from "@vlayer/sdk";
import { createExtensionWebProofProvider } from '@vlayer/sdk/web_proof'
import {
  startPage,
  expectUrl,
  notarize,
} from '@vlayer/sdk/web_proof'
import webProofProver from "../out/WebProofProver.sol/WebProofProver.json";
import { sepolia } from 'viem/chains'
import { proverAbi } from './proverAbi'*/

 
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


// <reference types="bun" />

import { createVlayerClient } from "@vlayer/sdk";
//import proverSpec from "../out/WebProofProver.sol/WebProofProver.json";
//import verifierSpec from "../out/WebProofVerifier.sol/WebProofVerifier.json";
import proverSpec from "../out/KrakenProver.sol/KrakenProver.json";
import verifierSpec from "../out/KrakenVerifier.sol/KrakenVerifier.json";
import {
  getConfig,
  createContext,
  //deployVlayerContracts,
  //writeEnvVariables,
} from "@vlayer/sdk/config";
import { exec } from 'child_process';


async function testVlayer() {
  const URL_TO_PROVE = "https://api.kraken.com/0/public/Ticker?pair=ETHUSD";

  const prover = process.env.VITE_PROVER_ADDRESS ; 
  const verifier = process.env.VITE_VERIFIER_ADDRESS ; 
  
  console.log("👉 Starting proving with contracts ",{ prover, verifier });
  
  const config = getConfig(); //also in _deploy.ts
  const { chain, ethClient, account, proverUrl, confirmations, notaryUrl } =
    createContext(config);
  
  async function generateWebProof() {

    console.log("⏳ Generating web proof...");
    
      exec(`vlayer web-proof-fetch --notary ${notaryUrl} --url ${URL_TO_PROVE}`,(error, stdout, stderr) => {
      if (error) {
        console.error('Error: ${error.message}');
        return;
      }
      if (stderr) {
        console.error('stderr: ${stderr}');
        return;
      }
      console.log('stdout:\n${stdout}');
      return stdout.toString();
    });
    
  }
    
  
  const webProof = await generateWebProof();
  
  const vlayer = createVlayerClient({ // also in _deploy.ts
    url: proverUrl,
    token: config.token,
  });
  
  
  console.log("⏳ Proving...");
  const hash = await vlayer.prove({
    address: `0x${prover}`,
    functionName: "main",
    proverAbi: proverSpec.abi,
    args: [
      {
        webProofJson: webProof.toString(),
      },
    ],
    chainId: chain.id,
    gasLimit: config.gasLimit,
  });
  const result = await vlayer.waitForProvingResult({ hash });
  const [proof, avgPrice] = result;
  console.log("✅ Proof generated");
  console.log("👉 Avg price:", avgPrice);
  console.log("👉 Reading contract...");
  const avgPriceInVerifier = await ethClient.readContract({
    address: `0x${verifier}`,
    abi: verifierSpec.abi,
    functionName: "avgPrice",
  });
  console.log("👉 Avg price in verifier:", avgPriceInVerifier);
  
  console.log("⏳ Verifying...");
  
  // Workaround for viem estimating gas with `latest` block causing future block assumptions to fail on slower chains like mainnet/sepolia
  const gas = await ethClient.estimateContractGas({
    address: verifier,
    abi: verifierSpec.abi,
    functionName: "verify",
    args: [proof, avgPrice],
    account,
    blockTag: "pending",
  });
  
  const txHash = await ethClient.writeContract({
    address: verifier,
    abi: verifierSpec.abi,
    functionName: "verify",
    args: [proof, avgPrice],
    chain,
    account,
    gas,
  });
  
  await ethClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations,
    retryCount: 60,
    retryDelay: 1000,
  });
  
  console.log("✅ Verified!");
  console.log("👉 Reading contract...");
  const avgPriceInVerifier2 = await ethClient.readContract({
    address: verifier,
    abi: verifierSpec.abi,
    functionName: "avgPrice",
  });
  console.log("👉 Avg price in verifier:", avgPriceInVerifier2);
}
/*
async function testVlayer() {
  const vlayer = createVlayerClient(); //just for browser extension ? 
  console.log(vlayer);*/
  /*const hash = await vlayer.prove({
    address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    proverAbi: proverSpec.abi,
    functionName: 'main',
    args: ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 123],
    chainId: chain.id,
  });*/
/*
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


function prove(webProof) {
  const hash = await vlayer.prove({
    
      ...proverCallCommitment,
      args: [webProof, ...commitmentArgs],
  })
}*/
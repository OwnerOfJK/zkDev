# Express API Server

Backend API server built with Express and TypeScript for the zkDev project.

## Features

- GitHub OAuth authentication
- TypeScript for type safety
- Environment variable configuration

## Getting Started

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Create a `.env` file based on `.env.example`:
   ```
   PORT=4000
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

3. Start development server:
   ```bash
   yarn dev
   ```

4. Build for production:
   ```bash
   yarn build
   ```

5. Start production server:
   ```bash
   yarn start
   ```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - GitHub OAuth callback endpoint
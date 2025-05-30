# zkDev - Web3 Developer Contribution Verification Hub

## Overview

zkDev is a developer-focused platform that enables Web3 projects to identify and reward genuine contributors based on verifiable GitHub activity and contributions. Using zero-knowledge proofs, developers can cryptographically prove their contributions while maintaining privacy over sensitive repository data.

## Core Features

- **Contribution Verification**: Generate zero-knowledge proofs to verify your GitHub contributions without revealing private repository data
- **Developer Identity**: Create a pseudonymous on-chain developer identity backed by verifiable credentials
- **Email Verification**: Account abstraction and recovery through email verification proofs
- **Airdrop Qualification**: Automatically qualify for ecosystem airdrops based on verified contribution metrics
- **Project Targeting**: Enable projects to airdrop tokens specifically to developers in their ecosystem (e.g., Starknet targeting Cairo developers)

## Technical Stack

- **Frontend**: Next.js with RainbowKit for wallet connection
- **Backend**: Express.js with TypeScript
- **Authentication**: GitHub OAuth for initial identity verification
- **Zero-Knowledge Proofs**: Verifiable credentials for private repository data
- **Blockchain Integration**: Ethereum and EVM-compatible chains

## How It Works

1. **Login**: Developers authenticate with their GitHub account
2. **Proof Generation**: The platform generates zero-knowledge proofs to verify:
   - Private repository contributions (using Vlayer)
   - Public GitHub activity (using Flare)
   - Email ownership for account recovery
3. **Profile Creation**: A developer profile is created with verifiable credentials
4. **Qualification**: Developers meeting contribution thresholds qualify for ecosystem airdrops
5. **Targeted Distribution**: Projects can distribute tokens to developers with specific skills or contribution history

## Privacy Features

- Private repository data remains confidential
- Only proof of contributions is stored on-chain, not the actual contribution data
- Pseudonymous identity options for privacy-conscious developers

## Use Cases

- **Project Airdrops**: Web3 projects can airdrop tokens to relevant developers (e.g., Starknet to Cairo developers)
- **Contribution Verification**: Prove your expertise and contributions without revealing private work
- **Developer Reputation**: Build a verifiable on-chain developer reputation
- **Ecosystem Growth**: Connect projects with their most valuable potential contributors

## Getting Started

### Prerequisites

- Node.js v16+
- Yarn package manager
- GitHub OAuth App credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zkDev.git
cd zkDev

# Install dependencies
yarn install

# Set up environment variables
cp packages/nextjs/.env.example packages/nextjs/.env.local
cp packages/express/.env.example packages/express/.env

# Configure GitHub OAuth credentials in both .env files
```

### Running the Development Environment

```bash
# Start the backend server
yarn api:dev

# In a separate terminal, start the frontend
yarn dev
```

The application will be available at http://localhost:3000

## Project Structure

```
zkDev/
├── packages/
│   ├── hardhat/      # Smart contracts
│   ├── nextjs/       # Frontend application
│   └── express/      # Backend API server
├── README.md
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*zkDev is currently in development as part of the Prague Global Hackathon.*
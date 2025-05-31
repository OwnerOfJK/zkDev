# zkDev - Web3 Developer Contribution Verification Hub

## Overview

zkDev is a developer-focused platform that enables Web3 projects to identify and reward genuine contributors based on verifiable GitHub activity and contributions. Using zero-knowledge proofs, developers can cryptographically prove their contributions while maintaining privacy over sensitive repository data.

## Repository and Contribution Scoring Formula

zkDev uses a quantitative formula to assess both the importance of a repository and the impact of a user's contributions to it. This enables fair, transparent, and privacy-preserving evaluation of developer activity.

### Repository Importance Score (RIS)

The importance of a repository is calculated as:

```
RIS (Repository Importance Score) = log2(stars + 1) * 2 + log2(forks + 1) * 1.5 + contributors * 0.5
```

- **stars**: Number of GitHub stars (community interest)
- **forks**: Number of times the repo was forked (potential for reuse)
- **contributors**: Number of unique contributors (collaborative value)
- The logarithmic scaling ensures diminishing returns for very popular repos, while still rewarding high engagement.

### Contribution Quality Score (CQS)

For a given user in a repo:

```
CQS (Contribution Quality Score) = (number of commits by user) * 2 + (total additions by user) / 100
```

- **number of commits by user**: Total commits authored by the user
- **total additions by user**: Total lines of code added by the user (across all their commits)
- This rewards both activity and code volume, but with diminishing returns for very large additions.

### Production Participation Bonus (PPB)

```
PPB (Production Participation Bonus) = (number of production commits) * 5
```

- **production commits**: Commits that touch files in `src/` or `lib/` directories (i.e., core code, not docs/tests)
- This bonus rewards meaningful, production-level contributions.

### Final Contribution Score

The final score for a user in a repo is:

```
Final Score = RIS * (CQS + PPB)
```

- This combines the importance of the repo with the user's activity and quality of contributions.
- Higher scores indicate more significant, high-impact contributions to important projects.

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

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zkDev.git
cd zkDev

# Install dependencies
yarn install

# Set up environment variables
cp packages/nextjs/.env.example packages/nextjs/.env
cp packages/express/.env.example packages/express/.env

# Start local Ethereum network
yarn chain

# deploy template contracts
yarn deploy

# Start the backedn
yarn api:dev

# In a separate terminal, start the frontend
yarn start
```

The application will be available at http://localhost:3000

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

_zkDev is currently in development as part of the Prague Global Hackathon._

# zkDev - Web3 Developer Contribution Verification Hub

## Overview

zkDev is a developer-focused platform that enables Web3 projects to identify and reward genuine contributors based on verifiable GitHub activity and contributions. Using zero-knowledge proofs, developers can cryptographically prove their contributions while maintaining privacy over sensitive repository data.

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

# Now, edit these two .env file with the required tokens.

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

*zkDev is currently in development as part of the Prague Global Hackathon.*
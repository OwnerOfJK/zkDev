import { useState } from "react";
import Image from "next/image";

interface ConnectedAccount {
  id: string;
  username: string;
  avatar_url: string;
}

interface ConnectGitHubAccountProps {
  connectedAccounts: ConnectedAccount[];
  onAccountConnected: (account: ConnectedAccount) => void;
}

export const ConnectGitHubAccount = ({ connectedAccounts, onAccountConnected }: ConnectGitHubAccountProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (platform: 'github' | 'gitlab') => {
    setIsConnecting(true);
    try {
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/${platform}`;
    } catch (error) {
      console.error(`Error connecting ${platform} account:`, error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-center text-lg font-semibold mb-4">Validate your account data</h3>
      
      {/* Display connected accounts */}
      <div className="space-y-4 mb-6">
        {connectedAccounts.map((account) => (
          <div key={account.id} className="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
            <img
              src={account.avatar_url}
              alt={`${account.username}'s avatar`}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <p className="font-medium">{account.username}</p>
              <p className="text-sm text-base-content/70">ID: {account.id}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Platform logos */}
      <div className="flex justify-center gap-6">
        <button
          onClick={() => handleConnect('github')}
          disabled={isConnecting}
          className="transform hover:scale-110 transition-transform duration-200"
        >
          <Image
            src="/logos/github.png"
            alt="Connect GitHub"
            width={48}
            height={48}
            className="opacity-80 hover:opacity-100"
          />
        </button>
        <button
          onClick={() => handleConnect('gitlab')}
          disabled={isConnecting}
          className="transform hover:scale-110 transition-transform duration-200"
        >
          <Image
            src="/logos/gitlab.png"
            alt="Connect GitLab"
            width={48}
            height={48}
            className="opacity-80 hover:opacity-100"
          />
        </button>
      </div>

      {isConnecting && (
        <div className="text-center mt-4">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="ml-2">Connecting...</span>
        </div>
      )}
    </div>
  );
}; 
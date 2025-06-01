"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { ConnectGitHubAccount } from "~~/components/ConnectGitHubAccount";
import { GitHubActivity } from "~~/components/GitHubActivity";
import { WebProof } from "~~/components/WebProof";

interface UserInfo {
  id: string;
  displayName: string;
  provider: string;
  accessToken: string;
}

interface ConnectedAccount {
  id: string;
  username: string;
  avatar_url: string;
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

const funAvatars = [
    "/avatars/avatar1.png",
    "/avatars/avatar2.png",
    "/avatars/avatar3.png",
    "/avatars/avatar4.png"
  ];

const Account: NextPage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [githubStats, setGithubStats] = useState<GitHubStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [randomAvatar, setRandomAvatar] = useState<string>("");

  useEffect(() => {
    // Select a random avatar when component mounts
    const randomIndex = Math.floor(Math.random() * funAvatars.length);
    setRandomAvatar(funAvatars[randomIndex]);
  }, []);

  const fetchGitHubStats = async () => {
    try {
      setIsLoadingStats(true);
      setStatsError(null);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/github/stats`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setGithubStats(data);
      } else {
        throw new Error('Failed to fetch GitHub stats');
      }
    } catch (error) {
      console.error("Error fetching GitHub stats:", error);
      setStatsError("Failed to load GitHub statistics");
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/user`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUserInfo(data);
        } else {
          throw new Error("Failed to fetch user data");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to load user data");
      }
    };

    const fetchConnectedAccounts = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/github/connected-accounts`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setConnectedAccounts(data);
        }
      } catch (error) {
        console.error("Error fetching connected accounts:", error);
      }
    };

    fetchUserData();
    fetchConnectedAccounts();
    fetchGitHubStats();
  }, []);

  const handleAccountConnected = (account: ConnectedAccount) => {
    setConnectedAccounts([...connectedAccounts, account]);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p>{error}</p>
          <button onClick={() => (window.location.href = "/")} className="btn btn-primary mt-4">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p>Please wait while we fetch your information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 w-full max-w-7xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">You are ready to validate your dev data!</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Left Column - User Info */}
          <div className="bg-base-200 p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center">
                <img 
                  src={randomAvatar} 
                  alt="User Avatar" 
                  className="w-24 h-24 rounded-full border-2 border-primary"
                />
                <h2 className="text-xl font-bold text-green-500 mt-4">{userInfo.displayName}</h2>
              </div>

              {/* User Data Section */}
              <div className="flex-grow">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold min-w-[100px]">Provider:</span>
                    <span className="text-base-content/80">{userInfo.provider}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold min-w-[100px]">ID:</span>
                    <span className="text-base-content/80">{userInfo.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold min-w-[100px]">Access Token:</span>
                    <span className="font-mono text-sm">{userInfo.accessToken ? "✓ Present" : "✗ Missing"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - GitHub Accounts */}
          <div className="bg-base-200 p-6 rounded-lg shadow-lg">
            <ConnectGitHubAccount
              connectedAccounts={connectedAccounts}
              onAccountConnected={handleAccountConnected}
            />
          </div>
        </div>

        {/* GitHub Stats Section */}
        <div className="bg-base-200 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Your Data</h2>
            {!isLoadingStats && !statsError && githubStats && (
              <WebProof className="w-auto" />
            )}
          </div>
          {isLoadingStats ? (
            <div className="text-center p-8">
              <p className="text-lg mb-4">Anonymously aggregating your data...</p>
              <div className="loading loading-spinner loading-lg"></div>
            </div>
          ) : statsError ? (
            <div className="text-center p-8">
              <p className="text-lg text-error mb-4">{statsError}</p>
              <button onClick={fetchGitHubStats} className="btn btn-primary btn-sm">
                Try Again
              </button>
            </div>
          ) : githubStats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-base-300 p-4 rounded-lg text-center">
                  <p className="text-sm text-base-content/70">Connected Accounts</p>
                  <p className="text-3xl font-bold">{githubStats.totalAccounts}</p>
                </div>
                <div className="bg-base-300 p-4 rounded-lg text-center">
                  <p className="text-sm text-base-content/70">Total Repositories</p>
                  <p className="text-3xl font-bold">{githubStats.totalRepos}</p>
                </div>
                <div className="bg-base-300 p-4 rounded-lg text-center">
                  <p className="text-sm text-base-content/70">Total Commits</p>
                  <p className="text-3xl font-bold">{githubStats.totalCommits}</p>
                </div>
                <div className="bg-base-300 p-4 rounded-lg text-center">
                  <p className="text-sm text-base-content/70">Total Stars</p>
                  <p className="text-3xl font-bold">{githubStats.totalStars}</p>
                </div>
                <div className="bg-base-300 p-4 rounded-lg text-center">
                  <p className="text-sm text-base-content/70">Total Forks</p>
                  <p className="text-3xl font-bold">{githubStats.totalForks}</p>
                </div>
              </div>

              {/* Top Languages */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Top Languages</h3>
                <div className="space-y-2">
                  {githubStats.topLanguages.map((lang) => (
                    <div key={lang.name} className="flex items-center gap-2">
                      <div className="w-24 text-sm">{lang.name}</div>
                      <div className="flex-1 h-4 bg-base-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(lang.count / githubStats.topLanguages[0].count) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-12 text-sm text-right">{Math.round((lang.count / githubStats.topLanguages[0].count) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivation Message */}
              <div className="mt-10 p-4 bg-primary/10 rounded-lg">
                   {userInfo.accessToken && <GitHubActivity />}
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <p className="text-lg mb-4">No GitHub data available yet</p>
              <p className="text-base-content/70">
                Connect your GitHub account to start tracking your development impact!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Account;

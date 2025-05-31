"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { GitHubActivity } from "~~/components/GitHubActivity";

interface UserInfo {
  id: string;
  displayName: string;
  provider: string;
  accessToken: string;
}

const Dashboard: NextPage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    fetchUserData();
  }, []);

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
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 w-full max-w-7xl">
          <h1 className="text-center">
            <span className="block text-4xl font-bold">Your Dev Profile</span>
          </h1>
          {/* User Info Section */}
          <div className="items-center bg-base-200 p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-xl font-bold text-green-500 mb-4">User Information</h2>
            <p className="mb-2">
              <span className="font-bold">Username:</span> {userInfo.displayName}
            </p>
            <p className="mb-2">
              <span className="font-bold">Provider:</span> {userInfo.provider}
            </p>
            <p className="mb-2">
              <span className="font-bold">ID:</span> {userInfo.id}
            </p>
            <p className="mb-2">
              <span className="font-bold">Access Token:</span>{" "}
              <span className="font-mono text-sm">{userInfo.accessToken ? "✓ Present" : "✗ Missing"}</span>
            </p>
          </div>
          {/* GitHub Activity Section */}
          {userInfo.accessToken && <GitHubActivity />}
        </div>
      </div>
    </>
  );
};

export default Dashboard;

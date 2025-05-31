"use client";

import React from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const GitHubLoginButton: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = () => {
    try {
      setIsLoading(true);
      const loginUrl = `${API_URL}/auth/github`;
      console.log("Redirecting to:", loginUrl);
      window.location.href = loginUrl;
    } catch (error) {
      console.error("Failed to initiate GitHub login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleLogin} className="btn btn-primary" disabled={isLoading}>
      {isLoading ? "Connecting..." : "Login with GitHub"}
    </button>
  );
};

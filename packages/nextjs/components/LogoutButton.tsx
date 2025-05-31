"use client";

import React from "react";
import { ArrowLeftOnRectangleIcon } from "@heroicons/react/24/outline";

export const LogoutButton: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      window.location.href = "/api/auth/signout";
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-2" disabled={isLoading} title="Logout">
      <ArrowLeftOnRectangleIcon className="h-4 w-4" />
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
};

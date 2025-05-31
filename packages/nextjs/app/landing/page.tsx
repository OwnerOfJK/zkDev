"use client";

import type { NextPage } from "next";
import { GitHubLoginButton } from "~~/components/GithubLoginButton";

const Landing: NextPage = () => {
  return (
    <>
      {/* Video Background */}
      <div className="fixed top-0 left-0 w-full h-full">
        <video autoPlay loop muted playsInline className="object-cover w-full h-full" style={{ zIndex: -1 }}>
          <source src="/zkdev.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center">
        <div className="text-center px-5">
          <h1 className="text-6xl font-bold mb-4 text-white">zkDev</h1>
          <p className="text-xl text-gray-200 mb-8">Your developer profile. Private and verified.</p>
          <div>
            <GitHubLoginButton />
          </div>
        </div>
      </div>
    </>
  );
};

export default Landing;

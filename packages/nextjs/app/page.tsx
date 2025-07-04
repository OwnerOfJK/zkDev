"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the landing page
    router.push("/landing");
  }, [router]);

  return null; // This page will immediately redirect
}

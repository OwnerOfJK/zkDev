import { NextResponse } from "next/server";

export async function GET() {
  const state = Math.random().toString(36).substring(2, 15);

  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&scope=user:email&state=${state}`,
  );

  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  return response;
}

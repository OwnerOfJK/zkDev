import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;

  // Verify state parameter
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/auth/github/error", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/github/error", request.url));
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub OAuth error:", tokenData);
      return NextResponse.redirect(new URL("/auth/github/error", request.url));
    }

    const accessToken = tokenData.access_token;

    // Get user information from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Failed to fetch user data:", userData);
      return NextResponse.redirect(new URL("/auth/github/error", request.url));
    }

    // Create user session data
    const userInfo = {
      id: userData.id.toString(),
      displayName: userData.login,
      provider: "github",
      accessToken,
      username: userData.login,
      avatar_url: userData.avatar_url,
      name: userData.name,
      email: userData.email,
    };

    // Create response and set session cookie
    const response = NextResponse.redirect(new URL("/dashboard", request.url));

    // Store user info in a secure HTTP-only cookie
    response.cookies.set("user_session", JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400 * 7, // 7 days
    });

    // Clear the OAuth state cookie
    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(new URL("/auth/github/error", request.url));
  }
}

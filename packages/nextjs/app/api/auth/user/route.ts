import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userSession = request.cookies.get("user_session")?.value;

  if (!userSession) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userInfo = JSON.parse(userSession);

    // Return user info without sensitive data
    const safeUserInfo = {
      id: userInfo.id,
      displayName: userInfo.displayName,
      provider: userInfo.provider,
      accessToken: userInfo.accessToken ? "present" : "missing", // Don't expose the actual token
      username: userInfo.username,
      avatar_url: userInfo.avatar_url,
      name: userInfo.name,
      email: userInfo.email,
    };

    return NextResponse.json(safeUserInfo);
  } catch (error) {
    console.error("Error parsing user session:", error);
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}

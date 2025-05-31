import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));

  // Clear the user session cookie
  response.cookies.delete("user_session");

  return response;
}

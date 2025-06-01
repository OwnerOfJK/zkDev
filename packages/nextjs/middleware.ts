import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/leaderboard"];

  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // For protected routes, check authentication via API
  /*if (isProtectedRoute) {
    try {
      // Check if user is authenticated by calling the auth API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ethhackback.someng.de';
      const response = await fetch(`${apiUrl}/auth/user`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
        credentials: 'include',
      });

      // If not authenticated, redirect to landing
      if (!response.ok) {
        return NextResponse.redirect(new URL("/landing", request.url));
      }
    } catch (error) {
      // If API call fails, assume not authenticated and redirect to landing
      console.error('Middleware auth check failed:', error);
      return NextResponse.redirect(new URL("/landing", request.url));
    }
  }*/

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|devZk_logo.svg|zkDev_thumbnail.png|zkDev.mp4|manifest.json).*)",
  ],
};
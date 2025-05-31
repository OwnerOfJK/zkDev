import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const userSession = request.cookies.get("user_session");
  const pathname = request.nextUrl.pathname;

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard"];

  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (isProtectedRoute && !userSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is authenticated and trying to access login page, redirect to dashboard
  if (pathname === "/" && userSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|devZk_logo.svg|zkDev_thumbnail.png|zkDev.mp4|manifest.json).*)",
  ],
};

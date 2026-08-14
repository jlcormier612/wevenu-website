/**
 * Auth gate (Next.js 16 `proxy` convention).
 * Project 8 — require real session cookie `ws_session` for app routes.
 * Public: `/login`, `/invite/*`, `/activate/*`
 * Static public assets (e.g. `/brand/*.png`) are excluded via matcher so
 * `next/image` optimization can fetch them without a session cookie.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get("ws_session")?.value;
  const isAuthed = Boolean(sessionId?.trim());

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/activate/") ||
    pathname.startsWith("/_next");

  if (!isAuthed && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname === "/" ? "/business" : pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthed) {
    return NextResponse.redirect(new URL("/business", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api
     * - _next/static, _next/image
     * - favicon.ico
     * - public asset files (svg, png, jpg, etc.) — same pattern as product app
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

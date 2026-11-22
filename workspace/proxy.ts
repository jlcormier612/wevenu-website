/**
 * Auth gate (Next.js 16 `proxy` convention).
 * R1A: Supabase Workspace auth cookie (isolated) OR legacy `ws_session`.
 * Public: `/login`, `/invite/*`, `/activate/*`, `/login/reset`
 * Static public assets excluded via matcher.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  getWorkspaceAuthProvider,
  workspaceAuthCookieName,
  workspaceSupabaseAnonKey,
  workspaceSupabaseUrl,
} from "@/lib/supabase/workspace-auth-config";

function hasLegacySession(request: NextRequest): boolean {
  return Boolean(request.cookies.get("ws_session")?.value?.trim());
}

function hasWorkspaceSupabaseCookie(request: NextRequest): boolean {
  const name = workspaceAuthCookieName();
  // @supabase/ssr may chunk cookies as name.0, name.1, …
  return request.cookies
    .getAll()
    .some((c) => c.name === name || c.name.startsWith(`${name}.`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const provider = getWorkspaceAuthProvider();

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/activate/") ||
    pathname.startsWith("/_next");

  let isAuthed = false;
  let response = NextResponse.next({
    request: {
      headers: (() => {
        const h = new Headers(request.headers);
        h.set("x-pathname", pathname);
        return h;
      })(),
    },
  });

  if (provider === "legacy_jsonl") {
    isAuthed = hasLegacySession(request);
  } else if (provider === "memory") {
    // Memory provider is for unit tests; proxy treats presence of legacy or sb cookie as hint.
    isAuthed = hasLegacySession(request) || hasWorkspaceSupabaseCookie(request);
  } else {
    // supabase — refresh session and require a valid user; ACL enforced in requireWorkspaceStaff.
    const url = workspaceSupabaseUrl();
    const anonKey = workspaceSupabaseAnonKey();
    if (url && anonKey && hasWorkspaceSupabaseCookie(request)) {
      // Skip Auth network round-trip when no Workspace session cookie exists
      // (anonymous redirect stays cheap; avoids getUser on every public asset miss).
      const cookieName = workspaceAuthCookieName();
      const supabase = createServerClient(url, anonKey, {
        cookieOptions: { name: cookieName },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            response = NextResponse.next({
              request: {
                headers: (() => {
                  const h = new Headers(request.headers);
                  h.set("x-pathname", pathname);
                  return h;
                })(),
              },
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      isAuthed = Boolean(data.user);
    } else {
      isAuthed = false;
    }
  }

  if (!isAuthed && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname === "/" ? "/business" : pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Do NOT bounce authenticated Supabase users away from /login here.
  // Proxy only knows Auth session presence — not htc_internal_staff ACL.
  // Auto-redirecting /login → /business caused a loop for venue/portal users
  // with a valid Auth cookie but no Workspace ACL (AppShell → /login → …).
  // Staff vs non-staff routing is handled on the login page after ACL resolve.

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

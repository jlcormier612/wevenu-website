import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/env";

/**
 * Routes that do not require an authenticated session.
 */
const PUBLIC_PATHS = [
  "/login",
  "/form",           // public venue inquiry forms — /form/{embedKey}
  "/questionnaire",  // public final details forms — /questionnaire/{accessKey}
  "/api/public",     // public API routes — /api/public/inquire, /api/public/questionnaire
  "/api/messaging/inbound",  // Resend inbound email webhook (no user session)
  "/api/messaging/webhook",  // Resend delivery webhook (no user session)
  "/sign",           // public contract signing — /sign/{token}
  "/p",              // client portal workspace — /p/{access_token}
  "/api/portal",        // portal API endpoints — complete tasks, etc.
  "/api/notifications", // notification delivery engine — secret-guarded, not session-guarded
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection. This runs in the Next.js 16 Proxy (formerly Middleware).
 *
 * Behaviour when Supabase is not yet configured (e.g. local dev before
 * infrastructure exists): no session can exist, so protected routes redirect to
 * the login screen and public routes are served normally. The app still runs.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Without credentials, treat every visitor as unauthenticated.
  if (!isSupabaseConfigured) {
    if (isPublicPath(pathname)) {
      return NextResponse.next({ request });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with Supabase Auth. Do not
  // insert logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath(pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

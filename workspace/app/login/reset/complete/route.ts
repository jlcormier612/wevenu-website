import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

import { workspaceBaseUrl } from "@/lib/program4/auth-store";
import {
  workspaceAuthCookieName,
  workspaceSupabaseAnonKey,
  workspaceSupabaseUrl,
} from "@/lib/supabase/workspace-auth-config";

/**
 * Server-side recovery exchange.
 *
 * Uses runtime ECS Supabase env (not build-time NEXT_PUBLIC bake alone) and
 * attaches Workspace Auth cookies to the redirect response so /login/reset
 * can call getSession() successfully.
 *
 * Redirects must use the public Workspace origin — `request.url` behind the
 * ALB is an internal ECS host and must not leak into Location headers.
 */
function publicWorkspaceOrigin(request: NextRequest): string {
  const forwardedHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim();
  const forwardedProto = (request.headers.get("x-forwarded-proto") || "https")
    .split(",")[0]
    .trim();
  if (
    forwardedHost &&
    !forwardedHost.includes("ec2.internal") &&
    !forwardedHost.startsWith("10.") &&
    !forwardedHost.startsWith("127.")
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return workspaceBaseUrl();
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl;
  const tokenHash = (incoming.searchParams.get("token_hash") || "").trim();
  const type = (incoming.searchParams.get("type") || "recovery").trim() as EmailOtpType;
  const origin = publicWorkspaceOrigin(request);
  const resetUrl = new URL("/login/reset", origin);
  const failUrl = new URL("/login/reset", origin);
  failUrl.searchParams.set("error", "invalid");

  if (!tokenHash || !type) {
    return NextResponse.redirect(failUrl);
  }

  const url = workspaceSupabaseUrl();
  const anonKey = workspaceSupabaseAnonKey();
  if (!url || !anonKey) {
    return NextResponse.redirect(failUrl);
  }

  let response = NextResponse.redirect(resetUrl);
  const cookieName = workspaceAuthCookieName();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      name: cookieName,
      // Cross-subdomain not required; keep host-only on workspace.
      path: "/",
      sameSite: "lax",
      secure: origin.startsWith("https://"),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.redirect(resetUrl);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(failUrl);
  }

  return response;
}

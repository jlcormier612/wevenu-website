import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import {
  loginRedirectWithNext,
  safeInternalNextPath as safeNextPath,
} from "@/lib/auth/portal-home";
import { resolveAuthenticatedHomePath } from "@/lib/auth/resolve-home";
import {
  cookieNameForScope,
  isVendorAppPath,
  supabaseProjectRef,
  type AuthSessionScope,
} from "@/lib/auth/session-scope";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/env";
import { decideLegalProxyEnforcement } from "@/lib/legal/enforce-legal-in-proxy";
import { shouldSkipLegalEnforcement } from "@/lib/legal/welcome-middleware";

/**
 * Routes that do not require an authenticated session.
 */
const PUBLIC_PATHS = [
  "/login",
  "/client/login",   // couple/client portal login
  "/client/accept",  // primary couple invite accept (pre-auth)
  "/client/accept-participant", // delegate invite accept (pre-auth)
  "/vendor/login",   // vendor portal login (isolated cookie jar)
  "/form",           // public venue inquiry forms - /form/{embedKey}
  "/questionnaire",  // public final details forms - /questionnaire/{accessKey}
  "/api/public",     // public API routes - /api/public/inquire, /api/public/questionnaire
  "/api/messaging/inbound",  // Resend inbound email webhook (no user session)
  "/api/leads/email-intake", // Resend inbound webhook for the Email Intake Engine (no user session; verifies its own secret) - found unreachable during Sprint 3 assessment, same allowlist-omission class as the QuickBooks sync cron
  "/api/messaging/webhook",  // Resend delivery webhook (no user session)
  "/api/messaging/sms-inbound", // Twilio inbound SMS webhook (no user session; verifies its own signature)
  "/api/messaging/sms-status",  // Twilio outbound SMS status callback (no user session; verifies its own signature)
  "/sign",           // public contract signing - /sign/{token}
  "/brochure",       // D7B - public brochure view - /brochure/{share_token}
  "/api/brochures/public", // D7B - public brochure PDF - /api/brochures/public/{share_token}/pdf
  "/legal",          // public active legal documents - /legal/{document_type}
  "/terms",          // canonical public Venue Subscription Agreement
  "/privacy",        // canonical public Privacy Policy
  "/cookies",        // canonical public Cookie Policy
  "/acceptable-use", // canonical public Acceptable Use Policy
  "/end-user-terms", // canonical public End User Terms (couples)
  "/vendor-terms",   // canonical public Vendor Terms
  "/api/legal",      // public legal metadata (active document ids / versions)
  "/api/internal/legal", // CRM -> legal acceptances - Bearer PRODUCT_SYNC_API_KEY
  "/p",              // client portal workspace - /p/{access_token}
  "/v",              // vendor portal workspace - /v/{access_token}
  "/vendor/accept",  // vendor invitation claim - accessible before auth
  "/join",           // staff team-invite acceptance - accessible before auth, same shape as /vendor/accept
  "/book",           // public tour scheduling - /book/{tour_embed_key}
  "/w",              // public wedding website - /w/{slug}
  "/qr",             // QR Lead Capture scan-and-redirect - /qr/{code}, plus /qr/inactive
  "/rsvp",           // public RSVP submission - /rsvp/{rsvp_token}
  "/api/portal",        // portal API endpoints - complete tasks, invites, etc.
  "/api/rsvp",          // guest-token-authenticated RSVP API endpoints (concierge, etc.)
  "/api/vendor",        // vendor portal API endpoints
  // Release Readiness Reconciliation remediation: these were previously the
  // bare prefixes "/api/notifications"/"/api/tours", which also matched
  // "/api/notifications/preferences"+"/read" (staff-only, cookie-session)
  // and "/api/tours/outcome"+"/status" (coordinator-only) - safe only by
  // coincidence, since those routes independently check auth internally.
  // Narrowed to exactly the sub-paths that are genuinely meant to be
  // reachable without a session.
  "/api/notifications/process", // notification delivery engine cron/manual-trigger - secret-guarded, not session-guarded
  "/api/tours/book",             // public tour booking widget - embed-key-authenticated, not session-guarded
  "/api/tours/slots",            // public tour slot queries - embed-key-authenticated, not session-guarded
  "/api/digest",                     // daily digest cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/communication/scheduled",    // Scheduled Sends cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/automation/process",         // Automation engine cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/quickbooks/sync/process",    // QuickBooks sync queue cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/facebook/webhook",           // Meta Lead Ads webhook - GET verification handshake + POST delivery, verifies its own signature
  "/api/facebook/sync/process",      // Facebook Lead Ads queue cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/facebook/reconcile/process", // Facebook Lead Ads reconciliation poll cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/saved-reports/process",      // D7C - scheduled Saved Report delivery cron (vercel.json) - CRON_SECRET-guarded, not session-guarded
  "/api/webhooks/stripe-connect",    // Stripe Connect webhook - no user session, verifies its own signature (Sprint 4)
  "/api/internal/product-access",    // CRM -> product access lock - Bearer PRODUCT_SYNC_API_KEY, not session-guarded
  "/api/internal/enrollment",        // CRM/Workspace -> venue enrollment + activation bridge - Bearer PRODUCT_SYNC_API_KEY, not session-guarded
  "/api/health",                     // deployment health check - no session, no secret; read-only, returns booleans only, never data
];

/** Authenticated routes still reachable when the venue SaaS account is suspended. */
const SUSPENDED_ALLOW_PATHS = ["/billing/suspended", "/api/billing/portal"];

function isSuspendedAllowPath(pathname: string): boolean {
  return SUSPENDED_ALLOW_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Same-origin relative redirect targets only (blocks //evil.com and external URLs).
 * Used for /login?next= after vendor invitation claim and similar flows.
 */
function safeInternalNextPath(raw: string | null, origin: string): string | null {
  const path = safeNextPath(raw);
  if (!path) return null;
  try {
    const url = new URL(path, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Forward pathname to Server Components (vendor layout uses this for /vendor/accept). */
function nextWithPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/**
 * Copy Set-Cookie headers from the session-bearing response onto a new one.
 * Redirects / JSON after getUser() must preserve refreshed auth cookies -
 * otherwise a silent JWT refresh is dropped and the next navigation looks logged out.
 * Never clears cookies on fail-open legal / lock paths.
 */
function withSessionCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  // Pass the full cookie record so maxAge / path / sameSite survive redirects.
  // Setting only name+value would collapse refreshed auth cookies into session cookies.
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
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
      return nextWithPathname(request, pathname);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const { url, anonKey } = getSupabaseConfig();
  // Never mark cookies Secure over HTTP — browser drops them on subsequent requests.
  // Covers localhost dev AND HTTP-only staging/sandbox environments.
  const isLocalHttp =
    request.nextUrl.protocol === "http:" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";

  const projectRef = supabaseProjectRef(url);

  function makeScopedClient(scope: AuthSessionScope) {
    const cookieName = cookieNameForScope(scope, projectRef);
    return createServerClient(url, anonKey, {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: isLocalHttp ? false : undefined,
        ...(cookieName ? { name: cookieName } : null),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          const prior = supabaseResponse.cookies.getAll();
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          prior.forEach((cookie) => {
            supabaseResponse.cookies.set(cookie.name, cookie.value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(isLocalHttp ? { secure: false } : null),
            });
          });
        },
      },
    });
  }

  // Refresh venue + vendor + client cookie jars independently so one portal
  // sign-in never collapses another.
  const venueSupabase = makeScopedClient("venue");
  const vendorSupabase = makeScopedClient("vendor");
  const clientSupabase = makeScopedClient("client");

  // IMPORTANT: getUser() revalidates the token with Supabase Auth.
  const [{ data: { user: venueUser } }, { data: { user: vendorUser } }] =
    await Promise.all([
      venueSupabase.auth.getUser(),
      vendorSupabase.auth.getUser(),
    ]);
  // Warm the client jar (writes refreshed cookies via setAll when present).
  await clientSupabase.auth.getUser();

  const vendorPath = isVendorAppPath(pathname);

  if (vendorPath && !vendorUser) {
    const next = `${pathname}${request.nextUrl.search || ""}`;
    const loginUrl = new URL("/vendor/login", request.nextUrl.origin);
    const safe = safeInternalNextPath(next, request.nextUrl.origin);
    if (safe) loginUrl.searchParams.set("next", safe);
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl),
    );
  }

  if (!venueUser && !vendorPath && !isPublicPath(pathname)) {
    const loginPath = loginRedirectWithNext(
      pathname,
      request.nextUrl.search,
    );
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(loginPath, request.nextUrl.origin)),
    );
  }

  const user = vendorPath ? vendorUser : venueUser;
  const supabase = vendorPath ? vendorSupabase : venueSupabase;

  // Wevenu HQ (/admin/* and /api/admin/*) - defense in depth alongside the
  // layout-level check in app/admin/layout.tsx. See
  // docs/wevenu-hq-architecture.md section 5.
  if (venueUser && (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))) {
    const { data: isAdmin } = await venueSupabase.rpc("is_hq_admin");
    if (!isAdmin) {
      if (pathname.startsWith("/api/admin")) {
        return withSessionCookies(
          supabaseResponse,
          NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        );
      }
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(dashboardUrl),
      );
    }
    // HQ admins skip venue suspend hard-lock.
    return supabaseResponse;
  }

  // CRM Suspend / unpaid dunning hard-lock - venue staff cannot use the app.
  // Vendor portal paths use a separate session and are not venue-suspended here.
  if (venueUser && !vendorPath && !isPublicPath(pathname)) {
    const { data: venueLock, error: venueLockError } = await venueSupabase
      .from("venues")
      .select("access_disabled, account_status")
      .maybeSingle<{
        access_disabled: boolean | null;
        account_status: string | null;
      }>();

    const isLocked =
      !venueLockError &&
      Boolean(
        venueLock &&
          (venueLock.access_disabled === true ||
            venueLock.account_status === "suspended"),
      );

    if (isLocked && !isSuspendedAllowPath(pathname)) {
      if (pathname.startsWith("/api/")) {
        return withSessionCookies(
          supabaseResponse,
          NextResponse.json(
            {
              error:
                "Subscription inactive. Update your payment method to restore access.",
              code: "account_suspended",
            },
            { status: 403 },
          ),
        );
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/billing/suspended";
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(suspendedUrl),
      );
    }
  }

  // Legal Acceptance Middleware (WP4) - one enforcement path for returning
  // users + signup/setup. Compliant users pass through unchanged.
  // Fail-open (inside decideLegalProxyEnforcement) never clears cookies.
  if (
    user &&
    !isPublicPath(pathname) &&
    !shouldSkipLegalEnforcement(pathname)
  ) {
    const legalDecision = await decideLegalProxyEnforcement({
      user,
      pathname,
      search: request.nextUrl.search,
      supabase,
    });
    if (legalDecision.action === "redirect_welcome") {
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(
          new URL(legalDecision.welcomePath, request.nextUrl.origin),
        ),
      );
    }
    if (legalDecision.action === "block_api") {
      return withSessionCookies(
        supabaseResponse,
        NextResponse.json(
          {
            error: "Legal acceptance required.",
            code: legalDecision.code,
            welcomePath: legalDecision.welcomePath,
          },
          { status: 403 },
        ),
      );
    }
  }

  // Only redirect logged-in venue users away from /login.
  if (venueUser && pathname === "/login") {
    const { data: lockedVenue } = await venueSupabase
      .from("venues")
      .select("access_disabled, account_status")
      .maybeSingle<{
        access_disabled: boolean | null;
        account_status: string | null;
      }>();
    if (
      lockedVenue &&
      (lockedVenue.access_disabled === true ||
        lockedVenue.account_status === "suspended")
    ) {
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/billing/suspended";
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(suspendedUrl),
      );
    }

    const nextRaw = request.nextUrl.searchParams.get("next");
    const safeNext = safeInternalNextPath(nextRaw, request.nextUrl.origin);
    // Never send venue login into vendor accept — that belongs on /vendor/login.
    const nextForVenue =
      safeNext && safeNext.startsWith("/vendor") ? null : safeNext;
    const home = await resolveAuthenticatedHomePath(venueSupabase, venueUser.id, {
      next: nextForVenue,
      prefer: "venue",
    });
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(home, request.nextUrl.origin)),
    );
  }

  return supabaseResponse;
}

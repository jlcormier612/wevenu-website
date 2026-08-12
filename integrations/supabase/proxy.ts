import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

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
  "/form",           // public venue inquiry forms — /form/{embedKey}
  "/questionnaire",  // public final details forms — /questionnaire/{accessKey}
  "/api/public",     // public API routes — /api/public/inquire, /api/public/questionnaire
  "/api/messaging/inbound",  // Resend inbound email webhook (no user session)
  "/api/leads/email-intake", // Resend inbound webhook for the Email Intake Engine (no user session; verifies its own secret) — found unreachable during Sprint 3 assessment, same allowlist-omission class as the QuickBooks sync cron
  "/api/messaging/webhook",  // Resend delivery webhook (no user session)
  "/api/messaging/sms-inbound", // Twilio inbound SMS webhook (no user session; verifies its own signature)
  "/api/messaging/sms-status",  // Twilio outbound SMS status callback (no user session; verifies its own signature)
  "/sign",           // public contract signing — /sign/{token}
  "/brochure",       // D7B — public brochure view — /brochure/{share_token}
  "/api/brochures/public", // D7B — public brochure PDF — /api/brochures/public/{share_token}/pdf
  "/legal",          // public active legal documents — /legal/{document_type}
  "/terms",          // canonical public Venue Subscription Agreement
  "/privacy",        // canonical public Privacy Policy
  "/cookies",        // canonical public Cookie Policy
  "/acceptable-use", // canonical public Acceptable Use Policy
  "/end-user-terms", // canonical public End User Terms (couples)
  "/vendor-terms",   // canonical public Vendor Terms
  "/api/legal",      // public legal metadata (active document ids / versions)
  "/api/internal/legal", // CRM → legal acceptances — Bearer PRODUCT_SYNC_API_KEY
  "/p",              // client portal workspace — /p/{access_token}
  "/v",              // vendor portal workspace — /v/{access_token}
  "/vendor/accept",  // vendor invitation claim — accessible before auth
  "/join",           // staff team-invite acceptance — accessible before auth, same shape as /vendor/accept
  "/book",           // public tour scheduling — /book/{tour_embed_key}
  "/w",              // public wedding website — /w/{slug}
  "/qr",             // QR Lead Capture scan-and-redirect — /qr/{code}, plus /qr/inactive
  "/rsvp",           // public RSVP submission — /rsvp/{rsvp_token}
  "/api/portal",        // portal API endpoints — complete tasks, invites, etc.
  "/api/rsvp",          // guest-token-authenticated RSVP API endpoints (concierge, etc.)
  "/api/vendor",        // vendor portal API endpoints
  // Release Readiness Reconciliation remediation: these were previously the
  // bare prefixes "/api/notifications"/"/api/tours", which also matched
  // "/api/notifications/preferences"+"/read" (staff-only, cookie-session)
  // and "/api/tours/outcome"+"/status" (coordinator-only) — safe only by
  // coincidence, since those routes independently check auth internally.
  // Narrowed to exactly the sub-paths that are genuinely meant to be
  // reachable without a session.
  "/api/notifications/process", // notification delivery engine cron/manual-trigger — secret-guarded, not session-guarded
  "/api/tours/book",             // public tour booking widget — embed-key-authenticated, not session-guarded
  "/api/tours/slots",            // public tour slot queries — embed-key-authenticated, not session-guarded
  "/api/digest",                     // daily digest cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/communication/scheduled",    // Scheduled Sends cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/automation/process",         // Automation engine cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/quickbooks/sync/process",    // QuickBooks sync queue cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/facebook/webhook",           // Meta Lead Ads webhook — GET verification handshake + POST delivery, verifies its own signature
  "/api/facebook/sync/process",      // Facebook Lead Ads queue cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/facebook/reconcile/process", // Facebook Lead Ads reconciliation poll cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/saved-reports/process",      // D7C — scheduled Saved Report delivery cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/webhooks/stripe-connect",    // Stripe Connect webhook — no user session, verifies its own signature (Sprint 4)
  "/api/internal/product-access",    // CRM → product access lock — Bearer PRODUCT_SYNC_API_KEY, not session-guarded
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
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return null;
    // Never bounce back to login itself.
    if (url.pathname === "/login") return null;
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
 * Redirects / JSON after getUser() must preserve refreshed auth cookies —
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
  // Local browser uses http://localhost — never mark cookies Secure locally or
  // Chrome/Safari drop them after soft reloads. Prod (https) still gets Secure.
  const isLocalHttp =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: isLocalHttp ? false : undefined,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // Preserve cookies already queued on supabaseResponse when setAll runs
        // more than once (rapid navigations / concurrent cookie chunks).
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

  // IMPORTANT: getUser() revalidates the token with Supabase Auth. Do not
  // insert logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl),
    );
  }

  // Wevenu HQ (/admin/* and /api/admin/*) — defense in depth alongside the
  // layout-level check in app/admin/layout.tsx. See
  // docs/wevenu-hq-architecture.md §5.
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))) {
    const { data: isAdmin } = await supabase.rpc("is_hq_admin");
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

  // CRM Suspend / unpaid dunning hard-lock — venue staff cannot use the app.
  // Public couple/guest surfaces stay on PUBLIC_PATHS above. Suspend screen +
  // billing portal API remain reachable so payment can be updated.
  if (user && !isPublicPath(pathname)) {
    const { data: venueLock, error: venueLockError } = await supabase
      .from("venues")
      .select("access_disabled, account_status")
      .maybeSingle<{
        access_disabled: boolean | null;
        account_status: string | null;
      }>();

    // If migration is not applied yet, the select may error — do not brick the app.
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

  // Legal Acceptance Middleware (WP4) — one enforcement path for returning
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

  // Only redirect logged-in users away from /login — not from public couple/guest surfaces.
  // Coordinators need to be able to preview /p/{token}, /w/{slug}, /book/{key} etc.
  if (user && pathname === "/login") {
    const { data: lockedVenue } = await supabase
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

    // Honor ?next= for post-auth return (e.g. vendor invitation claim).
    // Must stay same-origin and relative — never open a login ↔ accept loop
    // by bouncing claimers who have a session but no vendor_users row yet.
    const nextRaw = request.nextUrl.searchParams.get("next");
    const safeNext = safeInternalNextPath(nextRaw, request.nextUrl.origin);
    if (safeNext) {
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(new URL(safeNext, request.nextUrl.origin)),
      );
    }

    const { data: vu } = await supabase
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    const destUrl = request.nextUrl.clone();
    destUrl.pathname = vu ? "/vendor/dashboard" : "/dashboard";
    destUrl.search = "";
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(destUrl),
    );
  }

  return supabaseResponse;
}

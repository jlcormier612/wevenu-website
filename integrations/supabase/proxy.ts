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
  "/book",           // public tour scheduling — /book/{tour_embed_key}
  "/w",              // public wedding website — /w/{slug}
  "/qr",             // QR Lead Capture scan-and-redirect — /qr/{code}, plus /qr/inactive
  "/rsvp",           // public RSVP submission — /rsvp/{rsvp_token}
  "/api/portal",        // portal API endpoints — complete tasks, invites, etc.
  "/api/rsvp",          // guest-token-authenticated RSVP API endpoints (concierge, etc.)
  "/api/vendor",        // vendor portal API endpoints
  "/api/notifications", // notification delivery engine — secret-guarded, not session-guarded
  "/api/tours",         // public tour slot queries and bookings
  "/api/digest",                     // daily digest cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/communication/scheduled",    // Scheduled Sends cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/automation/process",         // Automation engine cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/quickbooks/sync/process",    // QuickBooks sync queue cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/facebook/webhook",           // Meta Lead Ads webhook — GET verification handshake + POST delivery, verifies its own signature
  "/api/facebook/sync/process",      // Facebook Lead Ads queue cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
  "/api/facebook/reconcile/process", // Facebook Lead Ads reconciliation poll cron (vercel.json) — CRON_SECRET-guarded, not session-guarded
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
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
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

  // Wevenu HQ (/admin/* and /api/admin/*) — defense in depth alongside the
  // layout-level check in app/admin/layout.tsx. See
  // docs/wevenu-hq-architecture.md §5.
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))) {
    const { data: isAdmin } = await supabase.rpc("is_hq_admin");
    if (!isAdmin) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
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
        return NextResponse.json(
          {
            error:
              "Subscription inactive. Update your payment method to restore access.",
            code: "account_suspended",
          },
          { status: 403 },
        );
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/billing/suspended";
      return NextResponse.redirect(suspendedUrl);
    }
  }

  // Legal Acceptance Middleware (WP4) — one enforcement path for returning
  // users + signup/setup. Compliant users pass through unchanged.
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
      return NextResponse.redirect(
        new URL(legalDecision.welcomePath, request.nextUrl.origin),
      );
    }
    if (legalDecision.action === "block_api") {
      return NextResponse.json(
        {
          error: "Legal acceptance required.",
          code: legalDecision.code,
          welcomePath: legalDecision.welcomePath,
        },
        { status: 403 },
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
      return NextResponse.redirect(suspendedUrl);
    }

    // Honor ?next= for post-auth return (e.g. vendor invitation claim).
    // Must stay same-origin and relative — never open a login ↔ accept loop
    // by bouncing claimers who have a session but no vendor_users row yet.
    const nextRaw = request.nextUrl.searchParams.get("next");
    const safeNext = safeInternalNextPath(nextRaw, request.nextUrl.origin);
    if (safeNext) {
      return NextResponse.redirect(new URL(safeNext, request.nextUrl.origin));
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
    return NextResponse.redirect(destUrl);
  }

  return supabaseResponse;
}

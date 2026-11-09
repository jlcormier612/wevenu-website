import { NextResponse } from "next/server";

import { actorCan, getSessionMember } from "@/lib/program4/session";

export const runtime = "nodejs";

function productBase(): string {
  return (
    process.env.PRODUCT_API_BASE_URL?.trim() ||
    process.env.VENUE_APP_BASE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

function productKey(): string {
  return process.env.PRODUCT_SYNC_API_KEY?.trim() || "";
}

async function requireFounderSession(): Promise<Response | null> {
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Owner / Administrator only for commercial mutations — reuse manage_product_sync
  // (Owner+Admin) rather than CS welcome-back permission.
  if (!(await actorCan("manage_product_sync"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function proxyVenueApp(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = productBase();
  const key = productKey();
  if (!base || !key) {
    return NextResponse.json(
      {
        error:
          "PRODUCT_API_BASE_URL / PRODUCT_SYNC_API_KEY not configured for founder pricing proxy.",
      },
      { status: 503 },
    );
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Founder CRM — Custom Pricing controls.
 * Authenticated founders only; Stripe mutations execute on venue-app.
 */
export async function GET(request: Request) {
  const denied = await requireFounderSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const venueId = url.searchParams.get("venueId");
  const qs = venueId
    ? `?venueId=${encodeURIComponent(venueId)}`
    : "";
  return proxyVenueApp(`/api/internal/pricing/founder-arrangements${qs}`);
}

export async function POST(request: Request) {
  const denied = await requireFounderSession();
  if (denied) return denied;

  const session = await getSessionMember();
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  // Venue owners / org admins never reach this route (Founder CRM session).
  // Stamp actor from session — never trust client-supplied elevation.
  const payload = {
    ...body,
    createdByEmail:
      typeof body.createdByEmail === "string" && body.createdByEmail.trim()
        ? body.createdByEmail
        : session?.email || "founder",
    actorEmail: session?.email || "founder",
    createdByUserId: session?.id ?? null,
  };

  return proxyVenueApp("/api/internal/pricing/founder-arrangements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

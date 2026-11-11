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
          "PRODUCT_API_BASE_URL / PRODUCT_SYNC_API_KEY not configured for referrals proxy.",
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
 * Founder CRM — Referrals management.
 */
export async function GET(request: Request) {
  const denied = await requireFounderSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const referralId = url.searchParams.get("referralId");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const qs = new URLSearchParams();
  if (referralId) qs.set("referralId", referralId);
  if (status) qs.set("status", status);
  if (search) qs.set("search", search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return proxyVenueApp(`/api/internal/pricing/referrals${suffix}`);
}

export async function POST(request: Request) {
  const denied = await requireFounderSession();
  if (denied) return denied;

  const session = await getSessionMember();
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const payload = {
    ...body,
    actorEmail:
      typeof body.actorEmail === "string" && body.actorEmail.trim()
        ? body.actorEmail
        : session?.email || "founder",
  };

  return proxyVenueApp("/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

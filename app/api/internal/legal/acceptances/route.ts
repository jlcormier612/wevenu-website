import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { recordVenueSubscriptionLegalAcceptances } from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * Internal: record Venue ToS + Privacy Policy acceptances.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Body: { email, relationshipId?, acceptedAt?, ipAddress?, userAgent? }
 */
type Body = {
  email?: string;
  relationshipId?: string | null;
  acceptedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim() || "";
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  try {
    const acceptances = await recordVenueSubscriptionLegalAcceptances({
      email,
      relationshipId: body.relationshipId ?? null,
      acceptedAt: body.acceptedAt ?? null,
      ipAddress: body.ipAddress ?? null,
      userAgent: body.userAgent ?? null,
    });

    return NextResponse.json({
      ok: true,
      acceptanceIds: acceptances.map((a) => a.id),
      userId: acceptances[0]?.userId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[legal] record venue subscription acceptances failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

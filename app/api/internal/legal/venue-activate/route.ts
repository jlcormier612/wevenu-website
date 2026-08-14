import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  recordVenueSubscriptionLegalAcceptances,
} from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * Internal: record Venue ToS + Privacy Policy acceptances for Activate Account.
 * Resolves/creates an auth.users row for FK (service role); does not set or
 * change the caller's product password (CRM Activate keeps its own credential path).
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Body: { email, relationshipId?, legalAccepted: true }
 */
type Body = {
  email?: string;
  relationshipId?: string | null;
  legalAccepted?: unknown;
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

  const legalAccepted =
    body.legalAccepted === true ||
    body.legalAccepted === "true" ||
    body.legalAccepted === 1 ||
    body.legalAccepted === "1";
  if (!legalAccepted) {
    return NextResponse.json(
      {
        error:
          "Please agree to the Terms of Service and Privacy Policy to continue.",
      },
      { status: 400 },
    );
  }

  const email = body.email?.trim() || "";
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  const { ipAddress, userAgent } = clientRequestMeta(request.headers);

  try {
    const acceptances = await recordVenueSubscriptionLegalAcceptances({
      email,
      relationshipId: body.relationshipId ?? null,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      userId: acceptances[0]?.userId ?? null,
      acceptanceIds: acceptances.map((a) => a.id),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to complete acceptance.";
    console.error("[legal] venue activate acceptance failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

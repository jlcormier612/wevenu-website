import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal CRM → product access lock.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Body:
 *   { venueId?, ownerEmail?, stripeCustomerId?, locked: boolean, reason?, relationshipId? }
 *
 * Resolves venue by UUID first, then owner email (venues.email / venue_staff).
 * Sets access_disabled + account_status; stores saas_stripe_customer_id for portal.
 * Never deletes data.
 */

type LockBody = {
  venueId?: string | null;
  ownerEmail?: string | null;
  stripeCustomerId?: string | null;
  locked?: boolean;
  reason?: string | null;
  relationshipId?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

async function resolveVenueId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  venueId: string | null | undefined,
  ownerEmail: string | null | undefined,
): Promise<{ venueId: string | null; how: string }> {
  if (venueId && UUID_RE.test(venueId.trim())) {
    const { data, error } = await admin
      .from("venues")
      .select("id")
      .eq("id", venueId.trim())
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return { venueId: data.id as string, how: "venueId" };
  }

  const email = ownerEmail?.trim().toLowerCase();
  if (!email) return { venueId: null, how: "none" };

  const { data: byVenueEmail, error: veErr } = await admin
    .from("venues")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (veErr) throw veErr;
  if (byVenueEmail?.id) {
    return { venueId: byVenueEmail.id as string, how: "venues.email" };
  }

  const { data: byStaff, error: stErr } = await admin
    .from("venue_staff")
    .select("venue_id")
    .ilike("email", email)
    .eq("is_owner", true)
    .limit(1)
    .maybeSingle();
  if (stErr) throw stErr;
  if (byStaff?.venue_id) {
    return { venueId: byStaff.venue_id as string, how: "venue_staff.email" };
  }

  return { venueId: null, how: "none" };
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment." },
      { status: 503 },
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for product access lock." },
      { status: 503 },
    );
  }

  let body: LockBody;
  try {
    body = (await request.json()) as LockBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.locked !== "boolean") {
    return NextResponse.json(
      { error: "locked (boolean) is required" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const resolved = await resolveVenueId(admin, body.venueId, body.ownerEmail);

    if (!resolved.venueId) {
      const detail =
        "No matching product venue (need a real venues.id UUID or owner email match). CRM suspend still applies; product hard lock skipped.";
      console.warn("[product-access/lock]", {
        relationshipId: body.relationshipId ?? null,
        venueId: body.venueId ?? null,
        ownerEmail: body.ownerEmail ?? null,
        locked: body.locked,
        detail,
      });
      return NextResponse.json({
        ok: false,
        error: detail,
        venueId: null,
        detail,
      });
    }

    const patch: Record<string, unknown> = {
      access_disabled: body.locked,
      account_status: body.locked ? "suspended" : "active",
    };
    const customerId = body.stripeCustomerId?.trim();
    if (customerId) {
      patch.saas_stripe_customer_id = customerId;
    }

    const { error: updErr } = await admin
      .from("venues")
      .update(patch)
      .eq("id", resolved.venueId);

    if (updErr) {
      // Migration may not be applied yet.
      console.error("[product-access/lock] update failed", updErr);
      return NextResponse.json(
        {
          ok: false,
          error: updErr.message,
          venueId: resolved.venueId,
          detail:
            "Venue update failed — confirm migration 20261175000000_venue_account_access_lock.sql is applied.",
        },
        { status: 500 },
      );
    }

    const detail = body.locked
      ? `Venue ${resolved.venueId} suspended (${resolved.how}). Data preserved.`
      : `Venue ${resolved.venueId} reactivated (${resolved.how}).`;

    console.info("[product-access/lock]", {
      relationshipId: body.relationshipId ?? null,
      venueId: resolved.venueId,
      how: resolved.how,
      locked: body.locked,
      reason: body.reason ?? null,
    });

    return NextResponse.json({
      ok: true,
      venueId: resolved.venueId,
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[product-access/lock]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

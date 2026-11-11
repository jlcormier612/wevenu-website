import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  isVenueUuid,
  resolveVenueFromCandidates,
  type VenueResolution,
} from "@/lib/entitlement/resolve-venue";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal CRM → product access lock.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Body:
 *   { venueId?, stripeCustomerId?, locked: boolean, reason?, relationshipId? }
 *
 * Venue resolution never uses owner email. Prefer an explicit venues.id UUID,
 * then an unambiguous saas_stripe_customer_id. Ambiguous or missing identity
 * fails closed without mutating any venue.
 *
 * Sets access_disabled + account_status; stores saas_stripe_customer_id for portal.
 * Never deletes data.
 */

type LockBody = {
  venueId?: string | null;
  /** Accepted for audit/compat only — never used for venue selection. */
  ownerEmail?: string | null;
  stripeCustomerId?: string | null;
  locked?: boolean;
  reason?: string | null;
  relationshipId?: string | null;
};

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

async function resolveVenueForLock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: {
    venueId?: string | null;
    stripeCustomerId?: string | null;
  },
): Promise<VenueResolution> {
  const explicit = input.venueId?.trim() || "";
  if (explicit && isVenueUuid(explicit)) {
    const { data, error } = await admin
      .from("venues")
      .select("id")
      .eq("id", explicit)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      return { ok: true, venueId: data.id as string, how: "venue_id" };
    }
  }

  const customerId = input.stripeCustomerId?.trim() || "";
  let customerMatches: string[] = [];
  if (customerId) {
    const { data, error } = await admin
      .from("venues")
      .select("id")
      .eq("saas_stripe_customer_id", customerId);
    if (error) throw error;
    customerMatches = ((data as { id: string }[] | null) ?? []).map((row) => row.id);
  }

  // ownerEmail is intentionally ignored — multi-venue purchasers share email.
  return resolveVenueFromCandidates({
    explicitVenueId: null,
    subscriptionMatches: [],
    customerMatches,
  });
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
    const resolved = await resolveVenueForLock(admin, {
      venueId: body.venueId,
      stripeCustomerId: body.stripeCustomerId,
    });

    if (!resolved.ok) {
      const detail =
        resolved.reason === "ambiguous"
          ? `Ambiguous product venue match via ${resolved.how} (${resolved.candidateIds.length} candidates). Provide productSync.venueId UUID. No venue was changed.`
          : "No matching product venue (need a real venues.id UUID, or a Stripe Customer that maps to exactly one venue). CRM suspend still applies; product hard lock skipped.";
      console.warn("[product-access/lock]", {
        relationshipId: body.relationshipId ?? null,
        venueId: body.venueId ?? null,
        stripeCustomerId: body.stripeCustomerId ?? null,
        ownerEmailIgnored: Boolean(body.ownerEmail?.trim()),
        locked: body.locked,
        reason: resolved.reason,
        how: resolved.how,
        candidateIds: resolved.candidateIds,
        detail,
      });
      return NextResponse.json({
        ok: false,
        error: detail,
        venueId: null,
        detail,
        reason: resolved.reason,
        how: resolved.how,
        candidateIds: resolved.candidateIds,
      });
    }

    // Payment / CRM reactivate must never clear an independent security lock.
    if (body.locked === false) {
      const { data: security } = await admin
        .from("venues")
        .select("manual_security_lock")
        .eq("id", resolved.venueId)
        .maybeSingle<{ manual_security_lock: boolean | null }>();
      if (security?.manual_security_lock === true) {
        const detail =
          "Unlock refused — manual_security_lock is set. Clear the security lock explicitly before restoring access.";
        console.warn("[product-access/lock]", {
          relationshipId: body.relationshipId ?? null,
          venueId: resolved.venueId,
          locked: false,
          detail,
        });
        return NextResponse.json({
          ok: false,
          error: detail,
          venueId: resolved.venueId,
          detail,
          securityLock: true,
        });
      }
    }

    const patch: Record<string, unknown> = {
      access_disabled: body.locked,
      account_status: body.locked ? "suspended" : "active",
    };
    if (body.locked === true) {
      patch.access_loss_reason = body.reason?.toLowerCase().includes("dunning")
        ? "nonpayment"
        : body.reason?.toLowerCase().includes("cancel")
          ? "voluntary_cancel"
          : patch.access_loss_reason;
      patch.access_ended_at = new Date().toISOString();
      patch.entitlement_status = "suspended";
    } else {
      patch.entitlement_status = "active";
      patch.access_loss_reason = null;
    }
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
      ownerEmailIgnored: Boolean(body.ownerEmail?.trim()),
    });

    return NextResponse.json({
      ok: true,
      venueId: resolved.venueId,
      detail,
      how: resolved.how,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[product-access/lock]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Venue — Refer a Venue submission + list (own venue only).
 */

import { NextResponse } from "next/server";

import {
  getReferralProgramReadiness,
  isReferralProgramReady,
  listCustomerReferrals,
  submitVenueReferral,
} from "@shared/pricing";
import { createClient } from "@/integrations/supabase/server";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { createReferralServiceContext } from "@/lib/referrals/service-context";
import { getCurrentVenue } from "@/lib/venue/service";

export const runtime = "nodejs";

export async function GET() {
  const venue = await getCurrentVenue();
  if (!venue) {
    return NextResponse.json({ error: "No active venue" }, { status: 401 });
  }
  const membership = await getActiveVenueMembership();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const readiness = getReferralProgramReadiness();
  if (!isReferralProgramReady(readiness)) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      readiness,
      referrals: [],
    });
  }

  const ctx = await createReferralServiceContext({ includeStripe: false });
  const referrals = await listCustomerReferrals(ctx, venue.id);
  return NextResponse.json({
    ok: true,
    enabled: true,
    readiness,
    referrals,
  });
}

export async function POST(request: Request) {
  const venue = await getCurrentVenue();
  if (!venue) {
    return NextResponse.json({ error: "No active venue" }, { status: 401 });
  }
  const membership = await getActiveVenueMembership();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const ctx = await createReferralServiceContext({ includeStripe: false });
  const result = await submitVenueReferral(ctx, {
    referringVenueId: venue.id,
    submittedByUserId: user?.id ?? null,
    submittedByEmail: user?.email ?? membership.email ?? null,
    form: {
      venueName: String(body.venueName ?? ""),
      city: String(body.city ?? ""),
      state: String(body.state ?? ""),
      website: String(body.website ?? ""),
      contactEmail: String(body.contactEmail ?? ""),
      contactName: String(body.contactName ?? ""),
      contactRole:
        typeof body.contactRole === "string" ? body.contactRole : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });

  if (!result.ok) {
    const status =
      result.code === "validation" ? 400 : result.code === "not_ready" ? 503 : 400;
    return NextResponse.json(result, { status });
  }

  // Founder/admin notice only — never emails the referred prospect.
  // Failures must not block the customer confirmation.
  try {
    const {
      INTERNAL_REFERRAL_NOTICE_META_KEY,
      notifyInternalReferralSubmitted,
    } = await import("@/lib/referrals/notify-internal");
    const notice = await notifyInternalReferralSubmitted({
      referral: result.referral,
      referringVenueName: venue.name ?? "Unknown venue",
    });
    if (notice.sent) {
      await ctx.store.updateReferral(result.referral.id, {
        metadata: {
          [INTERNAL_REFERRAL_NOTICE_META_KEY]: new Date().toISOString(),
        },
        auditEntry: {
          at: new Date().toISOString(),
          action: "internal_founder_notice_sent",
          delivery: notice.delivery,
          to: notice.to,
          idempotencyKey: notice.idempotencyKey,
        },
      });
    }
  } catch (err) {
    console.error("internal referral notice failed", err);
  }

  return NextResponse.json({
    ok: true,
    confirmation: result.confirmation,
    referral: result.customerView,
  });
}

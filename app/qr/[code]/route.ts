/**
 * QR Lead Capture — scan → record → redirect. A Route Handler, not a page
 * component, since its only job is redirecting, never rendering.
 *
 * Two destination types (inquiry_form, tour_booking) are resolved
 * dynamically from the venue's own current embed_key/tour_embed_key at
 * redirect time, rather than being baked into the campaign row — so a
 * campaign never points at a stale key if a venue's keys ever change.
 * The other two (wedding_website, external_url) use the campaign's own
 * stored destination_url directly (a wedding_website QR points at one
 * specific couple's site, which isn't something to resolve dynamically
 * the way a venue-level embed_key is).
 *
 * The campaign_id travels with the redirect as a `?qr=` param so the
 * eventual Lead submission on the destination page can attribute back to
 * this campaign in source_data — see components/form/inquiry-form.tsx.
 */
import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { publicAppOrigin } from "@/lib/env";
import { publicFormPath } from "@/lib/public-forms/public-url";
import { qrInactiveRedirectUrl } from "@/lib/qr-campaigns/inactive-redirect";
import { publicTourSchedulingPath } from "@/lib/tours/public-link";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = publicAppOrigin();
  const admin = createAdminClient();
  const inactive = () => NextResponse.redirect(qrInactiveRedirectUrl());

  const { data } = await admin.rpc("resolve_qr_scan", {
    p_code: code,
    p_user_agent: request.headers.get("user-agent"),
    p_referrer: request.headers.get("referer"),
  });

  const result = data as {
    ok: boolean; campaignId?: string; venueId?: string;
    destinationType?: string; destinationUrl?: string | null;
    publicFormId?: string | null;
  } | null;

  if (!result?.ok) {
    return inactive();
  }

  if (result.destinationType === "inquiry_form" || result.destinationType === "tour_booking") {
    const { data: venue } = await admin.from("venues")
      .select("embed_key, tour_embed_key").eq("id", result.venueId).maybeSingle<{ embed_key: string; tour_embed_key: string | null }>();

    if (result.destinationType === "inquiry_form" && venue?.embed_key) {
      return NextResponse.redirect(new URL(`/form/${venue.embed_key}?qr=${result.campaignId}`, origin));
    }
    const tourPath = publicTourSchedulingPath(venue?.tour_embed_key);
    if (result.destinationType === "tour_booking" && tourPath) {
      return NextResponse.redirect(new URL(`${tourPath}?qr=${result.campaignId}`, origin));
    }
    return inactive();
  }

  if (result.destinationType === "public_form" && result.publicFormId) {
    const { data: form } = await admin
      .from("public_forms")
      .select("public_key, status, venue_id")
      .eq("id", result.publicFormId)
      .maybeSingle<{ public_key: string; status: string; venue_id: string }>();
    if (!form || form.status !== "published" || form.venue_id !== result.venueId) {
      return inactive();
    }
    const path = publicFormPath(form.public_key);
    if (!path) return inactive();
    return NextResponse.redirect(new URL(`${path}?qr=${result.campaignId}`, origin));
  }

  if (result.destinationUrl) {
    const dest = new URL(result.destinationUrl, origin);
    dest.searchParams.set("qr", result.campaignId ?? "");
    return NextResponse.redirect(dest);
  }

  return inactive();
}

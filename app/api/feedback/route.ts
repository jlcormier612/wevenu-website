import { NextRequest, NextResponse } from "next/server";
import { createClient, createVendorClient } from "@/integrations/supabase/server";
import {
  attachmentMetaFields,
  normalizeFeedbackAttachments,
  type FeedbackAttachment,
} from "@/lib/feedback/attachments";
import { sendFeedbackEmail } from "@/lib/feedback/notify";

type FeedbackSurface = "venue" | "vendor";

/**
 * Soft product → CRM mirror + customer ack. Never blocks the feedback POST.
 * Venue-sourced feedback only (CRM links by product venue id).
 */
function pushFeedbackToCrm(input: {
  productVenueId: string;
  email?: string | null;
  venueName?: string | null;
  feedbackType: string;
  subject?: string | null;
  body?: string | null;
  rating?: number | null;
  allowPublicShare?: boolean;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
  attachments?: FeedbackAttachment[];
}): void {
  void (async () => {
    try {
      const { ingestProductFeedback } = await import("@shared/relationships");
      const result = await ingestProductFeedback({
        productVenueId: input.productVenueId,
        email: input.email,
        venueName: input.venueName,
        feedbackType: input.feedbackType,
        subject: input.subject,
        body: input.body,
        rating: input.rating,
        allowPublicShare: input.allowPublicShare,
        productFeedbackId: input.productFeedbackId,
        sourceUrl: input.sourceUrl,
        attachments: input.attachments,
      });

      if (!result?.relationship?.id) {
        console.warn(
          "[product→crm] feedback soft-fail: no Relationship linked",
          input.productVenueId,
        );
        return;
      }

      const to = input.email?.trim() || result.relationship.owner.email?.trim();
      if (!to) return;

      const { sendFeedbackConfirmationEmail } = await import("@shared/email");
      const ack = await sendFeedbackConfirmationEmail({
        relationshipId: result.relationship.id,
        to,
        firstName: result.relationship.owner.firstName,
        venueName: result.relationship.venue.name || input.venueName,
        feedbackType: input.feedbackType,
        meta: {
          product_feedback_id: input.productFeedbackId ?? null,
          product_venue_id: input.productVenueId,
          allow_public_share: input.allowPublicShare ?? false,
          attachment_count: input.attachments?.length ?? 0,
        },
      });
      console.info("[product→crm] feedback confirmation", {
        relationshipId: result.relationship.id,
        delivery: ack.delivery,
        ok: ack.ok,
        type: input.feedbackType,
      });
    } catch (error) {
      console.error("[product→crm] feedback sync failed:", error);
    }
  })();
}

function pushPartnerFeedbackToCrm(input: {
  surface: "vendor" | "client";
  productVenueId?: string | null;
  vendorId?: string | null;
  clientId?: string | null;
  email?: string | null;
  actorName?: string | null;
  feedbackType: string;
  subject?: string | null;
  body?: string | null;
  rating?: number | null;
  allowPublicShare?: boolean;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
  attachments?: FeedbackAttachment[];
}): void {
  void (async () => {
    try {
      const { ingestProductPartnerFeedback } = await import("@shared/relationships");
      if (typeof ingestProductPartnerFeedback !== "function") return;
      await ingestProductPartnerFeedback(input);
    } catch (error) {
      console.error("[product→crm] partner feedback sync failed:", error);
    }
  })();
}

function notifyMetaFrom(
  metadata: Record<string, string | number | boolean | null>,
  attachments: FeedbackAttachment[],
): Record<string, string | number | boolean | null> {
  if (attachments.length === 0) return metadata;
  return {
    ...metadata,
    attachment_count: attachments.length,
    attachment_urls: attachments.map((a) => a.url).join("\n"),
  };
}

export async function POST(req: NextRequest) {
  const bodyJson = await req.json() as {
    type: string;
    subject?: string;
    body?: string;
    rating?: number;
    surface?: FeedbackSurface;
    allow_public_share?: boolean;
    related_venue_id?: string | null;
    attachments?: unknown;
    metadata?: {
      current_url?: string;
      user_agent?: string;
      surface?: string;
      related_venue_id?: string | null;
    };
  };

  const surface: FeedbackSurface = bodyJson.surface === "vendor" ? "vendor" : "venue";
  const supabase = surface === "vendor" ? await createVendorClient() : await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    type,
    subject,
    body,
    rating,
    allow_public_share: rawAllowPublicShare,
    related_venue_id: rawRelatedVenueId,
    attachments: rawAttachments,
    metadata: clientMeta,
  } = bodyJson;

  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  // Consent only applies to NPS; ignore client true for other types.
  const allowPublicShare = type === "nps" && rawAllowPublicShare === true;
  const attachments = normalizeFeedbackAttachments(rawAttachments, type);
  const attachmentFields = attachmentMetaFields(attachments);

  const trimmedSubject = subject?.trim() || null;
  const trimmedBody = body?.trim() ?? "";

  const relatedVenueId = (
    (typeof rawRelatedVenueId === "string" && rawRelatedVenueId.trim())
    || (typeof clientMeta?.related_venue_id === "string" && clientMeta.related_venue_id.trim())
    || null
  );

  if (surface === "vendor") {
    const { data: vu } = await supabase
      .from("vendor_users")
      .select("vendor_id, vendors(business_name, created_at)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle<{
        vendor_id: string;
        vendors: { business_name: string; created_at: string } | null;
      }>();

    if (!vu) return NextResponse.json({ error: "No vendor" }, { status: 400 });

    const daysSinceSignup = vu.vendors?.created_at
      ? Math.floor((Date.now() - new Date(vu.vendors.created_at).getTime()) / 86_400_000)
      : null;

    const actorLabel = vu.vendors?.business_name ?? "Unknown vendor";
    const metadata = {
      current_url:        clientMeta?.current_url ?? null,
      user_agent:         clientMeta?.user_agent  ?? null,
      subscription_tier:  null,
      days_since_signup:  daysSinceSignup,
      venue_name:         null as string | null,
      vendor_name:        actorLabel,
      user_email:         user.email ?? null,
      surface,
      allow_public_share: allowPublicShare,
      related_venue_id:   relatedVenueId,
      ...attachmentFields,
    };

    const { data: inserted, error } = await supabase
      .from("venue_feedback")
      .insert({
        venue_id:           relatedVenueId,
        vendor_id:          vu.vendor_id,
        client_id:          null,
        user_id:            user.id,
        type,
        subject:            trimmedSubject,
        body:               trimmedBody,
        rating:             rating ?? null,
        allow_public_share: allowPublicShare,
        surface:            "vendor",
        metadata,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void sendFeedbackEmail({
      type,
      subject:   trimmedSubject,
      body:      trimmedBody,
      rating:    rating ?? null,
      userEmail: user.email ?? "unknown",
      venueName: actorLabel,
      metadata:  notifyMetaFrom({
        current_url: metadata.current_url,
        surface,
        related_venue_id: relatedVenueId,
        allow_public_share: allowPublicShare,
      }, attachments),
    });

    pushPartnerFeedbackToCrm({
      surface: "vendor",
      productVenueId: relatedVenueId,
      vendorId: vu.vendor_id,
      email: user.email ?? null,
      actorName: actorLabel,
      feedbackType: type,
      subject: trimmedSubject,
      body: trimmedBody,
      rating: rating ?? null,
      allowPublicShare,
      productFeedbackId: inserted?.id ?? null,
      sourceUrl: metadata.current_url,
      attachments,
    });

    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  }

  // Resolve venue + days since signup
  const { data: vu } = await supabase
    .from("venue_users")
    .select("venue_id, venues(name, created_at)")
    .eq("user_id", user.id)
    .maybeSingle<{ venue_id: string; venues: { name: string; created_at: string } | null }>();

  if (!vu) return NextResponse.json({ error: "No venue" }, { status: 400 });

  const daysSinceSignup = vu.venues?.created_at
    ? Math.floor((Date.now() - new Date(vu.venues.created_at).getTime()) / 86_400_000)
    : null;

  const metadata = {
    current_url:        clientMeta?.current_url ?? null,
    user_agent:         clientMeta?.user_agent  ?? null,
    subscription_tier:  null,   // populated once billing is live
    days_since_signup:  daysSinceSignup,
    venue_name:         vu.venues?.name ?? null,
    user_email:         user.email ?? null,
    surface,
    allow_public_share: allowPublicShare,
    ...attachmentFields,
  };

  const { data: inserted, error } = await supabase
    .from("venue_feedback")
    .insert({
      venue_id:           vu.venue_id,
      vendor_id:          null,
      client_id:          null,
      user_id:            user.id,
      type,
      subject:            trimmedSubject,
      body:               trimmedBody,
      rating:             rating ?? null,
      allow_public_share: allowPublicShare,
      surface:            "venue",
      metadata,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void sendFeedbackEmail({
    type,
    subject:   trimmedSubject,
    body:      trimmedBody,
    rating:    rating ?? null,
    userEmail: user.email ?? "unknown",
    venueName: vu.venues?.name ?? "Unknown venue",
    metadata:  notifyMetaFrom({
      current_url: metadata.current_url,
      surface,
      allow_public_share: allowPublicShare,
    }, attachments),
  });

  pushFeedbackToCrm({
    productVenueId: vu.venue_id,
    email: user.email,
    venueName: vu.venues?.name ?? null,
    feedbackType: type,
    subject: trimmedSubject,
    body: trimmedBody,
    rating: rating ?? null,
    allowPublicShare,
    productFeedbackId: inserted?.id ?? null,
    sourceUrl: metadata.current_url,
    attachments,
  });

  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}

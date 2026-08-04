import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendFeedbackEmail } from "@/lib/feedback/notify";

/**
 * Soft product → CRM mirror + customer ack. Never blocks the feedback POST.
 */
function pushFeedbackToCrm(input: {
  productVenueId: string;
  email?: string | null;
  venueName?: string | null;
  feedbackType: string;
  subject?: string | null;
  body?: string | null;
  rating?: number | null;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
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
        productFeedbackId: input.productFeedbackId,
        sourceUrl: input.sourceUrl,
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, subject, body, rating, metadata: clientMeta } = await req.json() as {
    type: string; subject?: string; body?: string; rating?: number;
    metadata?: { current_url?: string; user_agent?: string };
  };

  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

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
  };

  const trimmedSubject = subject?.trim() || null;
  const trimmedBody = body?.trim() ?? "";

  const { data: inserted, error } = await supabase
    .from("venue_feedback")
    .insert({
      venue_id: vu.venue_id,
      user_id:  user.id,
      type,
      subject:  trimmedSubject,
      body:     trimmedBody,
      rating:   rating ?? null,
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
    metadata,
  });

  pushFeedbackToCrm({
    productVenueId: vu.venue_id,
    email: user.email,
    venueName: vu.venues?.name ?? null,
    feedbackType: type,
    subject: trimmedSubject,
    body: trimmedBody,
    rating: rating ?? null,
    productFeedbackId: inserted?.id ?? null,
    sourceUrl: metadata.current_url,
  });

  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}

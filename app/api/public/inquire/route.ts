/**
 * POST /api/public/inquire
 *
 * Public endpoint for venue inquiry form submissions — the "direct" Source
 * Adapter into the Lead Intake pipeline (lib/lead-intake/pipeline.ts).
 * No authentication required. Protected by:
 *   - Honeypot field (checked client-side + here as backup)
 *   - Rate limiting (lib/lead-intake/rate-limit.ts, applied inside the pipeline)
 *   - SECURITY DEFINER function validates the embed_key
 *
 * After creating the lead:
 *   1. Sends a confirmation email to the inquirer (if Resend is configured)
 *   2. Sends a notification email to the venue coordinator
 * Both outcomes are recorded onto the lead_intake_attempts row so a failed
 * send is no longer invisible.
 *
 * Returns: { ok: true, referenceCode: "ABC12345" }
 */

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { recordNotificationStatus } from "@/lib/lead-intake/attempt-log";

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const {
    embedKey, firstName, lastName, email, phone,
    partnerFirst, partnerLast,
    eventType, eventDate, guestCount, estimatedBudget,
    message: inquiryMessage,
    sourceData,
    turnstileToken,
    __hp,  // server-side honeypot check (form uses 'website_url')
  } = body as Record<string, unknown>;

  // Honeypot: if any hidden field is filled, it's a bot
  if (__hp) return NextResponse.json({ ok: false, message: "Validation failed." }, { status: 400 });
  if (!embedKey || !firstName || !lastName || !email) {
    return NextResponse.json({ ok: false, message: "Required fields are missing." }, { status: 400 });
  }

  const supabase = await createClient();
  const ipAddress = clientIp(request);

  // Venue resolution happens up front (not inside create_public_lead) so
  // the pipeline can log/rate-limit against a known venue_id before the
  // RPC call — the RPC still re-validates the embed_key itself regardless
  // of this lookup, so nothing about its own security is weakened.
  const { data: venueRows } = await supabase.rpc("get_venue_by_embed_key", { p_key: String(embedKey) });
  const venue = venueRows?.[0] as { id: string; name: string; email: string | null } | undefined;

  if (!venue) {
    return NextResponse.json({ ok: false, message: "Invalid form key." }, { status: 400 });
  }

  const outcome = await ingestLead({
    supabase,
    venueId: venue.id,
    source: "website",
    trustTier: "direct",
    ipAddress,
    turnstileToken: turnstileToken ? String(turnstileToken) : null,
    rawPayload: body,
    input: {
      firstName: String(firstName),
      lastName: String(lastName),
      email: String(email),
      phone: phone ? String(phone) : null,
      partnerFirstName: partnerFirst ? String(partnerFirst) : null,
      eventType: eventType ? String(eventType) : null,
      eventDate: eventDate ? String(eventDate) : null,
      guestCount: guestCount ? Number(guestCount) : null,
      estimatedBudget: estimatedBudget ? Number(estimatedBudget) : null,
      inquiryMessage: inquiryMessage ? String(inquiryMessage) : null,
      sourceData: (sourceData ?? {}) as Record<string, unknown>,
    },
    create: async (normalized) => {
      const { data, error } = await supabase.rpc("create_public_lead", {
        p_embed_key:        String(embedKey),
        p_first_name:       normalized.firstName,
        p_last_name:        normalized.lastName,
        p_email:            normalized.email ?? "",
        p_phone:            normalized.phone ?? "",
        p_partner_first:    normalized.partnerFirstName ?? "",
        p_partner_last:     normalized.partnerLastName ?? "",
        p_partner_email:    normalized.partnerEmail ?? "",
        p_event_type:       normalized.eventType ?? "",
        p_event_date:       normalized.eventDate,
        p_guest_count:      normalized.guestCount,
        p_estimated_budget: normalized.estimatedBudget,
        p_message:          normalized.inquiryMessage ?? "",
        p_source_data:      normalized.sourceData,
      });
      if (error || !data?.ok) return { ok: false, error: data?.error ?? error?.message ?? "Could not submit inquiry." };
      // create_public_lead doesn't return relationshipId directly — a cheap
      // follow-up read, same as every other RPC-returns-just-an-id path.
      const { data: leadRow } = await supabase.from("leads").select("relationship_id")
        .eq("id", data.lead_id).maybeSingle<{ relationship_id: string | null }>();
      if (!leadRow?.relationship_id) return { ok: false, error: "Lead created without a relationship." };
      const { count } = await supabase.from("leads")
        .select("id", { count: "exact", head: true })
        .eq("relationship_id", leadRow.relationship_id);
      return {
        ok: true,
        leadId: data.lead_id as string,
        relationshipId: leadRow.relationship_id,
        isReturningRelationship: (count ?? 0) > 1,
      };
    },
  });

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, message: outcome.error }, { status: 400 });
  }

  const refCode = outcome.leadId.slice(0, 8).toUpperCase();
  const inquirerName = `${firstName} ${lastName}`;
  const inquirerEmail = String(email);

  // --- Acknowledgement emails (non-blocking — don't fail the request if email fails) ---
  const fromEmail = process.env.FROM_EMAIL ?? null;

  // 1. Confirmation email to the inquirer
  if (fromEmail) {
    sendEmail({
      to: inquirerEmail,
      subject: `We received your inquiry — ${refCode}`,
      text: [
        `Hi ${firstName},`,
        "",
        `Thank you for reaching out! We've received your inquiry and will be in touch shortly.`,
        "",
        `Your reference number: ${refCode}`,
        "",
        eventType ? `Event type: ${String(eventType).replace(/_/g, " ")}` : null,
        eventDate ? `Event date: ${new Date(String(eventDate) + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : null,
        guestCount ? `Guest count: ${guestCount}` : null,
        "",
        "We look forward to speaking with you.",
      ].filter(Boolean).join("\n"),
      replyTo: fromEmail,
    }).then(
      (result) => recordNotificationStatus(supabase, outcome.attemptId, result.ok ? "sent" : "failed"),
      () => recordNotificationStatus(supabase, outcome.attemptId, "failed"),
    );
  } else {
    void recordNotificationStatus(supabase, outcome.attemptId, "skipped");
  }

  // 2. Notification to the venue coordinator — the one that matters most
  // for "did the venue actually find out about this lead," so its outcome
  // is what lead_intake_attempts.notification_status ultimately reflects
  // (this write happens after the confirmation email's, above).
  if (fromEmail && venue.email) {
    sendEmail({
      to: venue.email,
      subject: `New inquiry: ${inquirerName}`,
      text: [
        `New inquiry received via ${venue.name}'s website form.`,
        "",
        `Name: ${inquirerName}`,
        `Email: ${inquirerEmail}`,
        phone ? `Phone: ${phone}` : null,
        partnerFirst ? `Partner: ${partnerFirst} ${partnerLast ?? ""}`.trim() : null,
        eventType ? `Event type: ${String(eventType ?? "").replace(/_/g, " ")}` : null,
        eventDate ? `Event date: ${eventDate}` : null,
        guestCount ? `Guests: ${guestCount}` : null,
        estimatedBudget ? `Budget: $${Number(estimatedBudget).toLocaleString()}` : null,
        inquiryMessage ? `\nMessage:\n${inquiryMessage}` : null,
        "",
        `Reference: ${refCode}`,
        `View in Hello to Cheers: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/leads`,
      ].filter(Boolean).join("\n"),
    }).then(
      (result) => recordNotificationStatus(supabase, outcome.attemptId, result.ok ? "sent" : "failed"),
      () => recordNotificationStatus(supabase, outcome.attemptId, "failed"),
    );
  }

  return NextResponse.json({ ok: true, referenceCode: refCode });
}

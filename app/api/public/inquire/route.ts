/**
 * POST /api/public/inquire
 */

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { INQUIRY_API_ERRORS } from "@/lib/inquiry-form/constants";
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
    __hp,
  } = body as Record<string, unknown>;

  if (__hp) return NextResponse.json({ ok: false, message: "Validation failed." }, { status: 400 });
  if (!embedKey || !firstName || !lastName || !email) {
    return NextResponse.json({ ok: false, message: "Required fields are missing." }, { status: 400 });
  }
  if (!eventType || !String(eventType).trim()) {
    return NextResponse.json({ ok: false, error: "event_type_required", message: INQUIRY_API_ERRORS.event_type_required }, { status: 400 });
  }

  const supabase = await createClient();
  const ipAddress = clientIp(request);

  const { data: venueRows } = await supabase.rpc("get_venue_by_embed_key", { p_key: String(embedKey) });
  const venue = venueRows?.[0] as { id: string; name: string; email: string | null } | undefined;

  if (!venue) {
    return NextResponse.json({ ok: false, message: "Invalid form key." }, { status: 400 });
  }

  const mergedSourceData = {
    ...(typeof sourceData === "object" && sourceData ? sourceData : {}),
    inquiry_mode: "request_information",
  };

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
      eventType: String(eventType),
      eventDate: eventDate ? String(eventDate) : null,
      guestCount: guestCount ? Number(guestCount) : null,
      estimatedBudget: estimatedBudget ? Number(estimatedBudget) : null,
      inquiryMessage: inquiryMessage ? String(inquiryMessage) : null,
      sourceData: mergedSourceData as Record<string, unknown>,
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
      if (error || !data?.ok) {
        const errKey = (data?.error as string | undefined) ?? error?.message;
        return { ok: false, error: INQUIRY_API_ERRORS[errKey ?? ""] ?? errKey ?? "Could not submit inquiry." };
      }
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
    const msg = typeof outcome.error === "string" ? outcome.error : "Could not submit inquiry.";
    return NextResponse.json({ ok: false, message: msg, error: msg }, { status: 400 });
  }

  const inquirerName = `${firstName} ${lastName}`;
  const inquirerEmail = String(email);
  const fromEmail = process.env.FROM_EMAIL ?? null;

  if (fromEmail) {
    sendEmail({
      to: inquirerEmail,
      subject: `We received your inquiry — ${venue.name}`,
      text: [
        firstName ? `Thank you, ${firstName}!` : "Thank you!",
        "",
        `We've received your inquiry for ${venue.name}.`,
        "",
        "We'll be in touch soon.",
      ].join("\n"),
      replyTo: fromEmail,
    }).then(
      (result) => recordNotificationStatus(supabase, outcome.attemptId, result.ok ? "sent" : "failed"),
      () => recordNotificationStatus(supabase, outcome.attemptId, "failed"),
    );
  } else {
    void recordNotificationStatus(supabase, outcome.attemptId, "skipped");
  }

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
        eventType ? `Event type: ${String(eventType)}` : null,
        eventDate ? `Preferred event date: ${eventDate}` : null,
        guestCount ? `Guests: ${guestCount}` : null,
        estimatedBudget ? `Budget: $${Number(estimatedBudget).toLocaleString()}` : null,
        inquiryMessage ? `\nMessage:\n${inquiryMessage}` : null,
        "",
        `View in Hello to Cheers: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/leads`,
      ].filter(Boolean).join("\n"),
    }).then(
      (result) => recordNotificationStatus(supabase, outcome.attemptId, result.ok ? "sent" : "failed"),
      () => recordNotificationStatus(supabase, outcome.attemptId, "failed"),
    );
  }

  return NextResponse.json({ ok: true });
}

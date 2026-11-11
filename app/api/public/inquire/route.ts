/**
 * POST /api/public/inquire
 */

import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { INQUIRY_API_ERRORS } from "@/lib/inquiry-form/constants";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { recordNotificationStatus } from "@/lib/lead-intake/attempt-log";
import { parsePublicLeadRpcSuccess } from "@/lib/lead-intake/public-lead-rpc";
import {
  buildPublicIntakeThankYouEmail,
  buildPublicIntakeVenueDetailBody,
} from "@/lib/lead-intake/public-intake-emails";
import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";

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
    partnerFirst, partnerLast, partnerEmail,
    eventType, eventDate, guestCount, estimatedBudget,
    message: inquiryMessage,
    sourceData,
    preferredCommunicationChannels,
    smsPermissionGranted,
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
  // The visitor session cannot insert lead_intake_attempts (RLS 42501).
  // Tour booking and email intake already log with the admin client.
  // Lead creation stays on the public RPC below, which is keyed by embed key.
  const admin = createAdminClient();
  const ipAddress = clientIp(request);

  const { data: venueRows } = await supabase.rpc("get_venue_by_embed_key", { p_key: String(embedKey) });
  const venue = venueRows?.[0] as {
    id: string;
    name: string;
    email: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
  } | undefined;

  if (!venue) {
    return NextResponse.json({ ok: false, message: "Invalid form key." }, { status: 400 });
  }

  const mergedSourceData = {
    ...(typeof sourceData === "object" && sourceData ? sourceData : {}),
    inquiry_mode: "request_information",
  };

  const outcome = await ingestLead({
    supabase: admin,
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
      partnerLastName: partnerLast ? String(partnerLast) : null,
      partnerEmail: partnerEmail ? String(partnerEmail) : null,
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
      const parsed = parsePublicLeadRpcSuccess(data as Record<string, unknown>);
      if (parsed) {
        return {
          ok: true,
          leadId: parsed.leadId,
          relationshipId: parsed.relationshipId,
          isReturningRelationship: parsed.isReturningRelationship,
        };
      }
      const leadId = String((data as { lead_id?: string }).lead_id ?? "").trim();
      if (!leadId) return { ok: false, error: "Lead created without a relationship." };
      const { data: leadRow } = await admin.from("leads").select("relationship_id")
        .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
      if (!leadRow?.relationship_id) return { ok: false, error: "Lead created without a relationship." };
      const { count } = await admin.from("leads")
        .select("id", { count: "exact", head: true })
        .eq("relationship_id", leadRow.relationship_id);
      return {
        ok: true,
        leadId,
        relationshipId: leadRow.relationship_id,
        isReturningRelationship: (count ?? 0) > 1,
      };
    },
  });

  if (!outcome.ok) {
    const msg = typeof outcome.error === "string" ? outcome.error : "Could not submit inquiry.";
    return NextResponse.json({ ok: false, message: msg, error: msg }, { status: 400 });
  }

  // First-party prefs + SMS permission (independent of phone presence alone).
  try {
    const { applyInquiryCommunicationCapture } = await import("@/lib/communication/apply-inquiry-consent");
    const capture = await applyInquiryCommunicationCapture({
      venueId: venue.id,
      venueName: venue.name,
      leadId: outcome.leadId,
      relationshipId: outcome.relationshipId ?? null,
      phone: phone ? String(phone) : null,
      preferredChannels: preferredCommunicationChannels,
      smsPermissionGranted: smsPermissionGranted === true || smsPermissionGranted === "true",
      embedKey: String(embedKey),
      source: "inquiry_form",
    });
    if (!capture.ok) {
      console.error("[public/inquire] SMS consent not recorded:", capture.message, {
        leadId: outcome.leadId,
        venueId: venue.id,
      });
    }
  } catch (err) {
    // Lead already created — do not fail the inquiry if permission write fails.
    console.error("[public/inquire] SMS consent capture failed:", err);
  }

  const inquirerName = `${firstName} ${lastName}`;
  const inquirerEmail = String(email);
  const fromEmail = process.env.FROM_EMAIL ?? null;

  if (fromEmail) {
    const thankYou = buildPublicIntakeThankYouEmail({
      kind: "inquiry",
      venueName: venue.name,
      firstName: firstName ? String(firstName) : null,
      brandSource: {
        name: venue.name,
        logo_url: venue.logo_url ?? null,
        primary_color: venue.primary_color ?? null,
      },
    });
    sendEmail({
      to: inquirerEmail,
      subject: thankYou.subject,
      text: thankYou.text,
      html: thankYou.html,
      replyTo: fromEmail,
    }).then(
      (result) => {
        if (!result.ok) console.error("[public/inquire] thank-you not accepted", result.code ?? "failed");
        return recordNotificationStatus(admin, outcome.attemptId, result.ok ? "sent" : "failed", "inquirer");
      },
      () => recordNotificationStatus(admin, outcome.attemptId, "failed", "inquirer"),
    );
  } else {
    void recordNotificationStatus(admin, outcome.attemptId, "skipped", "inquirer");
  }

  if (fromEmail && venue.email) {
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const detailLines = buildPublicIntakeVenueDetailBody({
      intro: `New inquiry received via ${venue.name}'s website form.`,
      inquirerName,
      inquirerEmail,
      phone: phone ? String(phone) : null,
      partnerLine: partnerFirst
        ? `Partner: ${String(partnerFirst)} ${partnerLast ? String(partnerLast) : ""}`.trim()
        : null,
      eventType: eventType ? String(eventType) : null,
      eventDate: eventDate ? String(eventDate) : null,
      guestCount: guestCount != null ? Number(guestCount) : null,
      estimatedBudget: estimatedBudget != null ? Number(estimatedBudget) : null,
      inquiryMessage: inquiryMessage ? String(inquiryMessage) : null,
    });
    const venueEmail = buildVenueNotificationEmail({
      title: `New inquiry from ${inquirerName}`,
      body: detailLines,
      link: `/leads/${outcome.leadId}`,
      appOrigin,
    });
    sendEmail({
      to: venue.email,
      subject: venueEmail.subject,
      text: venueEmail.text,
      html: venueEmail.html,
    }).then(
      (result) => recordNotificationStatus(admin, outcome.attemptId, result.ok ? "sent" : "failed", "venue"),
      () => recordNotificationStatus(admin, outcome.attemptId, "failed", "venue"),
    );
  }

  return NextResponse.json({ ok: true });
}

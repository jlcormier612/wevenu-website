/**
 * POST /api/public/forms/submit
 *
 * Purpose-specific Public Form → existing ingestLead → create_public_form_lead.
 * Does NOT apply SMS consent capture (Wave 1 policy: phone ≠ consent).
 */

import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { recordNotificationStatus } from "@/lib/lead-intake/attempt-log";
import {
  buildPublicIntakeThankYouEmail,
  buildPublicIntakeVenueDetailBody,
} from "@/lib/lead-intake/public-intake-emails";
import { parsePublicLeadRpcSuccess } from "@/lib/lead-intake/public-lead-rpc";
import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";
import { PUBLIC_FORM_API_ERRORS } from "@/lib/public-forms/constants";

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
    publicKey,
    firstName,
    lastName,
    email,
    phone,
    eventType,
    eventDate,
    guestCount,
    sourceData,
    turnstileToken,
    __hp,
  } = body as Record<string, unknown>;

  if (__hp) return NextResponse.json({ ok: false, message: "Validation failed." }, { status: 400 });
  if (!publicKey || !firstName || !lastName || !email) {
    return NextResponse.json({ ok: false, message: "Required fields are missing." }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const ipAddress = clientIp(request);

  // Resolve venue for notifications + intake venueId without exposing private config.
  const { data: formPayload } = await admin.rpc("get_public_form", { p_public_key: String(publicKey) });
  const formOk = formPayload as {
    ok?: boolean;
    venue?: {
      id: string;
      name: string;
      email: string | null;
      logoUrl?: string | null;
      primaryColor?: string | null;
    };
  } | null;
  if (!formOk?.ok || !formOk.venue?.id) {
    return NextResponse.json(
      { ok: false, error: "form_unavailable", message: PUBLIC_FORM_API_ERRORS.form_unavailable },
      { status: 400 },
    );
  }
  const venue = formOk.venue;

  const mergedSourceData = {
    ...(typeof sourceData === "object" && sourceData ? sourceData : {}),
  };

  // Same RLS boundary as the website inquiry route: the visitor session
  // cannot write lead_intake_attempts. Creation stays on create_public_form_lead.
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
      partnerFirstName: null,
      partnerLastName: null,
      partnerEmail: null,
      eventType: eventType ? String(eventType) : "other",
      eventDate: eventDate ? String(eventDate) : null,
      guestCount: guestCount ? Number(guestCount) : null,
      estimatedBudget: null,
      inquiryMessage: null,
      sourceData: mergedSourceData as Record<string, unknown>,
    },
    create: async (normalized) => {
      const { data, error } = await supabase.rpc("create_public_form_lead", {
        p_public_key: String(publicKey),
        p_first_name: normalized.firstName,
        p_last_name: normalized.lastName,
        p_email: normalized.email ?? "",
        p_phone: normalized.phone ?? "",
        p_event_type: normalized.eventType ?? "other",
        p_event_date: normalized.eventDate,
        p_guest_count: normalized.guestCount,
        p_message: normalized.inquiryMessage ?? "",
        p_source_data: normalized.sourceData,
      });
      if (error || !data?.ok) {
        const errKey = (data?.error as string | undefined) ?? error?.message;
        return {
          ok: false,
          error: PUBLIC_FORM_API_ERRORS[errKey ?? ""] ?? errKey ?? "Could not submit form.",
        };
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
      return { ok: false, error: "Lead created without a relationship." };
    },
  });

  if (!outcome.ok) {
    const msg = typeof outcome.error === "string" ? outcome.error : "Could not submit form.";
    return NextResponse.json({ ok: false, message: msg, error: msg }, { status: 400 });
  }

  // Wave 1: no applyInquiryCommunicationCapture — phone alone is not SMS consent.

  const inquirerName = `${firstName} ${lastName}`;
  const inquirerEmail = String(email);
  const fromEmail = process.env.FROM_EMAIL ?? null;

  if (fromEmail) {
    const thankYou = buildPublicIntakeThankYouEmail({
      kind: "submission",
      venueName: venue.name,
      firstName: firstName ? String(firstName) : null,
      brandSource: {
        name: venue.name,
        logoUrl: venue.logoUrl ?? null,
        primaryColor: venue.primaryColor ?? null,
      },
    });
    sendEmail({
      to: inquirerEmail,
      subject: thankYou.subject,
      text: thankYou.text,
      html: thankYou.html,
      replyTo: fromEmail,
    }).then(
      (result) => recordNotificationStatus(admin, outcome.attemptId, result.ok ? "sent" : "failed", "inquirer"),
      () => recordNotificationStatus(admin, outcome.attemptId, "failed", "inquirer"),
    );
  } else {
    void recordNotificationStatus(admin, outcome.attemptId, "skipped", "inquirer");
  }

  if (fromEmail && venue.email) {
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const detailLines = buildPublicIntakeVenueDetailBody({
      intro: `New lead received via a custom public form for ${venue.name}.`,
      inquirerName,
      inquirerEmail,
      phone: phone ? String(phone) : null,
      eventType: eventType ? String(eventType) : null,
      eventDate: eventDate ? String(eventDate) : null,
      guestCount: guestCount != null ? Number(guestCount) : null,
    });
    const venueEmail = buildVenueNotificationEmail({
      title: `New public form lead: ${inquirerName}`,
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

  return NextResponse.json({ ok: true, leadId: outcome.leadId });
}

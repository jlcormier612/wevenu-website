/**
 * POST /api/public/inquire
 *
 * Public endpoint for venue inquiry form submissions.
 * No authentication required. Protected by:
 *   - Honeypot field (checked client-side + here as backup)
 *   - SECURITY DEFINER function validates the embed_key
 *   - Basic input sanitisation
 *
 * After creating the lead:
 *   1. Sends a confirmation email to the inquirer (if Resend is configured)
 *   2. Sends a notification email to the venue coordinator
 *
 * Returns: { ok: true, referenceCode: "ABC12345" }
 */

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";

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
    __hp,  // server-side honeypot check (form uses 'website_url')
  } = body as Record<string, unknown>;

  // Honeypot: if any hidden field is filled, it's a bot
  if (__hp) return NextResponse.json({ ok: false, message: "Validation failed." }, { status: 400 });
  if (!embedKey || !firstName || !lastName || !email) {
    return NextResponse.json({ ok: false, message: "Required fields are missing." }, { status: 400 });
  }

  const supabase = await createClient();

  // Call the SECURITY DEFINER function to create the lead
  const { data, error } = await supabase.rpc("create_public_lead", {
    p_embed_key:        String(embedKey),
    p_first_name:       String(firstName),
    p_last_name:        String(lastName),
    p_email:            String(email),
    p_phone:            phone ? String(phone) : "",
    p_partner_first:    partnerFirst ? String(partnerFirst) : "",
    p_partner_last:     partnerLast ? String(partnerLast) : "",
    p_partner_email:    "",
    p_event_type:       eventType ? String(eventType) : "",
    p_event_date:       eventDate ? String(eventDate) : null,
    p_guest_count:      guestCount ? Number(guestCount) : null,
    p_estimated_budget: estimatedBudget ? Number(estimatedBudget) : null,
    p_message:          inquiryMessage ? String(inquiryMessage) : "",
    p_source_data:      (sourceData ?? {}) as Record<string, unknown>,
  });

  if (error || !data?.ok) {
    return NextResponse.json({ ok: false, message: data?.error ?? "Could not submit inquiry." }, { status: 400 });
  }

  const refCode = data.reference_code as string;
  const inquirerName = `${firstName} ${lastName}`;
  const inquirerEmail = String(email);

  // --- Acknowledgement emails (non-blocking — don't fail the request if email fails) ---
  const fromEmail = process.env.FROM_EMAIL ?? null;

  // 1. Confirmation email to the inquirer
  if (fromEmail) {
    void sendEmail({
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
    }).catch(() => {});
  }

  // 2. Notification to the venue coordinator
  // Fetch venue email for notification
  const { data: venueRows } = await supabase.rpc("get_venue_by_embed_key", { p_key: String(embedKey) });
  const venueEmail = venueRows?.[0]?.email;
  const venueName = venueRows?.[0]?.name ?? "your venue";

  if (fromEmail && venueEmail) {
    void sendEmail({
      to: venueEmail,
      subject: `New inquiry: ${inquirerName}`,
      text: [
        `New inquiry received via ${venueName}'s website form.`,
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
        `View in Wevenu: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/leads`,
      ].filter(Boolean).join("\n"),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, referenceCode: refCode });
}

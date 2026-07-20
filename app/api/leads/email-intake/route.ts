/**
 * POST /api/leads/email-intake
 *
 * The Email Intake Engine — a generic Source Adapter into the Lead Intake
 * pipeline (lib/lead-intake/pipeline.ts). Deliberately separate from
 * app/api/messaging/inbound/route.ts: that route is reply-matching only
 * (an inbound email always maps to an *existing* lead/client and can never
 * originate a new one, by design) — this route is the opposite, and only
 * ever originates new Leads.
 *
 * Setup (external, per venue): a venue forwards inquiry-notification
 * emails (from The Knot, WeddingWire, their own inbox — anything that
 * emails a new-inquiry notification) to leads+{lead_email_key}@{inbound
 * domain}, the same Resend inbound infrastructure and subaddressing
 * convention already used for reply-threading.
 *
 * The parser (lib/lead-intake/email-extract.ts) is generic — it extracts
 * "an inquiry" from whatever arrives, with no per-marketplace detection
 * logic. Extracted leads get a confidence score; low-confidence ones still
 * create immediately (same Lead object, same visibility as every other
 * source) but the pipeline holds Automation until a coordinator confirms
 * the details (see pipeline.ts's LOW_CONFIDENCE_THRESHOLD).
 */

import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { extractInquiryFromEmail } from "@/lib/lead-intake/email-extract";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { logIntakeAttempt, markIntakeAttempt } from "@/lib/lead-intake/attempt-log";

type InboundPayload = {
  from: string;
  to: string[];
  subject?: string;
  text?: string;
  html?: string;
};

function extractLeadEmailKey(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const match = addr.match(/leads\+([a-f0-9]+)@/);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const admin = createAdminClient();
  const subject = payload.subject ?? "";
  const body = payload.text ?? payload.html?.replace(/<[^>]+>/g, "") ?? "";
  const leadEmailKey = extractLeadEmailKey(payload.to ?? []);

  if (!leadEmailKey) {
    // No recognizable subaddress — nothing to log against a venue. Same
    // "unknown sender, log and skip" posture as the reply-matching webhook.
    console.warn("Email intake: no lead_email_key found in To addresses:", payload.to);
    return NextResponse.json({ ok: true });
  }

  const { data: venueRows } = await admin.rpc("get_venue_by_lead_email_key", { p_key: leadEmailKey });
  const venue = venueRows?.[0] as { id: string; name: string } | undefined;

  if (!venue) {
    // A stale or guessed key — still worth a durable record, venue_id null.
    await logIntakeAttempt(admin, {
      venueId: null, source: "email_parsed_generic", trustTier: "email_parsed",
      rawPayload: payload, normalizedPayload: {
        firstName: "", lastName: "", email: null, phone: null, partnerFirstName: null, partnerLastName: null,
        partnerEmail: null, eventType: null, eventDate: null, endDate: null, guestCount: null,
        estimatedBudget: null, inquiryMessage: null, inquiryDate: null, confidenceScore: null, sourceData: {},
      },
    });
    return NextResponse.json({ ok: true });
  }

  const extraction = await extractInquiryFromEmail(subject, body);

  if (!extraction.ok) {
    const attemptId = await logIntakeAttempt(admin, {
      venueId: venue.id, source: "email_parsed_generic", trustTier: "email_parsed",
      rawPayload: payload, normalizedPayload: {
        firstName: "", lastName: "", email: null, phone: null, partnerFirstName: null, partnerLastName: null,
        partnerEmail: null, eventType: null, eventDate: null, endDate: null, guestCount: null,
        estimatedBudget: null, inquiryMessage: null, inquiryDate: null, confidenceScore: null, sourceData: {},
      },
    });
    await markIntakeAttempt(admin, attemptId, { status: "rejected_invalid", errorMessage: extraction.message });
    return NextResponse.json({ ok: true });
  }

  const outcome = await ingestLead({
    supabase: admin,
    venueId: venue.id,
    source: "email_parsed_generic",
    trustTier: "email_parsed",
    rawPayload: payload,
    input: extraction.input,
    create: async (normalized) => {
      const { data, error } = await admin.rpc("ingest_lead", {
        p_venue_id: venue.id,
        p_source: "email_parsed_generic",
        p_input: {
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          email: normalized.email,
          phone: normalized.phone,
          partnerFirstName: normalized.partnerFirstName,
          partnerLastName: normalized.partnerLastName,
          partnerEmail: normalized.partnerEmail,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          guestCount: normalized.guestCount,
          inquiryMessage: normalized.inquiryMessage,
          sourceData: normalized.sourceData,
          confidenceScore: normalized.confidenceScore,
        },
      });
      if (error || !data?.ok) return { ok: false, error: data?.error ?? error?.message ?? "Could not create lead from this email." };
      return {
        ok: true,
        leadId: data.leadId as string,
        relationshipId: data.relationshipId as string,
        isReturningRelationship: data.isReturningRelationship === true,
      };
    },
  });

  if (!outcome.ok) {
    console.warn("Email intake: lead creation failed:", outcome.error);
  }

  return NextResponse.json({ ok: true });
}

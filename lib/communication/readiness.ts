/**
 * Communication Readiness — Communication Trust Experience, Phase 6.
 *
 * "A venue should know before sending its first client message whether
 * everything is configured correctly" — without ever needing to understand
 * email authentication. Email/SMS credentials are platform-level (one
 * shared Resend/Twilio account across every venue, not per-venue setup —
 * see lib/sms/send.ts's own comment on this), so most of this checklist is
 * a status report, not a wizard the venue steps through. Where something
 * genuinely can't be verified yet (a brand-new venue that hasn't sent
 * anything), the answer is an honest "not yet tested," never a fabricated
 * checkmark.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { isSmsConfigured, sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { getCurrentVenue } from "@/lib/venue/service";

export type ReadinessState = "ready" | "not_ready" | "untested";

export type ReadinessItem = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
};

export type CommunicationReadiness = {
  allReady: boolean;
  items: ReadinessItem[];
  venueEmail: string | null;
  venuePhone: string | null;
};

const EMPTY: CommunicationReadiness = { allReady: false, items: [], venueEmail: null, venuePhone: null };

export async function getCommunicationReadiness(): Promise<CommunicationReadiness> {
  if (!isSupabaseConfigured) return EMPTY;
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;
  const client = await createClient();

  const emailConfigured = isEmailConfigured();
  const smsConfigured = isSmsConfigured();

  const [hasReceivedMessage, hasNotification, hasActiveAutomation, venueRow] = await Promise.all([
    hasEverReceivedAMessage(client, venue.id),
    hasEverFiredAMessageNotification(client, venue.id),
    hasAnActiveAutomation(client, venue.id),
    client.from("venues").select("communication_test_email_at, communication_test_sms_at")
      .eq("id", venue.id).maybeSingle<{ communication_test_email_at: string | null; communication_test_sms_at: string | null }>(),
  ]);

  const testedOk = !!(venueRow.data?.communication_test_email_at || venueRow.data?.communication_test_sms_at);

  const items: ReadinessItem[] = [
    {
      key: "email", label: "Email configured",
      state: emailConfigured ? "ready" : "not_ready",
      detail: emailConfigured ? "Ready to send." : "Not set up yet — contact support to finish setup.",
    },
    {
      key: "sms", label: "Texting configured",
      state: smsConfigured ? "ready" : "not_ready",
      detail: smsConfigured ? "Ready to send." : "Not set up yet — contact support to finish setup.",
    },
    {
      key: "reply_routing", label: "Reply routing working",
      state: hasReceivedMessage ? "ready" : "untested",
      detail: hasReceivedMessage ? "A reply has been received and matched correctly." : "Not yet tested — this confirms itself the first time a lead or client replies.",
    },
    {
      key: "test_message", label: "Test message successful",
      state: testedOk ? "ready" : "untested",
      detail: testedOk ? "A real test message was delivered successfully." : "Send yourself a test message below to confirm.",
    },
    {
      key: "notifications", label: "Notifications working",
      state: hasNotification ? "ready" : "untested",
      detail: hasNotification ? "You've been notified of a real message before." : "Not yet tested — this confirms itself the first time you're notified of a message.",
    },
    {
      key: "automation", label: "Automation connected",
      state: hasActiveAutomation ? "ready" : "untested",
      detail: hasActiveAutomation ? "At least one automation is active and connected." : "No automation is turned on yet — this is optional, not required to send messages.",
    },
  ];

  return {
    allReady: items.every((i) => i.state === "ready"),
    items,
    venueEmail: venue.email, venuePhone: venue.phone,
  };
}

async function hasEverReceivedAMessage(client: Awaited<ReturnType<typeof createClient>>, venueId: string): Promise<boolean> {
  const [legacy, conversation] = await Promise.all([
    client.from("messages").select("id").eq("venue_id", venueId).eq("status", "received").limit(1),
    client.from("conversation_messages").select("id").eq("venue_id", venueId).in("sender_type", ["lead_or_client", "contact", "vendor"]).limit(1),
  ]);
  return !!(legacy.data?.length || conversation.data?.length);
}

async function hasEverFiredAMessageNotification(client: Awaited<ReturnType<typeof createClient>>, venueId: string): Promise<boolean> {
  const { data } = await client.from("venue_notifications").select("id")
    .eq("venue_id", venueId).eq("type", "message_received").limit(1);
  return !!data?.length;
}

async function hasAnActiveAutomation(client: Awaited<ReturnType<typeof createClient>>, venueId: string): Promise<boolean> {
  const { data } = await client.from("message_sequences").select("id")
    .eq("venue_id", venueId).eq("status", "active").limit(1);
  return !!data?.length;
}

export type TestSendResult = { ok: true } | { ok: false; message: string };

export async function sendTestEmail(): Promise<TestSendResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  if (!venue.email) return { ok: false, message: "No email address on file for this venue — add one in Settings first." };

  const result = await sendEmail({
    to: venue.email,
    subject: "Wevenu test message",
    text: `This is a test message from Wevenu to confirm email is working for ${venue.name}. If you received this, email is set up correctly.`,
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (result.method === "mailto") return { ok: false, message: "Email isn't fully configured for this venue yet." };

  const client = await createClient();
  await client.from("venues").update({ communication_test_email_at: new Date().toISOString() }).eq("id", venue.id);
  return { ok: true };
}

export async function sendTestSms(): Promise<TestSendResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const e164 = venue.phone ? toE164(venue.phone) : null;
  if (!e164) return { ok: false, message: "No valid phone number on file for this venue — add one in Settings first." };

  const result = await sendSms({
    to: e164,
    body: `This is a test message from Wevenu to confirm texting is working for ${venue.name}. If you received this, texting is set up correctly.`,
  });
  if (!result.ok) return { ok: false, message: result.message };

  const client = await createClient();
  await client.from("venues").update({ communication_test_sms_at: new Date().toISOString() }).eq("id", venue.id);
  return { ok: true };
}

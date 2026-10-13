/**
 * Communication Readiness — Communication Trust Experience, Phase 6.
 *
 * "A venue should know before sending its first client message whether
 * everything is configured correctly" — without ever needing to understand
 * email authentication. Email remains platform-level (shared Resend).
 * SMS/MMS readiness is venue-scoped (Twilio subaccount + Messaging Service
 * in venue_twilio_accounts). This checklist is a status report, not a
 * venue Twilio setup wizard. Where something genuinely can't be verified
 * yet (a brand-new venue that hasn't sent anything), the answer is an
 * honest "not yet tested," never a fabricated checkmark.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { isSmsConfigured, sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { getCurrentVenue } from "@/lib/venue/service";
import { acceptOutboundEmail, acceptOutboundSms } from "@/lib/conversations/delivery-result";
import { sandboxEmailRecipient, sandboxPhoneRecipient } from "@/lib/communication/mode";
import {
  SMS_TEST_NOT_CONFIGURED_MESSAGE,
  formatTestEmailSuccessMessage,
} from "@/lib/communication/test-send";

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
  emailConfigured: boolean;
  smsConfigured: boolean;
};

const EMPTY: CommunicationReadiness = {
  allReady: false,
  items: [],
  venueEmail: null,
  venuePhone: null,
  emailConfigured: false,
  smsConfigured: false,
};

export async function getCommunicationReadiness(): Promise<CommunicationReadiness> {
  if (!isSupabaseConfigured) return EMPTY;
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;
  const client = await createClient();

  const emailConfigured = isEmailConfigured();
  const smsConfigured = await isSmsConfigured(venue.id);

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
      key: "email", label: "Email connected",
      state: emailConfigured ? "ready" : "not_ready",
      detail: emailConfigured
        ? "Ready to send. Email is set up for Hello to Cheers — you don't configure it in venue Settings."
        : "Not ready yet. Email sending is set up for Hello to Cheers as a platform, not per venue. Contact support if this still shows as not ready.",
    },
    {
      key: "sms", label: "Texting setup",
      state: smsConfigured ? "ready" : "not_ready",
      detail: smsConfigured
        ? "Ready to send. Texting is configured for this venue."
        : "Not ready yet. Enable text messaging for your venue in Settings → Communications.",
    },
    {
      key: "delivery", label: "Delivery system",
      state: emailConfigured || smsConfigured ? "ready" : "not_ready",
      detail: emailConfigured || smsConfigured
        ? "Outbound delivery is operational for the channels that are ready."
        : "No delivery channel is ready yet.",
    },
    {
      key: "reply_routing", label: "Reply routing working",
      state: hasReceivedMessage ? "ready" : "untested",
      detail: hasReceivedMessage ? "A reply has been received and matched correctly." : "Not yet tested — this confirms itself the first time a lead or client replies.",
    },
    {
      key: "test_message", label: "Test message successful",
      state: testedOk ? "ready" : "untested",
      detail: testedOk
        ? "A test message was accepted by the delivery provider."
        : "Send yourself a test message below to confirm the provider accepts it.",
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
    venueEmail: venue.email,
    venuePhone: venue.phone,
    emailConfigured,
    smsConfigured,
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

export type TestSendResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function sendTestEmail(): Promise<TestSendResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  if (!isEmailConfigured()) {
    return {
      ok: false,
      message:
        "Email isn’t fully configured yet — Hello to Cheers can’t send a test until email is set up for the platform.",
    };
  }
  if (!venue.email?.trim()) {
    return { ok: false, message: "No email address on file for this venue — add one in Settings first." };
  }

  const result = await sendEmail({
    to: venue.email,
    subject: "Hello to Cheers test message",
    text: `This is a test message from Hello to Cheers to confirm email is working for ${venue.name}. If you received this, email is set up correctly.`,
  });
  const accepted = acceptOutboundEmail(result);
  if (!accepted.ok) return { ok: false, message: accepted.message };
  if (!accepted.providerId) {
    return {
      ok: false,
      message: "The email provider did not return a send id, so this was not treated as a successful test.",
    };
  }

  const client = await createClient();
  const { error } = await client
    .from("venues")
    .update({ communication_test_email_at: new Date().toISOString() })
    .eq("id", venue.id);
  if (error) {
    return {
      ok: false,
      message: "The provider accepted the test email, but Hello to Cheers could not save the readiness result. Try again.",
    };
  }

  const sandboxRedirected = Boolean(result.ok && result.sandboxRedirectedFrom);
  return {
    ok: true,
    message: formatTestEmailSuccessMessage({
      venueEmail: venue.email,
      sandboxRedirected,
      sandboxInbox: sandboxRedirected ? sandboxEmailRecipient() : null,
    }),
  };
}

export async function sendTestSms(): Promise<TestSendResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  // Short-circuit before any Twilio resolve/send when texting is not configured.
  const smsConfigured = await isSmsConfigured(venue.id);
  if (!smsConfigured) {
    return { ok: false, message: SMS_TEST_NOT_CONFIGURED_MESSAGE };
  }

  const e164 = venue.phone ? toE164(venue.phone) : null;
  if (!e164) {
    return { ok: false, message: "No valid phone number on file for this venue — add one in Settings first." };
  }

  const result = await sendSms({
    to: e164,
    body: `This is a test message from Hello to Cheers to confirm texting is working for ${venue.name}. If you received this, texting is set up correctly.`,
    venueId: venue.id,
    // Self-test to the venue's own number — not a customer send.
    skipPermissionCheck: true,
  });
  const accepted = acceptOutboundSms(result);
  if (!accepted.ok) return { ok: false, message: accepted.message };
  if (!accepted.providerId) {
    return {
      ok: false,
      message: "The texting provider did not return a message id, so this was not treated as a successful test.",
    };
  }

  const client = await createClient();
  const { error } = await client
    .from("venues")
    .update({ communication_test_sms_at: new Date().toISOString() })
    .eq("id", venue.id);
  if (error) {
    return {
      ok: false,
      message: "The provider accepted the test text, but Hello to Cheers could not save the readiness result. Try again.",
    };
  }

  const sandboxRedirected = Boolean(result.ok && result.sandboxRedirectedFrom);
  const sandboxPhone = sandboxRedirected ? sandboxPhoneRecipient() : null;
  return {
    ok: true,
    message: sandboxRedirected
      ? sandboxPhone
        ? `Test text accepted by the provider and routed to the Sandbox test number (${sandboxPhone}).`
        : "Test text accepted by the provider and routed to the Sandbox test number."
      : `Test text accepted by the provider for ${e164}. Delivery confirmation comes later from the carrier — this is not the same as Delivered.`,
  };
}

/**
 * Minimal communication permission / suppression layer.
 *
 * ── SMS product decision (LOCKED) ──────────────────────────────────────────
 * Application-originated outbound SMS requires prior express opt-in.
 *   not_opted_in  → BLOCKED
 *   opted_in      → ALLOWED
 *   opted_out     → BLOCKED (STOP / keyword / Twilio 21610)
 *   provider_blocked → BLOCKED
 *
 * Phone number entry is not consent. Selecting Text as a preference is not
 * consent. Only the explicit inquiry/tour form SMS permission checkbox
 * (or START / UNSTOP after a prior relationship) records opted_in.
 *
 * STOP must immediately persist + enforce opted_out.
 * START restores opted_in (Twilio OptOutType or start/unstop keywords only).
 * Ordinary inbound SMS is NEVER indefinite permission for future messaging.
 * Inquiry-form checkbox → opted_in with consent_text + evidence (source inquiry_form).
 *
 * ── Email ──────────────────────────────────────────────────────────────────
 * Conversation + scheduled paths hard-block opted_out / provider_blocked.
 * Central sendEmail() must NOT blindly apply one opt-out to all email until
 * the product can distinguish promotional vs relationship vs transactional
 * (see Trust email-boundary audit). Bounce/complaint still persist here.
 */
import { phoneDigits, toE164 } from "@/lib/sms/phone";

export type CommunicationChannel = "sms" | "email";
export type CommunicationPermissionStatus =
  | "not_opted_in"
  | "opted_in"
  | "opted_out"
  | "provider_blocked";

/**
 * Application-originated outbound SMS requires an opted_in row.
 * not_opted_in is not sendable.
 */
export const SMS_ALLOWS_NOT_OPTED_IN = false as const;

export type PermissionCheck =
  | { ok: true; status: CommunicationPermissionStatus }
  | { ok: false; status: CommunicationPermissionStatus; message: string };

type DbLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: <T>() => Promise<{ data: T | null }>;
          };
        };
      };
    };
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
  };
};

export function normalizeSmsAddressKey(phone: string): string | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  return phoneDigits(e164);
}

export function normalizeEmailAddressKey(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

function blockMessage(channel: CommunicationChannel, status: CommunicationPermissionStatus): string {
  if (channel === "sms") {
    if (status === "opted_out") {
      return "Texting isn't available for this contact because they opted out of texts. Try email instead.";
    }
    if (status === "not_opted_in") {
      return "Texting isn't available for this contact because they haven't given permission to be texted. Ask them to opt in, or try email instead.";
    }
    if (status === "provider_blocked") {
      return "Texting isn't available for this contact — delivery was blocked for this number. Try email instead.";
    }
  }
  if (channel === "email") {
    if (status === "opted_out") {
      return "Email can't be sent to this address because it has been unsubscribed.";
    }
    if (status === "provider_blocked") {
      return "Email can't be sent because this address previously bounced.";
    }
  }
  return "This channel isn't available for this recipient.";
}

/** Venue-facing SMS permission status — progressive, not a compliance wall. */
export function smsPermissionStatusLabel(status: CommunicationPermissionStatus): string {
  switch (status) {
    case "opted_in":
      return "Texting is ready for this contact.";
    case "not_opted_in":
      return "Texting permission hasn’t been collected for this contact. Texts can’t be sent until they opt in.";
    case "opted_out":
      return "Texting is currently opted out for this contact.";
    case "provider_blocked":
      return "Texting isn’t available for this contact — delivery was blocked.";
    default:
      return "Texting status is unavailable for this contact.";
  }
}

export function emailPermissionStatusLabel(status: CommunicationPermissionStatus): string {
  switch (status) {
    case "opted_in":
    case "not_opted_in":
      return "Email is available for this contact.";
    case "opted_out":
      return "This address is unsubscribed from email.";
    case "provider_blocked":
      return "This address previously bounced — email can’t be sent.";
    default:
      return "Email status is unavailable for this contact.";
  }
}

/** Hard blocks only — opted_out / provider_blocked. not_opted_in is never a hard block. */
export function isHardBlocked(status: CommunicationPermissionStatus): boolean {
  return status === "opted_out" || status === "provider_blocked";
}

/**
 * Whether outbound SMS may proceed. Only opted_in is sendable.
 */
export function isSmsOutboundAllowed(status: CommunicationPermissionStatus): boolean {
  if (isHardBlocked(status)) return false;
  if (status === "not_opted_in") return SMS_ALLOWS_NOT_OPTED_IN;
  return status === "opted_in";
}

export async function getCommunicationPermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  input: { venueId: string; channel: CommunicationChannel; addressKey: string },
): Promise<CommunicationPermissionStatus> {
  const { data } = await client
    .from("communication_permissions")
    .select("status")
    .eq("venue_id", input.venueId)
    .eq("channel", input.channel)
    .eq("address_key", input.addressKey)
    .maybeSingle();
  return (data?.status as CommunicationPermissionStatus | undefined) ?? "not_opted_in";
}

export async function assertChannelAllowed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  input: { venueId: string; channel: CommunicationChannel; rawAddress: string },
): Promise<PermissionCheck> {
  const addressKey = input.channel === "sms"
    ? normalizeSmsAddressKey(input.rawAddress)
    : normalizeEmailAddressKey(input.rawAddress);
  if (!addressKey) {
    return {
      ok: false,
      status: "not_opted_in",
      message: input.channel === "sms"
        ? "This phone number isn't valid for texting."
        : "This email address isn't valid.",
    };
  }
  const status = await getCommunicationPermission(client, {
    venueId: input.venueId,
    channel: input.channel,
    addressKey,
  });
  if (isHardBlocked(status)) {
    return { ok: false, status, message: blockMessage(input.channel, status) };
  }
  // SMS: explicit opt-in required. Email has no opt-in gate at this layer —
  // only hard blocks refuse.
  if (input.channel === "sms" && !isSmsOutboundAllowed(status)) {
    return { ok: false, status, message: blockMessage(input.channel, status) };
  }
  return { ok: true, status };
}

export async function upsertCommunicationPermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  input: {
    venueId: string;
    channel: CommunicationChannel;
    rawAddress: string;
    status: CommunicationPermissionStatus;
    source: string;
    evidence?: Record<string, unknown>;
    consentText?: string | null;
    relationshipId?: string | null;
  },
): Promise<{ ok: boolean; message?: string }> {
  const addressKey = input.channel === "sms"
    ? normalizeSmsAddressKey(input.rawAddress)
    : normalizeEmailAddressKey(input.rawAddress);
  if (!addressKey) return { ok: false, message: "Invalid address." };

  const { error } = await client.from("communication_permissions").upsert({
    venue_id: input.venueId,
    channel: input.channel,
    address_key: addressKey,
    status: input.status,
    source: input.source,
    evidence: input.evidence ?? {},
    consent_text: input.consentText ?? null,
    relationship_id: input.relationshipId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "venue_id,channel,address_key" });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Map Twilio OptOutType or body keywords → permission change (never invent opt-in from casual inbound). */
export function permissionFromTwilioOptOut(
  optOutType: string | null | undefined,
  body: string,
): { status: CommunicationPermissionStatus; source: string } | null {
  const typed = (optOutType ?? "").trim().toUpperCase();
  if (typed === "STOP") return { status: "opted_out", source: "twilio_stop" };
  if (typed === "START") return { status: "opted_in", source: "twilio_start" };
  if (typed === "HELP") return null;

  const normalized = body.trim().toLowerCase().replace(/[.!]/g, "");
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(normalized)) {
    return { status: "opted_out", source: "sms_keyword_stop" };
  }
  // Do NOT treat casual "yes"/inbound replies as opt-in — only explicit START keywords
  // (or Twilio OptOutType=START). Affirmative consent collection is a separate product.
  if (["start", "unstop"].includes(normalized)) {
    return { status: "opted_in", source: "sms_keyword_start" };
  }
  return null;
}

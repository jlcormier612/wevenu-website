/**
 * Phone A2P registration status — Event Streams mapping and apply rules.
 * Pure helpers; no Twilio network calls.
 */

export const PHONE_A2P_EVENT_TYPES = [
  "com.twilio.messaging.compliance.number-registration.pending",
  "com.twilio.messaging.compliance.number-registration.successful",
  "com.twilio.messaging.compliance.number-registration.failed",
  "com.twilio.messaging.compliance.number-deregistration.pending",
  "com.twilio.messaging.compliance.number-deregistration.successful",
  "com.twilio.messaging.compliance.number-deregistration.failed",
] as const;

export type PhoneA2pEventType = (typeof PHONE_A2P_EVENT_TYPES)[number];

export const PHONE_A2P_STATUSES = [
  "PENDING_REGISTRATION",
  "REGISTERED",
  "FAILURE",
  "PENDING_DEREGISTRATION",
  "UNREGISTERED",
] as const;

export type PhoneA2pStatus = (typeof PHONE_A2P_STATUSES)[number];

export function isPhoneA2pEventType(value: string): value is PhoneA2pEventType {
  return (PHONE_A2P_EVENT_TYPES as readonly string[]).includes(value);
}

export function isPhoneA2pRegistered(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toUpperCase();
  return normalized === "REGISTERED" || normalized === "SUCCESS" || normalized === "APPROVED";
}

/** Map CloudEvents type (+ optional externalstatus) to HTC-normalized phone status. */
export function phoneA2pStatusFromEvent(
  eventType: string,
  externalStatus?: string | null,
): PhoneA2pStatus | null {
  switch (eventType) {
    case "com.twilio.messaging.compliance.number-registration.pending":
      return "PENDING_REGISTRATION";
    case "com.twilio.messaging.compliance.number-registration.successful":
      return "REGISTERED";
    case "com.twilio.messaging.compliance.number-registration.failed":
      return "FAILURE";
    case "com.twilio.messaging.compliance.number-deregistration.pending":
      return "PENDING_DEREGISTRATION";
    case "com.twilio.messaging.compliance.number-deregistration.successful":
      return "UNREGISTERED";
    case "com.twilio.messaging.compliance.number-deregistration.failed":
      return "FAILURE";
    default: {
      const ext = (externalStatus ?? "").trim().toLowerCase();
      if (ext === "pending_registration" || ext === "pending") return "PENDING_REGISTRATION";
      if (ext === "registered") return "REGISTERED";
      if (ext === "failure" || ext === "failed") return "FAILURE";
      if (ext === "pending_deregistration") return "PENDING_DEREGISTRATION";
      if (ext === "unregistered") return "UNREGISTERED";
      return null;
    }
  }
}

export type PhoneA2pEventPayload = {
  eventId: string;
  eventType: string;
  eventTimeMs: number | null;
  accountSid: string;
  phoneNumberSid: string | null;
  messagingServiceSid: string | null;
  campaignSid: string | null;
  externalStatus: string | null;
  phoneNumber: string | null;
};

export type PhoneA2pApplyDecision =
  | { action: "reject"; reason: string }
  | { action: "ignore"; reason: string }
  | {
      action: "apply";
      phoneA2pStatus: PhoneA2pStatus;
      clearSendReady: boolean;
      needsAttention: boolean;
      attentionCode: string | null;
      attentionMessage: string | null;
      attentionFixHint: string | null;
    };

function sameSid(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left || !right) return true; // missing on either side → soft skip
  return left === right;
}

/**
 * Decide whether an Event Streams number event may update venue state.
 * Campaign SIDs in number events are often CM… while HTC stores Usa2p QE… —
 * do not hard-fail on campaign SID format mismatch.
 */
export function decidePhoneA2pEventApply(input: {
  payload: PhoneA2pEventPayload;
  venueAccountSid: string;
  expectedPhoneNumberSid: string | null;
  expectedMessagingServiceSid: string | null;
  lastEventTimeMs: number | null;
  alreadyProcessedEventId: boolean;
}): PhoneA2pApplyDecision {
  const { payload } = input;

  if (input.alreadyProcessedEventId) {
    return { action: "ignore", reason: "duplicate_event_id" };
  }

  if (!payload.accountSid || payload.accountSid !== input.venueAccountSid) {
    return { action: "reject", reason: "account_sid_mismatch" };
  }

  if (
    input.expectedPhoneNumberSid
    && payload.phoneNumberSid
    && !sameSid(payload.phoneNumberSid, input.expectedPhoneNumberSid)
  ) {
    return { action: "reject", reason: "phone_number_sid_mismatch" };
  }

  if (
    input.expectedMessagingServiceSid
    && payload.messagingServiceSid
    && !sameSid(payload.messagingServiceSid, input.expectedMessagingServiceSid)
  ) {
    return { action: "reject", reason: "messaging_service_sid_mismatch" };
  }

  if (
    input.lastEventTimeMs != null
    && payload.eventTimeMs != null
    && payload.eventTimeMs < input.lastEventTimeMs
  ) {
    return { action: "ignore", reason: "stale_event" };
  }

  const status = phoneA2pStatusFromEvent(payload.eventType, payload.externalStatus);
  if (!status) {
    return { action: "reject", reason: "unknown_event_type" };
  }

  if (status === "REGISTERED") {
    return {
      action: "apply",
      phoneA2pStatus: status,
      clearSendReady: false,
      needsAttention: false,
      attentionCode: null,
      attentionMessage: null,
      attentionFixHint: null,
    };
  }

  if (status === "PENDING_REGISTRATION") {
    return {
      action: "apply",
      phoneA2pStatus: status,
      clearSendReady: true,
      needsAttention: false,
      attentionCode: null,
      attentionMessage: null,
      attentionFixHint: null,
    };
  }

  if (status === "FAILURE") {
    return {
      action: "apply",
      phoneA2pStatus: status,
      clearSendReady: true,
      needsAttention: true,
      attentionCode: "number_registration_failed",
      attentionMessage:
        "We couldn’t finish setting up your texting number. Please contact support so we can continue.",
      attentionFixHint: "No change is required to your business details unless support asks.",
    };
  }

  // Deregistration pending / successful — disable sending, pause venue texting.
  return {
    action: "apply",
    phoneA2pStatus: status,
    clearSendReady: true,
    needsAttention: false,
    attentionCode: "number_deregistered",
    attentionMessage:
      "Texting for your venue is paused while your texting number registration is being updated.",
    attentionFixHint: "No action is required from you right now. We’ll update this page when setup finishes.",
  };
}

/** Parse a single CloudEvent from an Event Streams batch item. */
export function parsePhoneA2pCloudEvent(raw: unknown): PhoneA2pEventPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as Record<string, unknown>;
  const eventType = typeof event.type === "string" ? event.type : "";
  if (!isPhoneA2pEventType(eventType)) return null;

  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  if (!eventId) return null;

  let data: Record<string, unknown> = {};
  if (typeof event.data === "string") {
    try {
      data = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      data = {};
    }
  } else if (event.data && typeof event.data === "object") {
    data = event.data as Record<string, unknown>;
  }

  const accountSid = String(data.accountsid ?? data.accountSid ?? "").trim();
  if (!accountSid) return null;

  const updated = data.updateddate ?? data.updatedDate ?? data.timestamp;
  let eventTimeMs: number | null = null;
  if (typeof updated === "number" && Number.isFinite(updated)) {
    eventTimeMs = updated < 1_000_000_000_000 ? updated * 1000 : updated;
  } else if (typeof event.time === "string") {
    const parsed = Date.parse(event.time);
    if (!Number.isNaN(parsed)) eventTimeMs = parsed;
  }

  return {
    eventId,
    eventType,
    eventTimeMs,
    accountSid,
    phoneNumberSid: String(data.phonenumbersid ?? data.phoneNumberSid ?? "").trim() || null,
    messagingServiceSid:
      String(data.messagingservicesid ?? data.messagingServiceSid ?? "").trim() || null,
    campaignSid: String(data.campaignsid ?? data.campaignSid ?? "").trim() || null,
    externalStatus: String(data.externalstatus ?? data.externalStatus ?? "").trim() || null,
    phoneNumber: String(data.phonenumber ?? data.phoneNumber ?? "").trim() || null,
  };
}

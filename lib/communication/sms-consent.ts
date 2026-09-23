/**
 * First-party SMS consent language + evidence helpers for the inquiry form.
 * Outbound SMS requires opted_in (see isSmsOutboundAllowed). STOP/START
 * rules are unchanged: ordinary inbound is not ongoing permission.
 */

export const SMS_INQUIRY_CONSENT_LANGUAGE_VERSION = "htc_sms_inquiry_v2" as const;

export const SMS_PERMISSION_SOURCE_INQUIRY_FORM = "inquiry_form" as const;
export const SMS_PERMISSION_SOURCE_TOUR_FORM = "tour_form" as const;
/** Venue asked the contact to reply START — status stays not_opted_in until they do. */
export const SMS_PERMISSION_SOURCE_CONSENT_REQUEST = "sms_consent_request" as const;
export const SMS_CONSENT_REQUEST_LANGUAGE_VERSION = "htc_sms_consent_request_v1" as const;

/** Venue-facing short labels for communication_permissions.status. */
export function smsPermissionDisplayLabel(
  status: "not_opted_in" | "opted_in" | "opted_out" | "provider_blocked",
): string {
  switch (status) {
    case "opted_in":
      return "Allowed";
    case "opted_out":
      return "Opted out";
    case "provider_blocked":
      return "Blocked";
    case "not_opted_in":
    default:
      return "Not opted in";
  }
}

export function smsPermissionSourceLabel(source: string | null | undefined): string {
  switch ((source ?? "").trim()) {
    case SMS_PERMISSION_SOURCE_INQUIRY_FORM:
      return "Text permission provided through website inquiry";
    case SMS_PERMISSION_SOURCE_TOUR_FORM:
      return "Text permission provided through tour booking";
    case SMS_PERMISSION_SOURCE_CONSENT_REQUEST:
      return "Text permission requested — waiting for them to reply START";
    case "twilio_stop":
    case "sms_keyword_stop":
      return "Customer opted out via text message";
    case "twilio_start":
    case "sms_keyword_start":
      return "Customer opted back in via text message";
    case "twilio_21610":
      return "Carrier reported this number opted out";
    default:
      return source?.trim() ? `Updated via ${source}` : "Permission status on file";
  }
}

/** Exact checkbox language shown on the public lead form (not legal advice). */
export function buildInquirySmsConsentText(venueName: string): string {
  const name = venueName.trim() || "this venue";
  return (
    `Yes, I’d like to receive text messages from ${name} about my inquiry, tour, or event. ` +
    `Message and data rates may apply. Reply STOP to opt out.`
  );
}

/**
 * Outbound solicitation SMS when a venue requests text permission from a
 * contact who has not opted in yet. Does not grant permission by itself —
 * the contact must reply START (or use the public form checkbox).
 */
export function buildSmsConsentRequestText(venueName: string): string {
  const name = venueName.trim() || "this venue";
  return (
    `${name} would like to text you about your inquiry, tour, or event. ` +
    `Reply START to agree to receive texts. Message and data rates may apply. ` +
    `Reply STOP to opt out. Reply HELP for help.`
  );
}

/** Shown next to the SMS checkbox so reviewers/end users see voluntary consent. */
export const INQUIRY_SMS_CONSENT_OPTIONAL_HINT =
  "Optional — you can submit your inquiry or book your tour without agreeing to text messages. Providing a phone number alone does not authorize texts." as const;

/**
 * Public disclosure already published on the SMS opt-in evidence page.
 * The inquiry and tour forms use these sentences; do not paraphrase them.
 */
export const SMS_PUBLIC_CONSENT_DISCLOSURES = [
  "Phone number entry alone is not SMS consent.",
  "Choosing “Text message” as a preferred contact method is not SMS consent.",
  "Accepting Privacy Policy or End User Terms is not SMS consent.",
  "SMS consent is not required to inquire, book a tour, or use Hello to Cheers.",
  "Message frequency varies with the inquiry, tour, and event planning — occasional relationship messages, not a fixed daily volume.",
  "Message and data rates may apply.",
  "Reply STOP to opt out; reply START to opt back in; reply HELP for help.",
] as const;

export type InquiryCommunicationSettings = {
  askPreferences: boolean;
  offerEmail: boolean;
  offerSms: boolean;
  offerPhoneCall: boolean;
  /** Separate from prefs — whether the form shows the SMS permission checkbox. */
  requestSmsPermission: boolean;
};

export const DEFAULT_INQUIRY_COMMUNICATION_SETTINGS: InquiryCommunicationSettings = {
  askPreferences: false,
  offerEmail: true,
  offerSms: true,
  offerPhoneCall: true,
  requestSmsPermission: true,
};

export type PreferredCommunicationChannel = "email" | "sms" | "phone_call";

export function parseInquiryCommunicationSettings(raw: unknown): InquiryCommunicationSettings {
  const base = { ...DEFAULT_INQUIRY_COMMUNICATION_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    askPreferences: o.askPreferences === true,
    offerEmail: o.offerEmail !== false,
    offerSms: o.offerSms !== false,
    offerPhoneCall: o.offerPhoneCall !== false,
    requestSmsPermission: o.requestSmsPermission !== false,
  };
}

export function parsePreferredCommunicationChannels(raw: unknown): PreferredCommunicationChannel[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<PreferredCommunicationChannel>(["email", "sms", "phone_call"]);
  const out: PreferredCommunicationChannel[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item as PreferredCommunicationChannel)) {
      if (!out.includes(item as PreferredCommunicationChannel)) out.push(item as PreferredCommunicationChannel);
    }
  }
  return out;
}

export function preferredChannelLabel(channel: PreferredCommunicationChannel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "sms":
      return "Text message";
    case "phone_call":
      return "Phone call";
  }
}

/**
 * Effective public-form settings. Text and the optional SMS permission
 * checkbox follow the venue's form settings. A missing sending number does
 * not hide them: outbound SMS stays blocked until the venue is send-ready
 * and the person is opted_in.
 */
export function effectivePublicCommunicationSettings(
  settings: InquiryCommunicationSettings,
): InquiryCommunicationSettings & {
  showPreferences: boolean;
  showSmsPermission: boolean;
  offeredChannels: PreferredCommunicationChannel[];
} {
  const offerSms = settings.offerSms;
  const offerEmail = settings.offerEmail;
  const offerPhoneCall = settings.offerPhoneCall;
  const offeredChannels: PreferredCommunicationChannel[] = [];
  if (offerEmail) offeredChannels.push("email");
  if (offerSms) offeredChannels.push("sms");
  if (offerPhoneCall) offeredChannels.push("phone_call");

  const askPreferences = settings.askPreferences && offeredChannels.length > 0;
  const showSmsPermission = settings.requestSmsPermission;

  return {
    ...settings,
    offerSms,
    askPreferences,
    requestSmsPermission: showSmsPermission,
    showPreferences: askPreferences,
    showSmsPermission,
    offeredChannels,
  };
}

/**
 * First-party SMS consent language + evidence helpers for the inquiry form.
 * Outbound SMS requires opted_in (see isSmsOutboundAllowed). STOP/START
 * rules are unchanged: ordinary inbound is not ongoing permission.
 */

export const SMS_INQUIRY_CONSENT_LANGUAGE_VERSION = "htc_sms_inquiry_v2" as const;

export const SMS_PERMISSION_SOURCE_INQUIRY_FORM = "inquiry_form" as const;
export const SMS_PERMISSION_SOURCE_TOUR_FORM = "tour_form" as const;

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

/** Shown next to the SMS checkbox so reviewers/end users see voluntary consent. */
export const INQUIRY_SMS_CONSENT_OPTIONAL_HINT =
  "Optional — you can submit your inquiry or book your tour without agreeing to text messages. Providing a phone number alone does not authorize texts." as const;

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
 * Effective public-form settings: SMS preference option and SMS permission
 * request are unavailable when the venue cannot yet offer SMS (no sender /
 * not in pending_compliance or ready). Outbound send readiness is separate.
 */
export function effectivePublicCommunicationSettings(
  settings: InquiryCommunicationSettings,
  smsConsentOfferAvailable: boolean,
): InquiryCommunicationSettings & {
  showPreferences: boolean;
  showSmsPermission: boolean;
  offeredChannels: PreferredCommunicationChannel[];
} {
  const offerSms = settings.offerSms && smsConsentOfferAvailable;
  const offerEmail = settings.offerEmail;
  const offerPhoneCall = settings.offerPhoneCall;
  const offeredChannels: PreferredCommunicationChannel[] = [];
  if (offerEmail) offeredChannels.push("email");
  if (offerSms) offeredChannels.push("sms");
  if (offerPhoneCall) offeredChannels.push("phone_call");

  const askPreferences = settings.askPreferences && offeredChannels.length > 0;
  const showSmsPermission = settings.requestSmsPermission && smsConsentOfferAvailable;

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

/**
 * A2P 10DLC Campaign payload builder (ops / Track B).
 *
 * Single source of truth for Hello to Cheers campaign create/resubmit fields.
 * Does NOT call Twilio. Callers must pass returned fields into create/edit —
 * never invent a Campaign POST that drops policy URLs or voluntary-consent language.
 *
 * Policy URLs (Hello to Cheers — not QuickCloud):
 *   Privacy Policy → https://hellotocheers.com/privacy
 *   End User Terms → https://hellotocheers.com/end-user-terms
 *
 * Public reviewer evidence (static opt-in illustration, no login):
 *   https://hellotocheers.com/sms-opt-in
 */

export const A2P_CAMPAIGN_PRIVACY_POLICY_PARAM = "PrivacyPolicyUrl" as const;
export const A2P_CAMPAIGN_TERMS_PARAM = "TermsAndConditionsUrl" as const;

/** Canonical Hello to Cheers public origin (verified live, no login). */
export const HELLO_TO_CHEERS_PUBLIC_ORIGIN = "https://hellotocheers.com" as const;
export const HELLO_TO_CHEERS_PRIVACY_POLICY_PATH = "/privacy" as const;
export const HELLO_TO_CHEERS_END_USER_TERMS_PATH = "/end-user-terms" as const;
/** Public page Twilio reviewers can open without venue credentials. */
export const HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_PATH = "/sms-opt-in" as const;

export const HELLO_TO_CHEERS_PRIVACY_POLICY_URL =
  `${HELLO_TO_CHEERS_PUBLIC_ORIGIN}${HELLO_TO_CHEERS_PRIVACY_POLICY_PATH}` as const;
export const HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL =
  `${HELLO_TO_CHEERS_PUBLIC_ORIGIN}${HELLO_TO_CHEERS_END_USER_TERMS_PATH}` as const;
export const HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL =
  `${HELLO_TO_CHEERS_PUBLIC_ORIGIN}${HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_PATH}` as const;

export const A2P_CAMPAIGN_MESSAGE_FREQUENCY =
  "Message frequency varies with the inquiry, tour, and event planning; messages are occasional and tied to that relationship, not a fixed daily volume." as const;

export const A2P_CAMPAIGN_DESCRIPTION =
  "Venue relationship SMS via Hello to Cheers: inquiry, tour, and event-planning logistics." as const;

/** Keyword opt-in only — never YES (casual inbound must not become consent). */
export const A2P_CAMPAIGN_OPT_IN_KEYWORDS = ["START", "UNSTOP"] as const;
export const A2P_CAMPAIGN_OPT_OUT_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"] as const;
export const A2P_CAMPAIGN_HELP_KEYWORDS = ["HELP", "INFO"] as const;

export const A2P_CAMPAIGN_SUPPORT_EMAIL = "privacy@hellotocheers.com" as const;

export function buildA2pCampaignOptInMessage(brandName: string): string {
  const name = brandName.trim() || "this venue";
  return (
    `You are opted in to texts from ${name} via Hello to Cheers about your inquiry, tour, or event. ` +
    `Msg & data rates may apply. Reply STOP to opt out, HELP for help.`
  );
}

export function buildA2pCampaignOptOutMessage(brandName: string): string {
  const name = brandName.trim() || "this venue";
  return (
    `You are opted out of texts from ${name} via Hello to Cheers. ` +
    `No more messages will be sent. Reply START to opt back in.`
  );
}

export function buildA2pCampaignHelpMessage(brandName: string): string {
  const name = brandName.trim() || "this venue";
  return (
    `${name} via Hello to Cheers: For help with these texts, contact ${A2P_CAMPAIGN_SUPPORT_EMAIL}. ` +
    `Reply STOP to opt out. Msg & data rates may apply.`
  );
}

export type A2pCampaignPolicyUrls = {
  privacyPolicyUrl: string;
  termsUrl: string;
};

export type A2pMessageFlowInput = {
  /** Venue / brand display name as end users know it (e.g. QuickCloud LLC). */
  brandName: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  /**
   * Honest relationship-SMS frequency for TCR (required disclosure).
   * Default matches variable inquiry / event-planning traffic — not a fixed volume.
   */
  messageFrequency?: string;
  /** Public URL where a Twilio reviewer can inspect the opt-in UI. */
  publicOptInEvidenceUrl?: string;
};

export type A2pCampaignCreateFields = {
  BrandRegistrationSid: string;
  Description: string;
  MessageFlow: string;
  MessageSamples: string[];
  UsAppToPersonUsecase: string;
  HasEmbeddedLinks: "true" | "false";
  HasEmbeddedPhone: "true" | "false";
  [A2P_CAMPAIGN_PRIVACY_POLICY_PARAM]: string;
  [A2P_CAMPAIGN_TERMS_PARAM]: string;
  OptInMessage: string;
  OptOutMessage: string;
  HelpMessage: string;
  OptInKeywords: string[];
  OptOutKeywords: string[];
  HelpKeywords: string[];
};

function hostnameIsQuickCloud(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "quickcloud.co" || host.endsWith(".quickcloud.co");
}

function hostnameIsHelloToCheers(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "hellotocheers.com" || host === "www.hellotocheers.com";
}

function normalizedPath(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function requireHttpsUrl(label: string, value: string): URL {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required for A2P Campaign submission.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https.`);
  }
  return parsed;
}

function requireHtcLegalUrl(label: string, value: string, expectedPath: string): string {
  const parsed = requireHttpsUrl(label, value);
  if (hostnameIsQuickCloud(parsed.hostname)) {
    throw new Error(`${label} must be a Hello to Cheers URL, not QuickCloud.`);
  }
  if (!hostnameIsHelloToCheers(parsed.hostname)) {
    throw new Error(`${label} must use the Hello to Cheers public site.`);
  }
  if (normalizedPath(parsed.pathname) !== expectedPath) {
    throw new Error(`${label} must be ${expectedPath} on the Hello to Cheers site.`);
  }
  return parsed.toString().replace(/\/+$/, "");
}

function requireHtcEvidenceUrl(label: string, value: string): string {
  const parsed = requireHttpsUrl(label, value);
  if (hostnameIsQuickCloud(parsed.hostname)) {
    throw new Error(`${label} must be a Hello to Cheers URL, not QuickCloud.`);
  }
  if (!hostnameIsHelloToCheers(parsed.hostname)) {
    throw new Error(`${label} must use the Hello to Cheers public site.`);
  }
  return parsed.toString().replace(/\/+$/, "");
}

/**
 * Fail-closed: Campaign create/resubmit payloads must include both HTC policy URLs.
 * Reads from registration (or explicit overrides) — never silently omits.
 */
export function requireA2pCampaignPolicyUrls(input: {
  privacyPolicyUrl: string | null | undefined;
  termsUrl: string | null | undefined;
}): A2pCampaignPolicyUrls {
  return {
    privacyPolicyUrl: requireHtcLegalUrl(
      "PrivacyPolicyUrl",
      input.privacyPolicyUrl ?? "",
      HELLO_TO_CHEERS_PRIVACY_POLICY_PATH,
    ),
    termsUrl: requireHtcLegalUrl(
      "TermsAndConditionsUrl",
      input.termsUrl ?? "",
      HELLO_TO_CHEERS_END_USER_TERMS_PATH,
    ),
  };
}

/**
 * MessageFlow for a Twilio compliance reviewer who has never seen the product.
 * Explicitly states voluntary/optional SMS consent — never required to inquire,
 * book a tour, use the service, or complete the underlying transaction.
 */
export function buildA2pCampaignMessageFlow(input: A2pMessageFlowInput): string {
  const urls = requireA2pCampaignPolicyUrls({
    privacyPolicyUrl: input.privacyPolicyUrl,
    termsUrl: input.termsUrl,
  });
  const frequency = input.messageFrequency?.trim() || A2P_CAMPAIGN_MESSAGE_FREQUENCY;
  const evidenceUrl = requireHtcEvidenceUrl(
    "PublicOptInEvidenceUrl",
    input.publicOptInEvidenceUrl?.trim() || HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL,
  );
  const brand = input.brandName.trim() || "the venue";

  const flow = [
    `End users encounter SMS consent on a venue's public Hello to Cheers inquiry form and tour-booking form (illustrated for reviewers at ${evidenceUrl}).`,
    `Those forms collect contact details so the venue can respond about the inquiry or tour.`,
    `Providing a phone number alone is not SMS consent.`,
    `Selecting Text as a preferred communication method is not SMS consent.`,
    `Accepting Hello to Cheers Terms is not SMS consent.`,
    `When the venue enables the text-message permission request, the form shows a separate SMS checkbox that is unchecked by default and is not required to submit.`,
    `SMS consent is optional and voluntary: end users may submit an inquiry without agreeing to text messages, may book a tour without agreeing to text messages, and may use Hello to Cheers and complete the underlying inquiry or tour transaction without SMS consent.`,
    `SMS consent is not a condition of using the service.`,
    `Only if the end user affirmatively checks the separate SMS permission box (with a phone number present) does Hello to Cheers record express consent for ${brand} (via Hello to Cheers) to send relationship SMS about their inquiry, tour, event planning, and related logistics.`,
    frequency,
    `Message and data rates may apply.`,
    `Reply STOP to opt out of further texts; reply START to opt back in; reply HELP for help.`,
    `Ordinary inbound text replies (including casual replies such as YES) are not treated as ongoing SMS permission.`,
    `Mobile numbers and SMS consent/opt-in data are not sold or shared with third parties or affiliates for their marketing or promotional purposes.`,
    `Privacy Policy: ${urls.privacyPolicyUrl}`,
    `Terms & Conditions: ${urls.termsUrl}`,
    `Public opt-in evidence: ${evidenceUrl}`,
  ].join(" ");

  if (flow.length < 40) {
    throw new Error("MessageFlow must be at least 40 characters.");
  }
  if (flow.length > 2048) {
    throw new Error("MessageFlow exceeds the 2048 character A2P maximum.");
  }
  return flow;
}

/**
 * Build the Twilio form fields for Usa2p create/update.
 * PrivacyPolicyUrl and TermsAndConditionsUrl are always present when this returns.
 * Opt-in keywords never include YES.
 */
export function buildA2pCampaignCreateFields(input: {
  brandRegistrationSid: string;
  brandName: string;
  privacyPolicyUrl: string | null | undefined;
  termsUrl: string | null | undefined;
  description?: string;
  messageSamples?: string[];
  usecase?: string;
  hasEmbeddedLinks?: boolean;
  hasEmbeddedPhone?: boolean;
  messageFrequency?: string;
  publicOptInEvidenceUrl?: string;
}): A2pCampaignCreateFields {
  const urls = requireA2pCampaignPolicyUrls(input);
  const brandName = input.brandName.trim() || "the venue";
  const messageFlow = buildA2pCampaignMessageFlow({
    brandName,
    privacyPolicyUrl: urls.privacyPolicyUrl,
    termsUrl: urls.termsUrl,
    messageFrequency: input.messageFrequency,
    publicOptInEvidenceUrl: input.publicOptInEvidenceUrl,
  });

  const samples =
    input.messageSamples && input.messageSamples.length >= 2
      ? input.messageSamples
      : [
          `Hi — this is ${brandName} confirming your tour Saturday at 2pm via Hello to Cheers. Reply STOP to opt out.`,
          `Reminder from ${brandName}: your venue walkthrough is tomorrow at 11am. Reply STOP to opt out.`,
        ];

  const optInMessage = buildA2pCampaignOptInMessage(brandName);
  const optOutMessage = buildA2pCampaignOptOutMessage(brandName);
  const helpMessage = buildA2pCampaignHelpMessage(brandName);

  for (const [label, value] of [
    ["OptInMessage", optInMessage],
    ["OptOutMessage", optOutMessage],
    ["HelpMessage", helpMessage],
  ] as const) {
    if (/quickcloud\.co|help@quickcloud/i.test(value)) {
      throw new Error(`${label} must not contain QuickCloud contact residue.`);
    }
  }

  return {
    BrandRegistrationSid: input.brandRegistrationSid.trim(),
    Description: input.description?.trim() || A2P_CAMPAIGN_DESCRIPTION,
    MessageFlow: messageFlow,
    MessageSamples: samples,
    UsAppToPersonUsecase: input.usecase?.trim() || "LOW_VOLUME",
    HasEmbeddedLinks: input.hasEmbeddedLinks ? "true" : "false",
    HasEmbeddedPhone: input.hasEmbeddedPhone ? "true" : "false",
    [A2P_CAMPAIGN_PRIVACY_POLICY_PARAM]: urls.privacyPolicyUrl,
    [A2P_CAMPAIGN_TERMS_PARAM]: urls.termsUrl,
    OptInMessage: optInMessage,
    OptOutMessage: optOutMessage,
    HelpMessage: helpMessage,
    OptInKeywords: [...A2P_CAMPAIGN_OPT_IN_KEYWORDS],
    OptOutKeywords: [...A2P_CAMPAIGN_OPT_OUT_KEYWORDS],
    HelpKeywords: [...A2P_CAMPAIGN_HELP_KEYWORDS],
  };
}

/** Assert a raw form-field map cannot omit policy URLs (guards scripts). */
export function assertA2pCampaignPayloadHasPolicyUrls(
  fields: Record<string, unknown>,
): void {
  requireA2pCampaignPolicyUrls({
    privacyPolicyUrl:
      typeof fields[A2P_CAMPAIGN_PRIVACY_POLICY_PARAM] === "string"
        ? (fields[A2P_CAMPAIGN_PRIVACY_POLICY_PARAM] as string)
        : null,
    termsUrl:
      typeof fields[A2P_CAMPAIGN_TERMS_PARAM] === "string"
        ? (fields[A2P_CAMPAIGN_TERMS_PARAM] as string)
        : null,
  });
}

/** Assert final package has no QuickCloud residue and no YES opt-in keyword. */
export function assertA2pCampaignPackageClean(fields: A2pCampaignCreateFields): void {
  assertA2pCampaignPayloadHasPolicyUrls(fields as unknown as Record<string, unknown>);
  const blob = JSON.stringify(fields);
  if (/quickcloud\.co|help@quickcloud/i.test(blob)) {
    throw new Error("A2P package must not contain QuickCloud legal URLs or help@quickcloud email.");
  }
  if (fields.OptInKeywords.map((k) => k.toUpperCase()).includes("YES")) {
    throw new Error("A2P OptInKeywords must not include YES.");
  }
  if (!/optional and voluntary/i.test(fields.MessageFlow)) {
    throw new Error("MessageFlow must state that SMS consent is optional and voluntary.");
  }
  if (!/not a condition of using the service/i.test(fields.MessageFlow)) {
    throw new Error("MessageFlow must state SMS consent is not a condition of using the service.");
  }
  if (!fields.MessageFlow.includes(HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL)
    && !/Public opt-in evidence:/i.test(fields.MessageFlow)) {
    throw new Error("MessageFlow must include a public opt-in evidence URL.");
  }
}

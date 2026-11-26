/**
 * Gmail forwarding-address verification — classify inbound mail and validate
 * confirmation URLs before any staff-facing redirect.
 *
 * Webhook Svix auth proves the event came from Resend. Sender authenticity
 * (Google) is evaluated separately from headers + From allowlist.
 */

export const GMAIL_FORWARDING_CONFIRMATION_HOSTS = [
  "mail.google.com",
  "mail-settings.google.com",
] as const;

/** Documented Google notifier; finalized against disposable capture when available. */
export const GMAIL_FORWARDING_FROM_ALLOWLIST = [
  "forwarding-noreply@google.com",
  "forwarding-noreply@googlemail.com",
] as const;

export type GmailForwardingVerificationState =
  | "pending"
  | "opened"
  | "acknowledged"
  | "expired"
  | "superseded"
  | "dismissed";

export type GmailSenderAuthAssessment = {
  fromAllowlisted: boolean;
  spfPass: boolean | null;
  dkimPass: boolean | null;
  dmarcPass: boolean | null;
  authenticationResultsPresent: boolean;
  summary: string;
};

export type ClassifiedGmailForwardingVerification = {
  kind: "gmail_forwarding_verification";
  fromAddress: string;
  subject: string;
  confirmationUrl: string | null;
  confirmationHost: string | null;
  confirmationCode: string | null;
  senderAuth: GmailSenderAuthAssessment;
};

function normalizeAddress(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  const raw = (angle?.[1] ?? from).trim().toLowerCase();
  return raw;
}

export function isAllowlistedGmailForwardingFrom(from: string): boolean {
  const addr = normalizeAddress(from);
  return (GMAIL_FORWARDING_FROM_ALLOWLIST as readonly string[]).includes(addr);
}

export function assessGmailSenderAuthentication(input: {
  from: string;
  headers?: Record<string, string> | null;
}): GmailSenderAuthAssessment {
  const fromAllowlisted = isAllowlistedGmailForwardingFrom(input.from);
  const auth =
    input.headers?.["authentication-results"] ??
    input.headers?.["Authentication-Results"] ??
    "";
  const authenticationResultsPresent = Boolean(auth.trim());
  const lower = auth.toLowerCase();
  const spfPass = authenticationResultsPresent ? /\bspf\s*=\s*pass\b/.test(lower) : null;
  const dkimPass = authenticationResultsPresent ? /\bdkim\s*=\s*pass\b/.test(lower) : null;
  const dmarcPass = authenticationResultsPresent ? /\bdmarc\s*=\s*pass\b/.test(lower) : null;
  const summary = [
    fromAllowlisted ? "from_allowlisted" : "from_not_allowlisted",
    authenticationResultsPresent ? "auth_results_present" : "auth_results_absent",
    spfPass === true ? "spf_pass" : spfPass === false ? "spf_fail" : "spf_unknown",
    dkimPass === true ? "dkim_pass" : dkimPass === false ? "dkim_fail" : "dkim_unknown",
    dmarcPass === true ? "dmarc_pass" : dmarcPass === false ? "dmarc_fail" : "dmarc_unknown",
  ].join(",");
  return {
    fromAllowlisted,
    spfPass,
    dkimPass,
    dmarcPass,
    authenticationResultsPresent,
    summary,
  };
}

/** Returns true when sender evidence is strong enough to treat as Google verification mail. */
export function senderAuthAcceptable(auth: GmailSenderAuthAssessment): boolean {
  if (!auth.fromAllowlisted) return false;
  // Prefer authenticated results when present; require no hard fails.
  if (auth.spfPass === false || auth.dkimPass === false || auth.dmarcPass === false) return false;
  // Allowlist + non-failing (or absent) auth results — disposable capture may tighten this.
  return true;
}

export function extractGmailConfirmationCode(subject: string, body: string): string | null {
  const subjectMatch = subject.match(/\(#\s*(\d{6,12})\s*\)/i) ?? subject.match(/\b(\d{9,12})\b/);
  if (subjectMatch?.[1]) return subjectMatch[1];
  const bodyMatch =
    body.match(/confirmation\s+code[:\s]+(\d{6,12})/i) ??
    body.match(/\(#\s*(\d{6,12})\s*\)/);
  return bodyMatch?.[1] ?? null;
}

export function validateGmailConfirmationUrl(raw: string): { ok: true; url: string; host: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "scheme" };
  const host = parsed.hostname.toLowerCase();
  if (!(GMAIL_FORWARDING_CONFIRMATION_HOSTS as readonly string[]).includes(host)) {
    return { ok: false, reason: "host" };
  }
  // Confirmation paths historically under /mail/… — reject javascript and empty paths.
  if (!parsed.pathname || parsed.pathname === "/") return { ok: false, reason: "path" };
  if (/[<>"']/.test(raw)) return { ok: false, reason: "chars" };
  // Reject open-redirect style nested URLs in query that leave Google hosts.
  for (const value of parsed.searchParams.values()) {
    if (/^https?:\/\//i.test(value)) {
      try {
        const nested = new URL(value);
        if (!(GMAIL_FORWARDING_CONFIRMATION_HOSTS as readonly string[]).includes(nested.hostname.toLowerCase())) {
          return { ok: false, reason: "nested_redirect" };
        }
      } catch {
        return { ok: false, reason: "nested_invalid" };
      }
    }
  }
  return { ok: true, url: parsed.toString(), host };
}

export function extractGmailConfirmationUrls(body: string, html: string): string[] {
  const pool = `${body}\n${html}`;
  const found = new Set<string>();
  const re = /https:\/\/(?:mail(?:-settings)?\.google\.com)\/[^\s"'<>]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pool))) {
    const cleaned = m[0].replace(/[),.;]+$/, "");
    found.add(cleaned);
  }
  return [...found];
}

export function classifyGmailForwardingVerification(input: {
  from: string;
  subject?: string | null;
  body: string;
  html?: string;
  headers?: Record<string, string> | null;
}): ClassifiedGmailForwardingVerification | null {
  const subject = (input.subject ?? "").trim();
  if (!/gmail\s+forwarding\s+confirmation/i.test(subject) && !/forwarding\s+confirmation/i.test(subject)) {
    return null;
  }
  const senderAuth = assessGmailSenderAuthentication({ from: input.from, headers: input.headers });
  if (!senderAuthAcceptable(senderAuth)) return null;

  const urls = extractGmailConfirmationUrls(input.body, input.html ?? "");
  let confirmationUrl: string | null = null;
  let confirmationHost: string | null = null;
  for (const candidate of urls) {
    const validated = validateGmailConfirmationUrl(candidate);
    if (validated.ok) {
      confirmationUrl = validated.url;
      confirmationHost = validated.host;
      break;
    }
  }
  const confirmationCode = extractGmailConfirmationCode(subject, input.body);
  if (!confirmationUrl && !confirmationCode) return null;

  return {
    kind: "gmail_forwarding_verification",
    fromAddress: normalizeAddress(input.from),
    subject,
    confirmationUrl,
    confirmationHost,
    confirmationCode,
    senderAuth,
  };
}

/** Default practical window when Google does not expose expiry in the message. */
export function defaultGmailVerificationExpiry(receivedAt = new Date()): Date {
  return new Date(receivedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export type GmailVerificationCustomerView = {
  id: string;
  /** pending | opened | expired (customer-facing bucket) */
  display: "pending" | "opened" | "expired";
  hasLink: boolean;
  confirmationCode: string | null;
  /** ISO; only when we know expiry */
  expiresAt: string | null;
  expiryKnown: boolean;
  receivedAt: string;
};

export function toCustomerView(row: {
  id: string;
  state: GmailForwardingVerificationState;
  confirmation_url: string | null;
  confirmation_code: string | null;
  expires_at: string | null;
  received_at: string;
  expiry_known?: boolean;
}): GmailVerificationCustomerView | null {
  const now = Date.now();
  const expiredByTime =
    row.expires_at && row.expiry_known !== false
      ? new Date(row.expires_at).getTime() < now
      : false;
  if (row.state === "acknowledged" || row.state === "dismissed" || row.state === "superseded") {
    return null;
  }
  if (row.state === "expired" || expiredByTime) {
    return {
      id: row.id,
      display: "expired",
      hasLink: Boolean(row.confirmation_url),
      confirmationCode: row.confirmation_code,
      expiresAt: row.expires_at,
      expiryKnown: row.expiry_known !== false && Boolean(row.expires_at),
      receivedAt: row.received_at,
    };
  }
  if (row.state === "pending" || row.state === "opened") {
    return {
      id: row.id,
      display: row.state === "opened" ? "opened" : "pending",
      hasLink: Boolean(row.confirmation_url),
      confirmationCode: row.confirmation_code,
      expiresAt: row.expires_at,
      expiryKnown: false, // do not claim expired unless state is expired
      receivedAt: row.received_at,
    };
  }
  return null;
}

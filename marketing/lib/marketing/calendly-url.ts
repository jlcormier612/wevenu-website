/**
 * Resolve a public Calendly embed URL from env.
 * Returns null when unset, placeholder, or not a calendly.com URL —
 * so the Walkthrough page can show a truthful Contact fallback.
 *
 * Client-safe — do not import CRM store / server handoff lookup here.
 */

/** Must match shared/relationships/calendly-handoff.ts */
export const CALENDLY_HANDOFF_UTM_SOURCE = "htc_website";
export const CALENDLY_HANDOFF_UTM_MEDIUM = "walkthrough_intake";

export function resolveCalendlyEmbedUrl(
  raw: string | undefined | null,
): string | null {
  const value = raw?.trim() || "";
  if (!value) return null;

  const lower = value.toLowerCase();
  if (
    lower.includes("your-link") ||
    lower.includes("example.com") ||
    lower.includes("placeholder")
  ) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "calendly.com" && !host.endsWith(".calendly.com")) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export type CalendlyHandoffPrefill = {
  name?: string;
  email?: string;
  handoffToken?: string;
};

/**
 * Prefill name/email and attach opaque HTC handoff as utm_content so the
 * invitee.created webhook can bind the booking to the intake relationship.
 */
export function buildCalendlySchedulingUrl(
  baseUrl: string,
  prefill?: CalendlyHandoffPrefill | null,
): string {
  try {
    const u = new URL(baseUrl);
    if (prefill?.name?.trim()) {
      u.searchParams.set("name", prefill.name.trim());
    }
    if (prefill?.email?.trim()) {
      u.searchParams.set("email", prefill.email.trim());
    }
    if (prefill?.handoffToken?.trim()) {
      u.searchParams.set("utm_source", CALENDLY_HANDOFF_UTM_SOURCE);
      u.searchParams.set("utm_medium", CALENDLY_HANDOFF_UTM_MEDIUM);
      u.searchParams.set("utm_content", prefill.handoffToken.trim());
    }
    return u.toString();
  } catch {
    return baseUrl;
  }
}

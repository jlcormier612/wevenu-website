/**
 * Browser helpers for marketing acquisition attribution payloads.
 * Non-PII only — never includes email, name, phone, or message bodies.
 */

import {
  captureFirstTouchAttribution,
  captureLatestTouchFromLocation,
  mergeAttributionForSubmit,
  normalizeAcquisitionPayload,
  readFirstTouchAttribution,
  type AcquisitionAttributionPayload,
  type AcquisitionTouch,
  type FirstTouchAttribution,
} from "@shared/analytics";

const SCOPE = "marketing";

function touchFromFirstTouch(
  snap: FirstTouchAttribution | null,
  capturedAt: string,
): AcquisitionTouch | null {
  if (!snap) return null;
  const raw: Record<string, string> = { captured_at: capturedAt };
  if (snap.utm_source) raw.utm_source = snap.utm_source;
  if (snap.utm_medium) raw.utm_medium = snap.utm_medium;
  if (snap.utm_campaign) raw.utm_campaign = snap.utm_campaign;
  if (snap.utm_content) raw.utm_content = snap.utm_content;
  if (snap.utm_term) raw.utm_term = snap.utm_term;
  if (snap.referrer) raw.referrer = snap.referrer;
  if (snap.landing_page) raw.landing_page = snap.landing_page;
  return (
    normalizeAcquisitionPayload({ first_touch: raw })?.first_touch ?? null
  );
}

/** Ensure first-touch is captured once per browser session scope. */
export function ensureMarketingFirstTouch(): FirstTouchAttribution | null {
  return (
    captureFirstTouchAttribution(SCOPE) || readFirstTouchAttribution(SCOPE)
  );
}

/**
 * Build first + latest touch for CRM / checkout submissions.
 * First-touch from session snapshot; latest from live URL.
 */
export function buildSubmissionAttribution(): AcquisitionAttributionPayload | null {
  if (typeof window === "undefined") return null;
  const now = new Date().toISOString();
  const stored = ensureMarketingFirstTouch();
  const live: FirstTouchAttribution = {
    utm_source:
      new URLSearchParams(window.location.search).get("utm_source")?.trim() ||
      undefined,
    utm_medium:
      new URLSearchParams(window.location.search).get("utm_medium")?.trim() ||
      undefined,
    utm_campaign:
      new URLSearchParams(window.location.search).get("utm_campaign")?.trim() ||
      undefined,
    utm_term:
      new URLSearchParams(window.location.search).get("utm_term")?.trim() ||
      undefined,
    utm_content:
      new URLSearchParams(window.location.search).get("utm_content")?.trim() ||
      undefined,
    referrer: document.referrer || undefined,
    landing_page: `${window.location.pathname}${window.location.search}`,
  };
  const merged = mergeAttributionForSubmit(live, stored);
  const first_touch = touchFromFirstTouch(stored || merged, now);
  const latest_touch =
    captureLatestTouchFromLocation(now) ||
    touchFromFirstTouch(merged, now);
  return normalizeAcquisitionPayload({ first_touch, latest_touch });
}

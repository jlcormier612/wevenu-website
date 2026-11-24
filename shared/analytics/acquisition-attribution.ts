/**
 * Marketing acquisition attribution payloads (non-PII).
 * Used by browser first/latest-touch capture and CRM persistence.
 * Never includes email, name, phone, or message bodies.
 */

export type AcquisitionTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  captured_at: string;
};

export type AcquisitionAttributionPayload = {
  first_touch?: AcquisitionTouch | null;
  latest_touch?: AcquisitionTouch | null;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function trimOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

/** Sanitize a loose client/JSON object into a touch (drops unknown / empty). */
export function normalizeAcquisitionTouch(
  raw: unknown,
  fallbackCapturedAt?: string,
): AcquisitionTouch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const touch: AcquisitionTouch = {
    captured_at:
      trimOrUndef(o.captured_at) ||
      fallbackCapturedAt ||
      new Date().toISOString(),
  };
  for (const k of UTM_KEYS) {
    const v = trimOrUndef(o[k]);
    if (v) touch[k] = v.slice(0, 256);
  }
  const referrer = trimOrUndef(o.referrer);
  if (referrer) touch.referrer = referrer.slice(0, 1024);
  const landing = trimOrUndef(o.landing_page);
  if (landing) touch.landing_page = landing.slice(0, 1024);

  const has =
    touch.utm_source ||
    touch.utm_medium ||
    touch.utm_campaign ||
    touch.utm_content ||
    touch.utm_term ||
    touch.referrer ||
    touch.landing_page;
  return has ? touch : null;
}

export function normalizeAcquisitionPayload(
  raw: unknown,
): AcquisitionAttributionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const first_touch = normalizeAcquisitionTouch(o.first_touch);
  const latest_touch = normalizeAcquisitionTouch(o.latest_touch);
  if (!first_touch && !latest_touch) return null;
  return { first_touch, latest_touch };
}

/** Build latest-touch from the live URL (browser). */
export function captureLatestTouchFromLocation(
  nowIso: string = new Date().toISOString(),
): AcquisitionTouch | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw: Record<string, string> = { captured_at: nowIso };
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim();
    if (v) raw[k] = v;
  }
  if (document.referrer) raw.referrer = document.referrer;
  raw.landing_page = `${window.location.pathname}${window.location.search}`;
  return normalizeAcquisitionTouch(raw, nowIso);
}

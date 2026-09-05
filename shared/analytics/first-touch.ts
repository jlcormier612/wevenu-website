/**
 * Small first-touch UTM/referrer persistence via sessionStorage.
 * Does not create a visitor/session database.
 * Prefer live URL params; fall back to first-touch snapshot when query is gone.
 */
import { firstTouchStorageKey } from "./constants";

export type FirstTouchAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
};

function canUseSession(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function pickUtm(params: URLSearchParams, key: string): string | undefined {
  const v = params.get(key)?.trim();
  return v || undefined;
}

/** Capture first-touch from the current URL once per scope (does not overwrite). */
export function captureFirstTouchAttribution(scope: string): FirstTouchAttribution | null {
  if (!canUseSession() || !scope) return null;
  const key = firstTouchStorageKey(scope);
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      return JSON.parse(existing) as FirstTouchAttribution;
    }
  } catch {
    // continue to write fresh
  }

  const params = new URLSearchParams(window.location.search);
  const snap: FirstTouchAttribution = {
    utm_source: pickUtm(params, "utm_source"),
    utm_medium: pickUtm(params, "utm_medium"),
    utm_campaign: pickUtm(params, "utm_campaign"),
    utm_term: pickUtm(params, "utm_term"),
    utm_content: pickUtm(params, "utm_content"),
    referrer: document.referrer || undefined,
    landing_page: `${window.location.pathname}${window.location.search}` || undefined,
  };

  const hasAny =
    snap.utm_source ||
    snap.utm_medium ||
    snap.utm_campaign ||
    snap.utm_term ||
    snap.utm_content ||
    snap.referrer ||
    snap.landing_page;

  if (!hasAny) return null;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(snap));
  } catch {
    // ignore
  }
  return snap;
}

export function readFirstTouchAttribution(scope: string): FirstTouchAttribution | null {
  if (!canUseSession() || !scope) return null;
  try {
    const raw = window.sessionStorage.getItem(firstTouchStorageKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as FirstTouchAttribution;
  } catch {
    return null;
  }
}

/**
 * Merge live URL attribution with first-touch fallback.
 * Live URL wins when present; first-touch fills gaps only.
 */
export function mergeAttributionForSubmit(
  live: FirstTouchAttribution,
  firstTouch: FirstTouchAttribution | null,
): FirstTouchAttribution {
  if (!firstTouch) return live;
  return {
    utm_source: live.utm_source || firstTouch.utm_source,
    utm_medium: live.utm_medium || firstTouch.utm_medium,
    utm_campaign: live.utm_campaign || firstTouch.utm_campaign,
    utm_term: live.utm_term || firstTouch.utm_term,
    utm_content: live.utm_content || firstTouch.utm_content,
    referrer: live.referrer || firstTouch.referrer,
    landing_page: live.landing_page || firstTouch.landing_page,
  };
}

/**
 * Minimal GA4 (gtag) client loader.
 * Consent OFF / missing measurement ID → no-op (no script, no events).
 */
import { isValidGa4MeasurementId, normalizeGa4MeasurementId } from "./measurement-id";
import { assertAnalyticsParamsHaveNoPii } from "./privacy";
import type { FunnelSurface } from "./constants";

export type Ga4RuntimeConfig = {
  measurementId: string;
  /** Consent must already be true before calling ensureGa4. */
  consented: boolean;
  surface: FunnelSurface;
  /** Opaque anon id — only when consented; never PII. */
  anonId?: string | null;
};

export type GenerateLeadParams = {
  form_mode?: string;
  has_utm?: boolean;
  acquisition_key?: string;
  funnel_surface: FunnelSurface;
  /** Venue slug/id only when necessary and non-PII. */
  venue_key?: string;
};

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const SCRIPT_ATTR = "data-htc-ga4";

let activeMeasurementId: string | null = null;
let activeAnonId: string | null = null;
let initialized = false;

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function removeGa4Script(): void {
  if (!canUseDom()) return;
  document.querySelectorAll(`script[${SCRIPT_ATTR}]`).forEach((el) => el.remove());
}

function baseEventParams(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (activeAnonId) out.htc_anon_id = activeAnonId;
  return out;
}

/**
 * Initialize gtag only when consented + valid measurement ID.
 * Missing ID = safe no-op (Sandbox-friendly).
 * Never sets GA4 user_id (would risk PII misuse); anon id is an event param only.
 */
export function ensureGa4(config: Ga4RuntimeConfig): boolean {
  if (!canUseDom()) return false;
  if (!config.consented) {
    shutdownGa4();
    return false;
  }
  const id = normalizeGa4MeasurementId(config.measurementId);
  if (!id || !isValidGa4MeasurementId(id)) {
    shutdownGa4();
    return false;
  }

  activeAnonId = config.anonId?.trim() || null;

  if (initialized && activeMeasurementId === id) {
    return true;
  }

  if (initialized && activeMeasurementId !== id) {
    shutdownGa4();
    activeAnonId = config.anonId?.trim() || null;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };

  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });

  if (!document.querySelector(`script[${SCRIPT_ATTR}="${id}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    script.setAttribute(SCRIPT_ATTR, id);
    document.head.appendChild(script);
  }

  activeMeasurementId = id;
  initialized = true;
  return true;
}

/** Stop future analytics as far as this architecture permits. */
export function shutdownGa4(): void {
  if (!canUseDom()) return;
  removeGa4Script();
  initialized = false;
  activeMeasurementId = null;
  activeAnonId = null;
  // Leave dataLayer/gtag stubs; callers must re-check consent before sending.
}

/** Test/helper: whether GA4 is currently initialized for this page. */
export function isGa4Initialized(): boolean {
  return initialized && !!activeMeasurementId;
}

export function trackPageView(path?: string): boolean {
  if (!initialized || !window.gtag || !activeMeasurementId) return false;
  const payload: Record<string, unknown> = {
    ...baseEventParams(),
    page_path: path || (typeof window !== "undefined" ? window.location.pathname : undefined),
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
  };
  assertAnalyticsParamsHaveNoPii(payload);
  window.gtag("event", "page_view", payload);
  return true;
}

export function trackGenerateLead(params: GenerateLeadParams): boolean {
  if (!initialized || !window.gtag) return false;
  const payload: Record<string, unknown> = {
    ...baseEventParams(),
    funnel_surface: params.funnel_surface,
  };
  if (params.form_mode) payload.form_mode = params.form_mode;
  if (typeof params.has_utm === "boolean") payload.has_utm = params.has_utm;
  if (params.acquisition_key) payload.acquisition_key = params.acquisition_key;
  if (params.venue_key) payload.venue_key = params.venue_key;
  assertAnalyticsParamsHaveNoPii(payload);
  window.gtag("event", "generate_lead", payload);
  return true;
}

/** Tour-request submission when generate_lead alone is not enough. */
export function trackTourRequest(params: GenerateLeadParams): boolean {
  if (!initialized || !window.gtag) return false;
  const payload: Record<string, unknown> = {
    ...baseEventParams(),
    funnel_surface: params.funnel_surface,
  };
  if (params.form_mode) payload.form_mode = params.form_mode;
  if (typeof params.has_utm === "boolean") payload.has_utm = params.has_utm;
  if (params.acquisition_key) payload.acquisition_key = params.acquisition_key;
  if (params.venue_key) payload.venue_key = params.venue_key;
  assertAnalyticsParamsHaveNoPii(payload);
  window.gtag("event", "request_tour", payload);
  return true;
}

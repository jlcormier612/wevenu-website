/**
 * HTC marketing GA4 event taxonomy (Phase launch-readiness).
 * Consent + valid measurement ID required via ensureGa4 / isGa4Initialized.
 * No PII in payloads.
 */
import { assertAnalyticsParamsHaveNoPii } from "./privacy";
import { isGa4Initialized } from "./ga4";
import type { FunnelSurface } from "./constants";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Documented event names — keep stable for reporting. */
export const MarketingGa4Events = {
  /** Engagement */
  page_view: "page_view",
  pricing_view: "view_item_list",
  cta_click: "select_content",
  calendly_embed_ready: "calendly_embed_ready",
  /** Conversions */
  generate_lead: "generate_lead",
  newsletter_signup: "sign_up",
  walkthrough_scheduled: "schedule",
  refer_venue_submit: "generate_lead",
  begin_checkout: "begin_checkout",
  purchase: "purchase",
} as const;

export type PurchaseAnalyticsType =
  | "subscription"
  | "subscription_with_white_glove";

function send(name: string, params: Record<string, unknown>): boolean {
  if (!isGa4Initialized() || typeof window === "undefined" || !window.gtag) {
    return false;
  }
  assertAnalyticsParamsHaveNoPii(params);
  window.gtag("event", name, params);
  return true;
}

function purchaseDedupeHit(transactionId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `htc-ga4-purchase:${transactionId}`;
  try {
    if (sessionStorage.getItem(key) || localStorage.getItem(key)) {
      return true;
    }
    sessionStorage.setItem(key, "1");
    localStorage.setItem(key, "1");
  } catch {
    try {
      if (sessionStorage.getItem(key)) return true;
      sessionStorage.setItem(key, "1");
    } catch {
      // best-effort
    }
  }
  return false;
}

export function trackPricingEngagement(params?: {
  item_list_id?: string;
}): boolean {
  return send(MarketingGa4Events.pricing_view, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    item_list_id: params?.item_list_id || "pricing_plans",
    engagement: true,
  });
}

export function trackCtaClick(params: {
  cta_id: string;
  cta_location?: string;
}): boolean {
  return send(MarketingGa4Events.cta_click, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    content_type: "cta",
    content_id: params.cta_id.slice(0, 128),
    cta_location: params.cta_location?.slice(0, 128),
    engagement: true,
  });
}

export function trackCalendlyEmbedReady(): boolean {
  return send(MarketingGa4Events.calendly_embed_ready, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    engagement: true,
  });
}

/** Actual Calendly booking completed (postMessage event_scheduled). */
export function trackWalkthroughScheduled(params?: {
  has_handoff?: boolean;
}): boolean {
  return send(MarketingGa4Events.walkthrough_scheduled, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    conversion: true,
    has_handoff: params?.has_handoff === true,
  });
}

export function trackNewsletterSignup(): boolean {
  return send(MarketingGa4Events.newsletter_signup, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    method: "newsletter",
    conversion: true,
  });
}

/**
 * Venue-app Refer a Venue (`/settings/referrals`) — not a public marketing form.
 * Wire when REFERRAL_PROGRAM_V1 is enabled on the venue product surface.
 */
export function trackReferVenueSubmit(): boolean {
  return send(MarketingGa4Events.refer_venue_submit, {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    form_mode: "refer_venue",
    conversion: true,
  });
}

export function trackBeginCheckout(params: {
  plan_id?: string;
  value_cents?: number;
  currency?: string;
}): boolean {
  const payload: Record<string, unknown> = {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    conversion: true,
  };
  if (params.plan_id) payload.item_id = params.plan_id.slice(0, 64);
  if (typeof params.value_cents === "number") {
    payload.value = Math.round(params.value_cents) / 100;
    payload.currency = params.currency || "USD";
  }
  return send(MarketingGa4Events.begin_checkout, payload);
}

/**
 * Confirmed paid new-customer checkout only.
 * Requires payment-verified enrollment (not mere success-URL arrival).
 * Dedupes across refreshes/sessions via sessionStorage + localStorage.
 * Never call for Stripe invoice renewals / subscription.updated.
 */
export function trackPurchase(params: {
  transaction_id: string;
  plan_id?: string;
  value_cents?: number;
  currency?: string;
  white_glove?: boolean;
  /** Caller must set true only after Stripe payment verification / enrollment. */
  payment_verified: boolean;
  purchase_type?: PurchaseAnalyticsType;
}): boolean {
  if (!params.payment_verified) return false;
  const id = params.transaction_id.trim();
  if (!id || !id.startsWith("cs_")) return false;
  if (purchaseDedupeHit(id)) return false;

  const purchaseType: PurchaseAnalyticsType =
    params.purchase_type ||
    (params.white_glove
      ? "subscription_with_white_glove"
      : "subscription");

  const payload: Record<string, unknown> = {
    funnel_surface: "htc_marketing" satisfies FunnelSurface,
    conversion: true,
    transaction_id: id.slice(0, 128),
    purchase_type: purchaseType,
    payment_verified: true,
  };
  if (params.plan_id) payload.item_id = params.plan_id.slice(0, 64);
  if (typeof params.value_cents === "number") {
    payload.value = Math.round(params.value_cents) / 100;
    payload.currency = params.currency || "USD";
  }
  if (params.white_glove || purchaseType === "subscription_with_white_glove") {
    payload.white_glove = true;
  }
  return send(MarketingGa4Events.purchase, payload);
}

/**
 * Map Calendly invitee tracking → CRM acquisition attribution.
 * Handoff UTMs (htc_website / walkthrough_intake / htc_* content) are identity
 * only — never treated as campaign acquisition source.
 */

import type { AcquisitionAttributionPayload } from "@shared/analytics";
import { normalizeAcquisitionPayload } from "@shared/analytics";
import {
  CALENDLY_HANDOFF_UTM_MEDIUM,
  CALENDLY_HANDOFF_UTM_SOURCE,
  isCalendlyHandoffToken,
} from "@shared/relationships";

export type CalendlyTrackingLike = {
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

function isHandoffTracking(tracking: CalendlyTrackingLike | null | undefined): boolean {
  if (!tracking) return false;
  if (isCalendlyHandoffToken(tracking.utm_content)) return true;
  const source = tracking.utm_source?.trim().toLowerCase() || "";
  const medium = tracking.utm_medium?.trim().toLowerCase() || "";
  return (
    source === CALENDLY_HANDOFF_UTM_SOURCE.toLowerCase() &&
    medium === CALENDLY_HANDOFF_UTM_MEDIUM.toLowerCase()
  );
}

/**
 * Build attribution for a Calendly invitee.created event.
 * - Handoff bookings: null (first-touch already set on intake relationship).
 * - Direct embed / shared link with campaign UTMs: use those UTMs.
 * - Direct with no campaign UTMs: stamp calendly/embed so reporting has a source.
 */
export function acquisitionAttributionFromCalendlyTracking(
  tracking: CalendlyTrackingLike | null | undefined,
  options?: { scheduledAt?: string | null },
): AcquisitionAttributionPayload | null {
  if (isHandoffTracking(tracking)) return null;

  const capturedAt =
    options?.scheduledAt?.trim() || new Date().toISOString();

  const source = tracking?.utm_source?.trim();
  const medium = tracking?.utm_medium?.trim();
  const campaign = tracking?.utm_campaign?.trim();
  const content = tracking?.utm_content?.trim();
  const term = tracking?.utm_term?.trim();

  const hasCampaign =
    Boolean(source) ||
    Boolean(medium) ||
    Boolean(campaign) ||
    Boolean(content) ||
    Boolean(term);

  const touch = hasCampaign
    ? {
        captured_at: capturedAt,
        ...(source ? { utm_source: source } : {}),
        ...(medium ? { utm_medium: medium } : {}),
        ...(campaign ? { utm_campaign: campaign } : {}),
        ...(content && !isCalendlyHandoffToken(content)
          ? { utm_content: content }
          : {}),
        ...(term ? { utm_term: term } : {}),
        landing_page: "/walkthrough",
      }
    : {
        captured_at: capturedAt,
        utm_source: "calendly",
        utm_medium: "embed",
        landing_page: "/walkthrough",
      };

  return normalizeAcquisitionPayload({
    first_touch: touch,
    latest_touch: touch,
  });
}

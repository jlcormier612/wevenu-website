/**
 * The single source of truth for what the Facebook / Instagram Lead Ads card
 * is allowed to claim.
 *
 * Why this is a pure function rather than inline JSX conditions: the
 * connection's own `status` column is NOT sufficient to say the integration
 * works. `selectFacebookPage` flips status to 'connected' as soon as a Page is
 * bound and subscribed, but both ingestion paths additionally require an
 * *enabled* facebook_lead_forms row for the incoming form_id:
 *
 *   - app/api/facebook/webhook/route.ts filters on
 *     .eq("form_id", formId).eq("is_enabled", true) and silently `continue`s
 *     when there is no match, so a real Meta lead is dropped.
 *   - lib/facebook/reconcile.ts only ever iterates forms where
 *     is_enabled = true, so the hourly backstop cannot recover it either.
 *
 * A Page-bound connection with zero enabled forms therefore delivers exactly
 * zero leads, and must never render as a green "Connected" badge. That gating
 * is intentional and is not changed here — this module exists so the UI
 * reports it accurately.
 *
 * Mirrors the Stripe card's connected-vs-charges_enabled split
 * (components/settings/stripe-connect-section.tsx), which already draws the
 * same distinction between "linked" and "actually capable".
 */

import type { FacebookConnection, FacebookLeadForm } from "@/lib/facebook/types";

export type FacebookUiState =
  /** No connection row, or one that was explicitly disconnected. */
  | "not_connected"
  /** Meta authorized, but no Page bound yet — step 1 of 2 outstanding. */
  | "needs_page_selection"
  /** Page bound, but no enabled form — step 2 of 2 outstanding. Delivers nothing. */
  | "needs_forms"
  /** Page bound and at least one enabled form — genuinely capable of delivering leads. */
  | "delivering"
  /** Token/permission failure; venue must reconnect. */
  | "error";

export function facebookEnabledFormCount(leadForms: FacebookLeadForm[]): number {
  return leadForms.filter((f) => f.isEnabled).length;
}

export function facebookUiState(
  connection: FacebookConnection | null,
  leadForms: FacebookLeadForm[],
): FacebookUiState {
  if (!connection || connection.status === "disconnected") return "not_connected";
  if (connection.status === "error") return "error";
  if (connection.status === "needs_page_selection") return "needs_page_selection";
  return facebookEnabledFormCount(leadForms) > 0 ? "delivering" : "needs_forms";
}

/** True only when the integration can actually deliver a lead end to end. */
export function facebookIsDelivering(
  connection: FacebookConnection | null,
  leadForms: FacebookLeadForm[],
): boolean {
  return facebookUiState(connection, leadForms) === "delivering";
}

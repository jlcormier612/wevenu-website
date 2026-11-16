/**
 * Guided Setup Hub status labels for integrations.
 * Never Connected from visiting a page. Uses persisted provider state only.
 */
import type { FacebookUiState } from "@/lib/facebook/ui-state";
import type { StripeOnboardingStatus } from "@/lib/venue/types";

export type GuidedIntegrationStatus =
  | "Not set up"
  | "In progress"
  | "Connected"
  | "Needs attention";

export function stripeGuidedStatus(input: {
  onboardingStatus: StripeOnboardingStatus | null | undefined;
  chargesEnabled: boolean;
}): GuidedIntegrationStatus {
  if (input.onboardingStatus === "connected" && input.chargesEnabled) return "Connected";
  if (input.onboardingStatus === "connected") return "Needs attention";
  if (input.onboardingStatus === "pending") return "In progress";
  return "Not set up";
}

export function quickBooksGuidedStatus(
  status: string | null | undefined,
  lastHealthCheckOk?: boolean | null,
): GuidedIntegrationStatus {
  if (status === "error") return "Needs attention";
  if (status === "connected" && lastHealthCheckOk === false) return "Needs attention";
  if (status === "connected") return "Connected";
  return "Not set up";
}

export function facebookGuidedStatus(state: FacebookUiState): GuidedIntegrationStatus {
  if (state === "delivering") return "Connected";
  if (state === "error" || state === "needs_forms" || state === "needs_page_selection") {
    return "Needs attention";
  }
  return "Not set up";
}

export function textingGuidedStatus(input: {
  smsReady: boolean;
  phase?: string | null;
}): GuidedIntegrationStatus {
  if (input.smsReady) return "Connected";
  if (input.phase === "needs_attention" || input.phase === "paused" || input.phase === "failed") {
    return "Needs attention";
  }
  if (input.phase && input.phase !== "not_started") return "In progress";
  return "Not set up";
}

export function tourSchedulingGuidedStatus(enabled: boolean): GuidedIntegrationStatus {
  return enabled ? "In progress" : "Not set up";
}

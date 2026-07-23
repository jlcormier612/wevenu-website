import type { PipelineStatus, RelationshipStatus } from "./types";

/**
 * Rank for promoteStatus. Higher = further in happy-path lifecycle.
 * Side states (at_risk, suspended) are applied via forceStatus, not promote.
 */
const STATUS_RANK: Record<RelationshipStatus, number> = {
  former_customer: 5,
  suspended: 8,
  inquiry: 10,
  walkthrough_requested: 15,
  walkthrough_scheduled: 20,
  walkthrough_completed: 30,
  trial: 35,
  subscribed: 40,
  onboarding: 50,
  white_glove_implementation: 55,
  support: 56,
  at_risk: 58,
  live: 60,
  active: 60,
  active_customer: 60,
  reactivated: 62,
  expansion: 70,
  referral: 80,
  renewal: 90,
};

/** Canonical pipeline column — aliases legacy live/active_customer → active. */
export function toPipelineStatus(status: RelationshipStatus): PipelineStatus {
  if (status === "active_customer" || status === "live") return "active";
  if (status === "support") return "active";
  return status;
}

/** Normalize stored aliases onto Customer Lifecycle canonical values. */
export function normalizeLifecycleStatus(
  status: RelationshipStatus,
): RelationshipStatus {
  if (status === "active_customer" || status === "live") return "active";
  return status;
}

/** Human stage label for UI snapshot / lifecycle. */
export function stageLabelForStatus(status: RelationshipStatus): string {
  switch (status) {
    case "inquiry":
      return "Inquiry";
    case "walkthrough_requested":
      return "Walkthrough Requested";
    case "walkthrough_scheduled":
      return "Walkthrough Scheduled";
    case "walkthrough_completed":
      return "Walkthrough Completed";
    case "trial":
      return "Trial";
    case "subscribed":
      return "Subscribed";
    case "onboarding":
      return "Onboarding";
    case "white_glove_implementation":
      return "White Glove Implementation";
    case "live":
    case "active":
    case "active_customer":
      return "Active";
    case "at_risk":
      return "At Risk";
    case "suspended":
      return "Suspended";
    case "reactivated":
      return "Reactivated";
    case "expansion":
      return "Expansion";
    case "referral":
      return "Referral";
    case "renewal":
      return "Renewal";
    case "support":
      return "Support";
    case "former_customer":
      return "Former Customer";
  }
}

/**
 * Advance status when the new status is "further" in the lifecycle.
 * Support can overlay customers; former_customer / suspended / at_risk
 * are never auto-applied here (use forceStatus).
 */
export function promoteStatus(
  current: RelationshipStatus,
  next: RelationshipStatus | undefined | null,
): RelationshipStatus {
  if (!next) return current;
  if (next === "support") {
    if (
      current === "subscribed" ||
      current === "onboarding" ||
      current === "white_glove_implementation" ||
      current === "live" ||
      current === "active" ||
      current === "active_customer" ||
      current === "reactivated" ||
      current === "at_risk" ||
      current === "expansion" ||
      current === "referral" ||
      current === "renewal" ||
      current === "support"
    ) {
      return "support";
    }
    return current;
  }

  // Prefer canonical `active` over legacy `live` / `active_customer`.
  const normalizedNext =
    next === "active_customer" || next === "live" ? "active" : next;
  let normalizedCurrent: RelationshipStatus =
    current === "active_customer" || current === "live"
      ? "active"
      : current === "support"
        ? "active"
        : current;

  // Don't auto-promote out of suspended via soft promote — require forceStatus.
  if (normalizedCurrent === "suspended" && normalizedNext !== "suspended") {
    return current;
  }

  if (STATUS_RANK[normalizedNext] >= STATUS_RANK[normalizedCurrent]) {
    return normalizedNext;
  }
  return current;
}

/** True when relationship is in a paying / post-purchase customer stage. */
export function isCustomerLifecycleStatus(status: RelationshipStatus): boolean {
  const s = normalizeLifecycleStatus(status);
  return (
    s === "subscribed" ||
    s === "onboarding" ||
    s === "white_glove_implementation" ||
    s === "active" ||
    s === "reactivated" ||
    s === "at_risk" ||
    s === "suspended" ||
    s === "expansion" ||
    s === "referral" ||
    s === "renewal" ||
    s === "support"
  );
}

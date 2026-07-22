import type { PipelineStatus, RelationshipStatus } from "./types";

const STATUS_RANK: Record<RelationshipStatus, number> = {
  former_customer: 5,
  inquiry: 10,
  walkthrough_requested: 15,
  walkthrough_scheduled: 20,
  walkthrough_completed: 30,
  trial: 35,
  subscribed: 40,
  onboarding: 50,
  support: 55,
  live: 60,
  active_customer: 60,
  expansion: 70,
  referral: 80,
  renewal: 90,
};

/** Map legacy / overlay statuses onto the Program 3 pipeline column. */
export function toPipelineStatus(status: RelationshipStatus): PipelineStatus {
  if (status === "active_customer" || status === "support") return "live";
  return status;
}

/** Human stage label for UI snapshot. */
export function stageLabelForStatus(status: RelationshipStatus): string {
  switch (status) {
    case "inquiry":
      return "New Inquiry";
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
    case "live":
    case "active_customer":
      return "Live";
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
 * Support can overlay customers; former_customer is never auto-applied here.
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
      current === "live" ||
      current === "active_customer" ||
      current === "expansion" ||
      current === "referral" ||
      current === "renewal" ||
      current === "support"
    ) {
      return "support";
    }
    return current;
  }
  // Prefer canonical `live` over legacy `active_customer` when promoting.
  const normalizedNext = next === "active_customer" ? "live" : next;
  const normalizedCurrent =
    current === "active_customer" ? "live" : current === "support" ? "live" : current;
  if (STATUS_RANK[normalizedNext] >= STATUS_RANK[normalizedCurrent]) {
    return normalizedNext;
  }
  return current;
}

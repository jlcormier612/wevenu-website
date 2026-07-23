import type { PipelineStatus, RelationshipStatus } from "@/lib/types";

/** Ordered pipeline columns for the board (support is overlay, not a column). */
export const PIPELINE_COLUMNS: { status: PipelineStatus; label: string; short: string }[] =
  [
    { status: "inquiry", label: "Inquiry", short: "Inquiry" },
    { status: "walkthrough_requested", label: "Walkthrough Requested", short: "WT Requested" },
    { status: "walkthrough_scheduled", label: "Walkthrough Scheduled", short: "WT Scheduled" },
    { status: "walkthrough_completed", label: "Walkthrough Completed", short: "WT Done" },
    { status: "trial", label: "Trial", short: "Trial" },
    { status: "subscribed", label: "Subscribed", short: "Subscribed" },
    { status: "onboarding", label: "Onboarding", short: "Onboarding" },
    {
      status: "white_glove_implementation",
      label: "White Glove Implementation",
      short: "WG Impl",
    },
    { status: "active", label: "Active", short: "Active" },
    { status: "at_risk", label: "At Risk", short: "At Risk" },
    { status: "suspended", label: "Suspended", short: "Suspended" },
    { status: "reactivated", label: "Reactivated", short: "Reactivated" },
    { status: "expansion", label: "Expansion", short: "Expansion" },
    { status: "referral", label: "Referral", short: "Referral" },
    { status: "renewal", label: "Renewal", short: "Renewal" },
    { status: "former_customer", label: "Former Customer", short: "Former" },
  ];

export function toPipelineStatus(status: RelationshipStatus): PipelineStatus {
  if (status === "active_customer" || status === "live" || status === "support") {
    return "active";
  }
  return status;
}

export function isPipelineStatus(value: string): value is PipelineStatus {
  return PIPELINE_COLUMNS.some((c) => c.status === value) || value === "live";
}

export function normalizeRelationshipStatus(
  status: RelationshipStatus,
): RelationshipStatus {
  if (status === "active_customer" || status === "live") return "active";
  return status;
}

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
    { status: "live", label: "Live", short: "Live" },
    { status: "expansion", label: "Expansion", short: "Expansion" },
    { status: "referral", label: "Referral", short: "Referral" },
    { status: "renewal", label: "Renewal", short: "Renewal" },
    { status: "former_customer", label: "Former Customer", short: "Former" },
  ];

export function toPipelineStatus(status: RelationshipStatus): PipelineStatus {
  if (status === "active_customer" || status === "support") return "live";
  return status;
}

export function isPipelineStatus(value: string): value is PipelineStatus {
  return PIPELINE_COLUMNS.some((c) => c.status === value);
}

export function normalizeRelationshipStatus(
  status: RelationshipStatus,
): RelationshipStatus {
  if (status === "active_customer") return "live";
  return status;
}

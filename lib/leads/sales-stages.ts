/**
 * Authoritative Sales Pipeline stages — seven fixed stages.
 * This is the single source of truth for a lead's position in sales.
 */

export const SALES_STAGES = [
  "new_inquiry",
  "outreach_sent",
  "enrolled_in_sequence",
  "tour_scheduled",
  "proposal_sent",
  "booked",
  "lost",
] as const;

export type SalesStage = (typeof SALES_STAGES)[number];

export type SalesStageMeta = {
  value: SalesStage;
  label: string;
  /** Sort / forward-only order. Lost is terminal (not "further" than Booked). */
  order: number;
  description: string;
};

export const SALES_STAGE_META: SalesStageMeta[] = [
  { value: "new_inquiry", label: "New Inquiry", order: 0, description: "Inquiry just received" },
  { value: "outreach_sent", label: "Outreach Sent", order: 1, description: "Venue has reached out" },
  { value: "enrolled_in_sequence", label: "Enrolled in Sequence/Workflow", order: 2, description: "Active sales follow-up workflow" },
  { value: "tour_scheduled", label: "Tour Scheduled", order: 3, description: "A real tour appointment exists" },
  { value: "proposal_sent", label: "Proposal Sent", order: 4, description: "Proposal has been sent" },
  { value: "booked", label: "Booked", order: 5, description: "Business is won — ready to set up the event" },
  { value: "lost", label: "Lost", order: 6, description: "Opportunity marked lost" },
];

/** Default Sales Pipeline entry when leaving Booked without inventing prior-stage history. */
export const SALES_PIPELINE_RETURN_STAGE: SalesStage = "new_inquiry";

export const STANDARD_SALES_PIPELINE_NAME = "Standard Sales Pipeline";

export function salesStageLabel(stage: string | null | undefined): string {
  if (!stage) return "";
  return SALES_STAGE_META.find((s) => s.value === stage)?.label ?? stage;
}

export function isSalesStage(value: string): value is SalesStage {
  return (SALES_STAGES as readonly string[]).includes(value);
}

export function salesStageOrder(stage: SalesStage): number {
  return SALES_STAGE_META.find((s) => s.value === stage)?.order ?? -1;
}

/** True if `next` is strictly further along than `current` (Lost is not forward from Booked). */
export function isForwardSalesStageMove(current: SalesStage, next: SalesStage): boolean {
  if (next === "lost") return current !== "lost" && current !== "booked";
  if (current === "lost" || current === "booked") return false;
  return salesStageOrder(next) > salesStageOrder(current);
}

/** Stages a coordinator may set manually via board/detail (not Booked). */
export function isManuallyAssignableSalesStage(stage: SalesStage): boolean {
  return stage !== "booked";
}

/**
 * Scoring intent mapping (locked): map sales stage → legacy status key used
 * by existing numeric scoring formulas — without inventing new weights.
 */
export function salesStageToLegacyScoreKey(
  stage: SalesStage,
): "new" | "contacted" | "qualified" | "proposal_sent" | "won" | "lost" | "cancelled" {
  switch (stage) {
    case "new_inquiry":
      return "new";
    case "outreach_sent":
    case "enrolled_in_sequence":
      return "contacted";
    case "tour_scheduled":
      return "qualified";
    case "proposal_sent":
      return "proposal_sent";
    case "booked":
      return "won";
    case "lost":
      return "lost";
  }
}

/** One-time migration mapping from legacy leads.status → sales_stage. */
export function migrateLegacyStatusToSalesStage(
  status: string,
  hasRealTourAppointment: boolean,
): SalesStage {
  switch (status) {
    case "new":
      return "new_inquiry";
    case "contacted":
      return "outreach_sent";
    case "qualified":
      return hasRealTourAppointment ? "tour_scheduled" : "outreach_sent";
    case "proposal_sent":
      return "proposal_sent";
    case "won":
      return "booked";
    case "lost":
    case "cancelled":
      return "lost";
    default:
      return "new_inquiry";
  }
}

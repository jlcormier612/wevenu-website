/**
 * Bridge between venue pipeline stages (canonical_stage) and leads.sales_stage.
 *
 * Venue-facing stage names/order live on pipeline_stages.
 * sales_stage remains the normalized lifecycle key for reporting, scoring,
 * and automations. Multiple venue stages may map to the same sales_stage.
 */
import type { CanonicalStage } from "@/lib/pipeline-templates/types";
import type { SalesStage } from "@/lib/leads/sales-stages";

/** Map a reporting/canonical category onto the authoritative sales_stage key. */
export function salesStageForCanonical(canonical: CanonicalStage): SalesStage {
  switch (canonical) {
    case "inquiry":
      return "new_inquiry";
    case "tour":
      return "tour_scheduled";
    case "proposal":
      return "proposal_sent";
    case "decision":
      return "enrolled_in_sequence";
    case "booked":
      return "booked";
    case "lost":
    case "cancelled":
      return "lost";
  }
}

/**
 * Best-effort reverse map used when a lead has sales_stage but no
 * pipeline_stage_id yet — pick the first venue stage whose canonical
 * matches this sales stage family.
 */
export function canonicalForSalesStage(stage: SalesStage): CanonicalStage {
  switch (stage) {
    case "new_inquiry":
    case "outreach_sent":
      return "inquiry";
    case "tour_scheduled":
      return "tour";
    case "proposal_sent":
      return "proposal";
    case "enrolled_in_sequence":
      return "decision";
    case "booked":
      return "booked";
    case "lost":
      return "lost";
  }
}

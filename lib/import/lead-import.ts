/**
 * Lead import helpers. Preferred dates never occupy the calendar.
 * Booked status on a Lead row is a hold — that person belongs in Clients.
 */
import { isSalesStage, type SalesStage } from "@/lib/leads/sales-stages";

export type ImportedLeadStage =
  | { kind: "stage"; stage: Exclude<SalesStage, "booked" | "tour_scheduled"> }
  | { kind: "booked" }
  | { kind: "tour" }
  | { kind: "unknown"; raw: string }
  | { kind: "none" };

const STAGE_ALIASES: Record<string, ImportedLeadStage> = {
  new: { kind: "stage", stage: "new_inquiry" },
  newinquiry: { kind: "stage", stage: "new_inquiry" },
  inquiry: { kind: "stage", stage: "new_inquiry" },
  outreach: { kind: "stage", stage: "outreach_sent" },
  outreachsent: { kind: "stage", stage: "outreach_sent" },
  contacted: { kind: "stage", stage: "outreach_sent" },
  followup: { kind: "stage", stage: "enrolled_in_sequence" },
  infollowup: { kind: "stage", stage: "enrolled_in_sequence" },
  enrolled: { kind: "stage", stage: "enrolled_in_sequence" },
  enrolledinsequence: { kind: "stage", stage: "enrolled_in_sequence" },
  proposal: { kind: "stage", stage: "proposal_sent" },
  proposalsent: { kind: "stage", stage: "proposal_sent" },
  lost: { kind: "stage", stage: "lost" },
  booked: { kind: "booked" },
  won: { kind: "booked" },
  tour: { kind: "tour" },
  tourscheduled: { kind: "tour" },
};

function token(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseImportedLeadSalesStage(raw: string | null | undefined): ImportedLeadStage {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "none" };
  const aliased = STAGE_ALIASES[token(value)];
  if (aliased) return aliased;
  if (isSalesStage(value) && value !== "booked" && value !== "tour_scheduled") {
    return { kind: "stage", stage: value };
  }
  if (value === "booked" || value === "tour_scheduled") {
    return value === "booked" ? { kind: "booked" } : { kind: "tour" };
  }
  return { kind: "unknown", raw: value };
}

export const LEAD_BOOKED_STATUS_HOLD =
  "Booked customers belong in Clients and their events, not Leads. A preferred date is not a booking.";

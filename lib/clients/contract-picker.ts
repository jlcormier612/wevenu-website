/**
 * Contract Builder client picker eligibility.
 *
 * Canonical operational customer for a new contract is a `clients` row
 * (`contracts.client_id`). This is not an unfiltered historical dump and
 * not a lead-table search. Eligibility is record state / relationships —
 * never a display-name string match.
 */

export const CONTRACT_PICKER_TERMINAL_LEAD_STAGES = ["lost", "cancelled"] as const;

export type ContractPickerStanding = {
  id: string;
  status: string;
  excludeFromBusinessReporting?: boolean;
  leadId: string | null;
  leadSalesStage?: string | null;
  hasEvent: boolean;
  hasContract: boolean;
  hasPaymentSchedule: boolean;
};

export type ContractPickerIneligibilityReason =
  | "cancelled"
  | "reporting_excluded"
  | "no_current_standing";

function leadHasCurrentStanding(standing: ContractPickerStanding): boolean {
  if (!standing.leadId) return false;
  const stage = standing.leadSalesStage ?? "";
  return !CONTRACT_PICKER_TERMINAL_LEAD_STAGES.includes(
    stage as (typeof CONTRACT_PICKER_TERMINAL_LEAD_STAGES)[number],
  );
}

export function contractPickerIneligibilityReason(
  standing: ContractPickerStanding,
): ContractPickerIneligibilityReason | null {
  if (standing.status === "cancelled") return "cancelled";
  if (standing.excludeFromBusinessReporting) return "reporting_excluded";
  if (
    leadHasCurrentStanding(standing)
    || standing.hasEvent
    || standing.hasContract
    || standing.hasPaymentSchedule
  ) {
    return null;
  }
  return "no_current_standing";
}

export function isSelectableForNewContract(standing: ContractPickerStanding): boolean {
  return contractPickerIneligibilityReason(standing) === null;
}

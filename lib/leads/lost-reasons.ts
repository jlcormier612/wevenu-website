/**
 * Lost-reason vocabulary for the Lost pipeline / sales-stage transition.
 */
export const LOST_REASONS = [
  { value: "chose_another_venue", label: "Chose another venue" },
  { value: "date_unavailable", label: "Date unavailable" },
  { value: "budget", label: "Budget" },
  { value: "no_response", label: "No response" },
  { value: "cancelled", label: "Cancelled" },
  { value: "other", label: "Other" },
] as const;

export type LostReasonValue = (typeof LOST_REASONS)[number]["value"];

export function isLostReasonValue(value: string): value is LostReasonValue {
  return LOST_REASONS.some((r) => r.value === value);
}

export function lostReasonLabel(value: string | null | undefined): string {
  if (!value) return "";
  return LOST_REASONS.find((r) => r.value === value)?.label ?? value;
}

export type LostReasonInput = {
  reason: LostReasonValue;
  detail?: string | null;
};

export function validateLostReasonInput(input: LostReasonInput): string | null {
  if (!isLostReasonValue(input.reason)) return "Choose a lost reason.";
  if (input.reason === "other" && !input.detail?.trim()) {
    return "Add a short detail when the reason is Other.";
  }
  return null;
}

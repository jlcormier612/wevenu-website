/**
 * Contract payment terms before a payment schedule exists: the venue's Settings
 * payment plan applied to the contracted total — the same seed Set up payments
 * pre-fills, so the contract and the later schedule agree.
 */
import type { VenueCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";
import { resolveConfiguredPlanSeed } from "@/lib/payments/configured-plan-seed";
import type { PaymentTiming } from "@/lib/payments/constants";
import { formatTimingLabel } from "@/lib/payments/starters";

function contractDueLabel(timing: PaymentTiming): string {
  if (timing.type === "due_today" || timing.type === "at_booking") return "at signing";
  const label = formatTimingLabel(timing);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function configuredPaymentTermsSummary(input: {
  prefs: Pick<
    VenueCommercialBookingPrefs,
    "remainingBalanceMode" | "defaultSchedulePresetId" | "defaultCustomSchedule"
  >;
  contractedTotal: number;
  depositAmount: number;
  formatAmount: (n: number) => string;
}): string | null {
  if (!(input.contractedTotal > 0)) return null;
  const seed = resolveConfiguredPlanSeed({
    remainingBalanceMode: input.prefs.remainingBalanceMode,
    defaultSchedulePresetId: input.prefs.defaultSchedulePresetId,
    customSchedule: input.prefs.defaultCustomSchedule,
    invoiceTotal: input.contractedTotal,
    defaultDeposit: input.depositAmount,
  });
  const lines = seed.lines.filter((l) => l.amount > 0);
  if (lines.length === 0) return null;
  return lines
    .map((l) => `• ${l.label}: ${input.formatAmount(l.amount)} — due ${contractDueLabel(l.timing)}`)
    .join("\n");
}

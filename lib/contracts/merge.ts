/**
 * Contract merge-field resolution.
 * Tokens left out of the map when values are unknown — never silently blanked,
 * except known operational fields which always receive an honest fallback so
 * customer-facing Preview/Send never shows raw {{tokens}} for those keys.
 */
import { formatContractDate } from "@/lib/contracts/constants";
import {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatRequiredClientPartyName,
  formatVenueAccessHours,
  MISSING_BALANCE_REMAINING,
  MISSING_CEREMONY_SUMMARY,
  MISSING_RECEPTION_SUMMARY,
  MISSING_VENUE_ACCESS_HOURS,
} from "@/lib/contracts/merge-extras";
import { type MergeData } from "@/lib/shared-merge/tokens";

export { mergeContent, extractTokens, type MergeData } from "@/lib/shared-merge/tokens";
export { assertCustomerSafeContractContent, findUntouchedPolicyPlaceholders } from "@/lib/contracts/starters";

export type MergeContext = {
  venueName: string;
  venueAddress?: string | null;
  venuePhone?: string | null;
  venueEmail?: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  /**
   * When set (Preview/Send with explicit required signers), becomes client_name.
   * Message templates and single-primary resolution leave this unset.
   */
  requiredClientSignerNames?: string[] | null;
  eventName?: string | null;
  eventDate: string | null;
  eventType: string | null;
  guestCount: number | null;
  eventSpaces?: string | null;
  coordinatorName?: string | null;
  packageSection?: string | null;
  includedItemsSummary?: string | null;
  additionalItemsSummary?: string | null;
  paymentScheduleSummary?: string | null;
  contractTotal?: string | null;
  contractTitle: string;
  venueAccessHours?: string | null;
  ceremonySummary?: string | null;
  receptionSummary?: string | null;
  balanceRemaining?: string | null;
};

function setIfPresent(data: MergeData, key: string, value: string | null | undefined) {
  if (value != null && value !== "") data[key] = value;
}

/** Build the MergeData map. Optional tokens are omitted when unknown. */
export function buildMergeData(ctx: MergeContext): MergeData {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const primaryName = `${ctx.clientFirstName} ${ctx.clientLastName}`.trim();
  const partyFromSigners = ctx.requiredClientSignerNames
    ? formatRequiredClientPartyName(ctx.requiredClientSignerNames)
    : "";
  const clientName = partyFromSigners || primaryName;

  const eventTypePretty = ctx.eventType
    ? ctx.eventType.charAt(0).toUpperCase() +
      ctx.eventType.slice(1).replace(/_/g, " ")
    : "";

  const data: MergeData = {
    venue_name: ctx.venueName,
    client_name: clientName,
    today_date: today,
    contract_title: ctx.contractTitle,
  };

  setIfPresent(data, "first_name", ctx.clientFirstName);
  setIfPresent(data, "last_name", ctx.clientLastName);

  setIfPresent(data, "venue_address", ctx.venueAddress);
  setIfPresent(data, "venue_phone", ctx.venuePhone);
  setIfPresent(data, "venue_email", ctx.venueEmail);
  setIfPresent(data, "client_email", ctx.clientEmail);
  setIfPresent(data, "client_phone", ctx.clientPhone);
  setIfPresent(data, "event_name", ctx.eventName);
  data.event_date = ctx.eventDate ? formatContractDate(ctx.eventDate) : "Date to be confirmed";
  data.event_type = eventTypePretty || "Celebration";
  data.guest_count = ctx.guestCount != null ? String(ctx.guestCount) : "To be confirmed";
  setIfPresent(data, "event_spaces", ctx.eventSpaces);
  setIfPresent(data, "coordinator_name", ctx.coordinatorName);
  setIfPresent(data, "package_section", ctx.packageSection);
  setIfPresent(data, "included_items_summary", ctx.includedItemsSummary);
  setIfPresent(data, "additional_items_summary", ctx.additionalItemsSummary);
  setIfPresent(data, "payment_schedule_summary", ctx.paymentScheduleSummary);
  setIfPresent(data, "contract_total", ctx.contractTotal);

  // Always resolve these keys so legacy Library templates never leave raw tokens.
  data.venue_access_hours = ctx.venueAccessHours?.trim() || MISSING_VENUE_ACCESS_HOURS;
  data.ceremony_summary = ctx.ceremonySummary?.trim() || MISSING_CEREMONY_SUMMARY;
  data.reception_summary = ctx.receptionSummary?.trim() || MISSING_RECEPTION_SUMMARY;
  data.balance_remaining = ctx.balanceRemaining?.trim() || MISSING_BALANCE_REMAINING;

  return data;
}

/** Re-export pure formatters for tests / callers. */
export {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatRequiredClientPartyName,
  formatVenueAccessHours,
};

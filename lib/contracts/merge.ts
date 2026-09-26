/**
 * Contract merge-field resolution.
 *
 * Product rule: every MERGE_FIELDS key always resolves to a real value or an
 * honest fallback. Customer-facing Preview / Review / Send must never show
 * raw {{token}} for a picker field.
 */
import { MERGE_FIELDS, formatContractDate } from "@/lib/contracts/constants";
import {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatRequiredClientPartyName,
  formatVenueAccessHours,
  MISSING_ADDITIONAL_ITEMS,
  MISSING_BALANCE_REMAINING,
  MISSING_CEREMONY_SUMMARY,
  MISSING_CLIENT_EMAIL,
  MISSING_CLIENT_PHONE,
  MISSING_CONTRACT_TOTAL,
  MISSING_COORDINATOR,
  MISSING_EVENT_NAME,
  MISSING_EVENT_SPACES,
  MISSING_FIRST_NAME,
  MISSING_INCLUDED_ITEMS,
  MISSING_LAST_NAME,
  MISSING_PACKAGE,
  MISSING_PAYMENT_SCHEDULE,
  MISSING_RECEPTION_SUMMARY,
  MISSING_VENDORS_ON_FILE,
  MISSING_VENUE_ACCESS_HOURS,
  MISSING_VENUE_ADDRESS,
  MISSING_VENUE_EMAIL,
  MISSING_VENUE_PHONE,
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

function present(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Build the MergeData map. Every MERGE_FIELDS key is always present. */
export function buildMergeData(ctx: MergeContext): MergeData {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const primaryName = `${ctx.clientFirstName} ${ctx.clientLastName}`.trim();
  const partyFromSigners = ctx.requiredClientSignerNames
    ? formatRequiredClientPartyName(ctx.requiredClientSignerNames)
    : "";
  const clientName = partyFromSigners || primaryName || "Client";

  const eventTypePretty = ctx.eventType
    ? ctx.eventType.charAt(0).toUpperCase() +
      ctx.eventType.slice(1).replace(/_/g, " ")
    : "";

  const data: MergeData = {
    venue_name: present(ctx.venueName, "Your venue"),
    venue_address: present(ctx.venueAddress, MISSING_VENUE_ADDRESS),
    venue_phone: present(ctx.venuePhone, MISSING_VENUE_PHONE),
    venue_email: present(ctx.venueEmail, MISSING_VENUE_EMAIL),
    client_name: clientName,
    first_name: present(ctx.clientFirstName, MISSING_FIRST_NAME),
    last_name: present(ctx.clientLastName, MISSING_LAST_NAME),
    client_email: present(ctx.clientEmail, MISSING_CLIENT_EMAIL),
    client_phone: present(ctx.clientPhone, MISSING_CLIENT_PHONE),
    event_name: present(ctx.eventName, MISSING_EVENT_NAME),
    event_date: ctx.eventDate ? formatContractDate(ctx.eventDate) : "Date to be confirmed",
    event_type: eventTypePretty || "Celebration",
    guest_count: ctx.guestCount != null ? String(ctx.guestCount) : "To be confirmed",
    event_spaces: present(ctx.eventSpaces, MISSING_EVENT_SPACES),
    venue_access_hours: present(ctx.venueAccessHours, MISSING_VENUE_ACCESS_HOURS),
    ceremony_summary: present(ctx.ceremonySummary, MISSING_CEREMONY_SUMMARY),
    reception_summary: present(ctx.receptionSummary, MISSING_RECEPTION_SUMMARY),
    coordinator_name: present(ctx.coordinatorName, MISSING_COORDINATOR),
    package_section: present(ctx.packageSection, MISSING_PACKAGE),
    included_items_summary: present(ctx.includedItemsSummary, MISSING_INCLUDED_ITEMS),
    additional_items_summary: present(ctx.additionalItemsSummary, MISSING_ADDITIONAL_ITEMS),
    payment_schedule_summary: present(ctx.paymentScheduleSummary, MISSING_PAYMENT_SCHEDULE),
    contract_total: present(ctx.contractTotal, MISSING_CONTRACT_TOTAL),
    balance_remaining: present(ctx.balanceRemaining, MISSING_BALANCE_REMAINING),
    today_date: today,
    contract_title: present(ctx.contractTitle, "Agreement"),
    // Deferred: not a picker Smart Field — honest wording only for legacy bodies.
    vendors_on_file: MISSING_VENDORS_ON_FILE,
  };

  return data;
}

/** Keys that must always resolve for customer-facing materialization. */
export function requiredMergeFieldKeys(): string[] {
  return MERGE_FIELDS.map((f) => f.key);
}

/** True when every MERGE_FIELDS key is present in the merge map. */
export function mergeDataCoversPickerFields(data: MergeData): boolean {
  return requiredMergeFieldKeys().every((key) => typeof data[key] === "string" && data[key] !== "");
}

/** Re-export pure formatters for tests / callers. */
export {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatRequiredClientPartyName,
  formatVenueAccessHours,
};

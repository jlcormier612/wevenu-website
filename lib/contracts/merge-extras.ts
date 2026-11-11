/**
 * Pure helpers for contract merge fields that need structured formatting.
 * Used by buildMergeData / buildContractMergeData — no DB access.
 */

import { formatTime } from "@/lib/events/constants";
import { formatCurrency } from "@/lib/invoices/constants";

export const MISSING_VENUE_ACCESS_HOURS = "Venue access hours are not listed yet.";
export const MISSING_CEREMONY_SUMMARY = "Ceremony details are not listed yet.";
export const MISSING_RECEPTION_SUMMARY = "Reception details are not listed yet.";
export const MISSING_BALANCE_REMAINING = "Balance remaining is not listed yet.";
export const MISSING_CONTRACT_TOTAL = "Total contracted amount is not listed yet.";
export const MISSING_PACKAGE_SECTION = "No package is currently selected for this booking.";
export const MISSING_INCLUDED_ITEMS = "No included items are listed on this booking yet.";
export const MISSING_ADDITIONAL_ITEMS = "No additional or optional items are listed on this booking yet.";
export const MISSING_PAYMENT_SCHEDULE = "No payment schedule is on file for this celebration yet.";
export const MISSING_COORDINATOR_NAME = "Your venue team";

/**
 * Venue-facing note on Review when the agreement still has blank sections.
 * Spaces come from the lead card; payment terms from the package on the initial
 * proposal plus the payment plan in Settings. Null when nothing is blank.
 */
export function contractReviewSourceNote(
  content: string,
  blanks: { spaces: string[] },
): string | null {
  const parts: string[] = [];
  if (blanks.spaces.some((b) => content.includes(b))) {
    parts.push("Event spaces fill in from the Spaces on the lead card.");
  }
  if (content.includes(MISSING_PAYMENT_SCHEDULE)) {
    parts.push(
      "Payment terms fill in from the package on the initial proposal and your payment plan in Settings.",
    );
  }
  if (parts.length === 0) return null;
  return `Some sections are still blank. ${parts.join(" ")} Add them there to complete this agreement, or send it as written.`;
}

/** Join required client signer names for contract party wording. */
export function formatRequiredClientPartyName(signerNames: string[]): string {
  const names = signerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

export function formatVenueAccessHours(opts: {
  setupTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teardownTime?: string | null;
}): string | null {
  const parts: string[] = [];
  const setup = formatTime(opts.setupTime);
  const start = formatTime(opts.startTime);
  const end = formatTime(opts.endTime);
  const teardown = formatTime(opts.teardownTime);
  if (setup) parts.push(`Setup ${setup}`);
  if (start && end) parts.push(`Event ${start} – ${end}`);
  else if (start) parts.push(`Event starts ${start}`);
  else if (end) parts.push(`Event ends ${end}`);
  if (teardown) parts.push(`Teardown ${teardown}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatCeremonyOrReceptionSummary(opts: {
  label: "Ceremony" | "Reception";
  location?: string | null;
  startTime?: string | null;
  spaceAssignmentLabel?: string | null;
}): string | null {
  const location = opts.location?.trim() || "";
  const time = formatTime(opts.startTime);
  const space = opts.spaceAssignmentLabel?.trim() || "";

  if (location && time) return `${opts.label} at ${location}, ${time}`;
  if (location) return `${opts.label} at ${location}`;
  if (space && time) return `${space}, ${time}`;
  if (space) return space;
  if (time) return `${opts.label} at ${time}`;
  return null;
}

/** Currency string when an authoritative remaining amount is known. */
export function formatBalanceRemaining(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return formatCurrency(amount);
}

/** Contract total for merge — always customer-facing currency when numeric. */
export function formatContractTotalAmount(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return formatCurrency(amount);
}

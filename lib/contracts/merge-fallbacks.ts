/**
 * Honest fallbacks for Contract Smart Fields when the authoritative source
 * has no value yet. Every MERGE_FIELDS key must resolve to either a real
 * value or one of these — never raw {{token}} in customer-facing output.
 */

export const MISSING_VENUE_ACCESS_HOURS = "Venue access hours are not listed yet.";
export const MISSING_CEREMONY_SUMMARY = "Ceremony details are not listed yet.";
export const MISSING_RECEPTION_SUMMARY = "Reception details are not listed yet.";
export const MISSING_BALANCE_REMAINING = "Balance remaining is not listed yet.";
export const MISSING_EVENT_SPACES = "No event spaces are listed on this booking yet.";
export const MISSING_CONTRACT_TOTAL = "Total contracted amount is not listed yet.";
export const MISSING_PACKAGE = "No package is currently selected for this booking.";
export const MISSING_INCLUDED_ITEMS = "No included items are listed on this booking yet.";
export const MISSING_ADDITIONAL_ITEMS = "No additional or optional items are listed on this booking yet.";
export const MISSING_PAYMENT_SCHEDULE = "No payment schedule is on file for this celebration yet.";
export const MISSING_COORDINATOR = "Your venue team";
export const MISSING_VENUE_ADDRESS = "Address on file with the venue";
export const MISSING_VENUE_PHONE = "Phone on file with the venue";
export const MISSING_VENUE_EMAIL = "Email on file with the venue";
export const MISSING_CLIENT_EMAIL = "Email on the client record";
export const MISSING_CLIENT_PHONE = "Phone on the client record";
export const MISSING_EVENT_NAME = "Your celebration";
export const MISSING_FIRST_NAME = "First name is not listed yet.";
export const MISSING_LAST_NAME = "Last name is not listed yet.";

/** Deferred token — no contract-time vendor SoT; honest wording only (never invents vendors). */
export const MISSING_VENDORS_ON_FILE = "Vendors on file are not listed yet.";

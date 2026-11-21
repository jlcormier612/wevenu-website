/**
 * Import at the top of write-capable QA scripts:
 *   import { assertWritableQaVenue } from "./lib/assert-writable-venue.mts";
 *   assertWritableQaVenue({ venueId, venueName, purpose: "..." });
 */
export {
  assertWritableQaVenue,
  isProtectedSandboxVenueId,
  isProtectedSandboxVenueName,
  looksLikeDisposableVenueName,
  PROTECTED_SANDBOX_VENUE_IDS,
  PROTECTED_SANDBOX_VENUE_ID_SET,
} from "@/lib/qa/protected-venues";

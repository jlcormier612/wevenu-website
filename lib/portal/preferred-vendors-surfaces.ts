/**
 * Couple-facing Preferred Vendors entry points (Guide, Home deep-links).
 * When the venue disables the Preferred Vendors planning capability, no
 * navigation path should present Preferred Vendors as something to use.
 * Historical vendor data is left intact — this only gates presentation.
 */

import type { VenuePlanningCapabilities } from "@/lib/playbooks/capabilities";

export function shouldOfferPreferredVendorsNavigation(
  caps: Pick<VenuePlanningCapabilities, "vendors"> | null | undefined,
): boolean {
  return caps?.vendors ?? true;
}

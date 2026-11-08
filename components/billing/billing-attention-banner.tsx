import Link from "next/link";

import { loadVenueEntitlementRow } from "@/lib/entitlement";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { getCurrentVenue } from "@/lib/venue/service";

function formatUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return (
    t.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }) + " (UTC)"
  );
}

/**
 * In-app warning for venue billing roles during grace or scheduled cancellation.
 * Does not appear for unrelated staff without account.billing / ownership.
 */
export async function BillingAttentionBanner() {
  const venue = await getCurrentVenue();
  if (!venue || venue.accessDisabled) return null;

  const membership = await getActiveVenueMembership();
  const canSee =
    membership?.isOwner === true ||
    (membership ? hasCapability(membership, "account.billing") : false);
  if (!canSee) return null;

  const row = await loadVenueEntitlementRow(venue.id);
  if (!row) return null;

  const status = row.entitlement_status;
  const ends = formatUtc(row.access_ends_at ?? row.current_period_end);
  if (status !== "grace" && status !== "scheduled_end" && !row.cancel_at_period_end) {
    return null;
  }

  const message =
    status === "grace"
      ? `Payment needs attention. Your services stay available${ends ? ` through ${ends}` : ""}.`
      : `Cancellation scheduled. Access continues${ends ? ` through ${ends}` : ""}.`;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>{message}</p>
        <Link
          href="/settings/billing"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Manage billing
        </Link>
      </div>
    </div>
  );
}

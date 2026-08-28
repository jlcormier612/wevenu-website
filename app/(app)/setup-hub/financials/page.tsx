import type { Metadata } from "next";

import { PostSetupFinancial } from "@/components/setup/post-setup-financial";
import { buildQuickBooksConnectUrl } from "@/lib/quickbooks/config";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog } from "@/lib/quickbooks/service";
import { buildStripeConnectUrl } from "@/lib/stripe/oauth";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Financials — Setup" };
export const dynamic = "force-dynamic";

/**
 * Continuous Setup Experience — wires the existing PostSetupFinancial
 * screen (previously built for the pre-workspace wizard's one-time
 * post-creation step, imported nowhere) into Setup Hub as a reachable
 * stage. Reused exactly as-is, no changes to its own logic or copy.
 */
export default async function SetupHubFinancialsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [quickbooksConnection, quickbooksSyncLog] = await Promise.all([
    getQuickBooksConnection(),
    getRecentQuickBooksSyncLog(),
  ]);

  return (
    <PostSetupFinancial
      venue={venue}
      quickbooksConnection={quickbooksConnection}
      quickbooksSyncLog={quickbooksSyncLog}
      stripeConnectUrl={buildStripeConnectUrl(venue.id, "onboarding")}
      quickbooksConnectUrl={buildQuickBooksConnectUrl(venue.id, "onboarding")}
    />
  );
}

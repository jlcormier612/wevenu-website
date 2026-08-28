import type { Metadata } from "next";

import { PostSetupFinancial } from "@/components/setup/post-setup-financial";
import { buildQuickBooksConnectUrl } from "@/lib/quickbooks/config";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog } from "@/lib/quickbooks/service";
import { buildStripeConnectUrl } from "@/lib/stripe/oauth";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Financials — Setup" };
export const dynamic = "force-dynamic";

/**
 * Continuous Setup Experience — wires PostSetupFinancial into Setup Hub
 * as a reachable stage. Next returns to /setup-hub (graduation lives on
 * Ready to Invite Couples, not this screen).
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
    />
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { QuickBooksConnectSection } from "@/components/settings/quickbooks-connect-section";
import { FacebookConnectSection } from "@/components/settings/facebook-connect-section";
import { getCurrentVenue } from "@/lib/venue/service";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog } from "@/lib/quickbooks/service";
import { getFacebookConnection, getFacebookLeadForms, getRecentFacebookLog } from "@/lib/facebook/service";

export const metadata: Metadata = { title: "Financials & Integrations — Settings" };

export default async function FinancialsIntegrationsSettingsPage() {
  const venue = await getCurrentVenue();
  const [quickbooksConnection, quickbooksSyncLog, facebookConnection, facebookLeadForms, facebookLog] = await Promise.all([
    getQuickBooksConnection(), getRecentQuickBooksSyncLog(),
    getFacebookConnection(), getFacebookLeadForms(), getRecentFacebookLog(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financials & Integrations"
        description="Payments, accounting, and connected services."
      />
      <SettingsTabs />

      {venue && <div id="stripe" className="scroll-mt-20"><StripeConnectSection venue={venue} /></div>}
      {venue && <QuickBooksConnectSection venueId={venue.id} connection={quickbooksConnection} syncLog={quickbooksSyncLog} />}
      {venue && <FacebookConnectSection venueId={venue.id} connection={facebookConnection} leadForms={facebookLeadForms} recentLog={facebookLog} />}
    </div>
  );
}

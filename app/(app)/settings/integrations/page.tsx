import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { QuickBooksConnectSection } from "@/components/settings/quickbooks-connect-section";
import { FacebookConnectSection } from "@/components/settings/facebook-connect-section";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { buildFacebookOAuthUrl } from "@/lib/facebook/config";
import { buildQuickBooksConnectUrl } from "@/lib/quickbooks/config";
import { buildStripeConnectUrl } from "@/lib/stripe/oauth";
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

      {venue && (
        <div id="stripe" className="scroll-mt-20 space-y-2">
          <StripeConnectSection venue={venue} connectUrl={buildStripeConnectUrl(venue.id)} />
          <div className="px-1"><SetupGuideLink href="/help/setup-financials#stripe" label="Need help connecting? Follow the step-by-step guide" /></div>
        </div>
      )}

      {venue && (
        <div id="quickbooks" className="scroll-mt-20 space-y-2">
          <QuickBooksConnectSection venueId={venue.id} connection={quickbooksConnection} syncLog={quickbooksSyncLog} connectUrl={buildQuickBooksConnectUrl(venue.id)} />
          <div className="px-1"><SetupGuideLink href="/help/setup-financials#quickbooks" label="Need help connecting? Follow the step-by-step guide" /></div>
        </div>
      )}

      {venue && (
        <div id="facebook" className="scroll-mt-20 space-y-2">
          <FacebookConnectSection
            venueId={venue.id}
            connection={facebookConnection}
            leadForms={facebookLeadForms}
            recentLog={facebookLog}
            connectUrl={buildFacebookOAuthUrl(venue.id)}
          />
          <div className="px-1"><SetupGuideLink href="/help/setup-lead-capture#facebook" label="Need help connecting? Follow the step-by-step guide" /></div>
        </div>
      )}
    </div>
  );
}

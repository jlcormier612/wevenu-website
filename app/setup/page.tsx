import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PostSetupFinancial } from "@/components/setup/post-setup-financial";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog } from "@/lib/quickbooks/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = {
  title: "Set up your venue",
};

type Props = { searchParams: Promise<{ financial?: string }> };

/**
 * Venue Setup entry. Requires an authenticated user (defense in depth alongside
 * the proxy). If a venue has already been created, the workspace exists — send
 * the user there instead of re-running setup, UNLESS this is the one-time
 * post-setup Financial Setup step (?financial=1), which needs a real venue_id
 * to exist before QuickBooks/Stripe can be connected — this is also the page
 * the QuickBooks OAuth callback redirects back to when it was initiated from
 * onboarding rather than Settings.
 */
export default async function SetupPage({ searchParams }: Props) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const venue = await getCurrentVenue();
  const { financial } = await searchParams;

  if (venue?.setupCompleted) {
    if (financial === "1") {
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
    redirect("/dashboard");
  }

  return <SetupWizard ownerEmail={user.email ?? ""} />;
}

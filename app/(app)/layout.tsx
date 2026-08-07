import { redirect } from "next/navigation";

import { StaffLegalAcceptance } from "@/components/legal/staff-legal-acceptance";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getLegalGateStatus,
  VENUE_APP_LEGAL_TYPES,
} from "@/lib/legal/service";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

/**
 * Protected layout for the venue workspace. Confirms an authenticated session
 * (defense in depth alongside the proxy), then enforces the foundational rule:
 * nothing in VenueOS exists until the venue exists. Without a completed venue,
 * the user is sent to Venue Setup.
 *
 * After auth, compares accepted legal versions against currently active
 * Venue ToS + Privacy — blocks the shell when newer versions require acceptance.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (!venue?.setupCompleted) {
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");
    redirect("/setup");
  }

  // Defense in depth alongside proxy hard-lock for CRM Suspend / unpaid dunning.
  if (venue.accessDisabled || venue.accountStatus === "suspended") {
    redirect("/billing/suspended");
  }

  const legalGate = await getLegalGateStatus(user.id, VENUE_APP_LEGAL_TYPES);
  if (legalGate.needsAcceptance) {
    return (
      <StaffLegalAcceptance
        portal="venue"
        documents={legalGate.documents}
        title="Review venue terms"
        checkboxLabel="I have read and agree to the Venue Terms of Service and Privacy Policy."
      />
    );
  }

  void recordStaffActivity(user.id);

  return (
    <WorkspaceShell
      email={user.email ?? ""}
      venueName={venue.name}
      venueLogo={venue.logoUrl}
    >
      {children}
    </WorkspaceShell>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/module-placeholder";
import { VenueGuideEditor } from "@/components/guide/venue-guide-editor";
import { ensureFaqStartersForCurrentVenue } from "@/lib/venue-guide/provision";
import { FAQ_STARTER_MASTERS, type FaqStarterMasterKey } from "@/lib/venue-guide/starters";
import { getCurrentVenue } from "@/lib/venue/service";
import { loadVenueGuideAction } from "./actions";

export const metadata: Metadata = { title: "Venue Guide" };

export default async function VenueGuidePage() {
  await ensureFaqStartersForCurrentVenue();
  const [initial, venue] = await Promise.all([loadVenueGuideAction(), getCurrentVenue()]);
  const presentKeys = new Set(
    (initial?.faqs ?? [])
      .map((f) => f.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const missingStarterKeys = FAQ_STARTER_MASTERS
    .map((m) => m.key)
    .filter((k): k is FaqStarterMasterKey => !presentKeys.has(k));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Guide"
        description="Everything your clients need to know — parking, policies, FAQs, and more. Clients browse this in their portal and Luv answers questions from it."
      />
      <VenueGuideEditor initial={initial} missingStarterKeys={missingStarterKeys} initialStory={venue?.story ?? ""} />
    </div>
  );
}

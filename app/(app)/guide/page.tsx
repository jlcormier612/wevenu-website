import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";

import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { VenueGuideEditor } from "@/components/guide/venue-guide-editor";
import { ensureFaqStartersForCurrentVenue } from "@/lib/venue-guide/provision";
import { FAQ_STARTER_MASTERS, type FaqStarterMasterKey } from "@/lib/venue-guide/starters";
import { getCurrentVenue } from "@/lib/venue/service";
import { loadVenueGuideAction } from "./actions";

export const metadata: Metadata = { title: "Venue Guide" };

async function VenueGuideBodyIsland() {
  const [initial, venue] = await Promise.all([loadVenueGuideAction(), getCurrentVenue()]);
  const presentKeys = new Set(
    (initial?.faqs ?? [])
      .map((f) => f.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const missingStarterKeys = FAQ_STARTER_MASTERS.map((m) => m.key).filter(
    (k): k is FaqStarterMasterKey => !presentKeys.has(k),
  );

  return (
    <VenueGuideEditor
      initial={initial}
      missingStarterKeys={missingStarterKeys}
      initialStory={venue?.story ?? ""}
    />
  );
}

export default function VenueGuidePage() {
  after(() => {
    void ensureFaqStartersForCurrentVenue().catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: "venue_guide_faq_ensure_failed",
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
    });
  });

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-testid="venue-guide-streaming-root">
      <SetupHubReturnLink
        href="/setup-hub/make-htc-yours/operational-resources"
        label="Back to your planning tools"
      />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Venue Guide"
          description="Everything your clients need to know — parking, policies, FAQs, and more. Clients browse this in their portal and Luv answers questions from it."
        />
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading venue guide" />}>
        <VenueGuideBodyIsland />
      </Suspense>
    </div>
  );
}

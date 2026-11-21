import type { Metadata } from "next";
import { Suspense } from "react";

import { LibraryDocumentsManager } from "@/components/library/library-documents-manager";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getVenueDocuments } from "@/lib/documents/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Documents" };

async function DocumentsBodyIsland() {
  const [documents, venue] = await Promise.all([getVenueDocuments(), getCurrentVenue()]);
  if (!venue) {
    return <p className="text-sm text-muted-foreground">Select a venue to manage documents.</p>;
  }
  return <LibraryDocumentsManager documents={documents} venueId={venue.id} />;
}

export default function LibraryDocumentsPage() {
  return (
    <div
      className="htc-hospitality-page space-y-4 sm:space-y-6"
      data-htc-phase10="library-documents"
      data-testid="documents-streaming-root"
    >
      <SetupHubReturnLink
        href="/setup-hub/make-htc-yours/operational-resources"
        label="Back to your planning tools"
      />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Documents"
          description="Files you reuse across bookings — available to your whole venue, not tied to one lead or event."
        />
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading documents" />}>
        <DocumentsBodyIsland />
      </Suspense>
    </div>
  );
}

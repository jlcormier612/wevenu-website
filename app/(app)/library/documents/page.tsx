import type { Metadata } from "next";

import { LibraryDocumentsManager } from "@/components/library/library-documents-manager";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getVenueDocuments } from "@/lib/documents/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Documents" };

export default async function LibraryDocumentsPage() {
  const [documents, venue] = await Promise.all([getVenueDocuments(), getCurrentVenue()]);
  if (!venue) return null;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-htc-phase10="library-documents">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Documents"
          description="Files you reuse across bookings — available to your whole venue, not tied to one lead or event."
        />
      </div>
      <LibraryDocumentsManager documents={documents} venueId={venue.id} />
    </div>
  );
}

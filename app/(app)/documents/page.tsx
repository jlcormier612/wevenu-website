import type { Metadata } from "next";

import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import { getPinnedDocumentKeys, getRecentInteractionMap, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const [documents, pinnedKeys, recentMap] = await Promise.all([
    getVenueWorkspaceDocuments(),
    getPinnedDocumentKeys(),
    getRecentInteractionMap(),
  ]);

  return (
    <DocumentWorkspace
      title="Documents"
      description="Contracts, questionnaires, event orders, invoices, and files — one place to find anything."
      documents={documents}
      initialPinnedKeys={[...pinnedKeys]}
      initialRecentEntries={[...recentMap.entries()]}
    />
  );
}

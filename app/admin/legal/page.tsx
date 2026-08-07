import type { Metadata } from "next";

import { LegalDocumentsTable } from "@/components/hq/legal-documents-table";
import { getLegalDocumentTypeSummariesForAdmin } from "@/lib/legal/service";

export const metadata: Metadata = {
  title: "Legal — Hello to Cheers HQ",
};

export default async function AdminLegalPage() {
  const rows = await getLegalDocumentTypeSummariesForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-heading">
          Legal Documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide terms and policies. Published versions are immutable —
          create a new version to change the text, then activate it.
        </p>
      </div>

      <LegalDocumentsTable rows={rows} />
    </div>
  );
}

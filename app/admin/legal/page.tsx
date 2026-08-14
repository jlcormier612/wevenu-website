import type { Metadata } from "next";
import Link from "next/link";

import { LegalDashboardCards } from "@/components/hq/legal-dashboard-cards";
import { LegalDocumentsTable } from "@/components/hq/legal-documents-table";
import { Button } from "@/components/ui/button";
import { getLegalAdminDashboard } from "@/lib/legal/admin-service";

export const metadata: Metadata = {
  title: "Legal — Hello to Cheers HQ",
};

export default async function AdminLegalPage() {
  const { summary, documents } = await getLegalAdminDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-heading">
            Legal Administration
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide terms and policies. Published versions are immutable —
            publish a new version to change the text, then activate it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/legal/outstanding" />}
          >
            Outstanding Acceptances
          </Button>
          <Button
            variant="outline"
            render={<Link href="/admin/legal/history" />}
          >
            Acceptance History
          </Button>
        </div>
      </div>

      <LegalDashboardCards summary={summary} />

      <div className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-heading">
          Legal Documents
        </h2>
        <LegalDocumentsTable rows={documents} />
      </div>
    </div>
  );
}

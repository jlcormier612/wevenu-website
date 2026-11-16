import type { Metadata } from "next";
import Link from "next/link";

import { ContractTemplateList } from "@/components/contracts/contract-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureContractStartersForCurrentVenue } from "@/lib/contracts/provision";
import { getTemplates } from "@/lib/contracts/service";

export const metadata: Metadata = { title: "Contract Templates" };

// The one page the sidebar's "Contract Templates" nav item actually links
// to (lib/navigation.ts) — /contracts/templates is the same data.
export default async function ContractTemplatesLibraryPage() {
  await ensureContractStartersForCurrentVenue();
  const templates = await getTemplates(true);
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/booking-process" label="Back to your booking process" />
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Contract Templates"
          description="Prepare reusable agreements for your venue. Event details can be filled in when you use a template."
          actions={
            <Button render={<Link href="/contracts/templates/new" />}>+ New Template</Button>
          }
        />
      </div>
      <LibraryHowItWorks tone="calm">
        Review your agreement before using it with clients. You can create your own version while keeping the original starter available.
      </LibraryHowItWorks>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No contract templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a template, or refresh to load the Wedding Venue Agreement starter.
          </p>
          <Button render={<Link href="/contracts/templates/new" />}>+ New Template</Button>
        </div>
      ) : (
        <ContractTemplateList initialTemplates={templates} />
      )}
    </div>
  );
}

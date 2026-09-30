import type { Metadata } from "next";
import Link from "next/link";

import { ContractTemplateList } from "@/components/contracts/contract-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
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
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Contract Templates"
        description="Reusable agreements with event details filled in from Hello to Cheers. Signed agreements live under Contracts."
        actions={
          <Button render={<Link href="/contracts/templates/new" />}>+ New Template</Button>
        }
      />
      <LibraryHowItWorks>
        Agreement text and fields are authored in the contract template editor. When you apply a template to an event, event details fill in automatically — there is no separate catalog to manage for contract content.
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

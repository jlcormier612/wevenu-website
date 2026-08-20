import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Planning Templates" };

export default async function PlaybooksLibraryPage() {
  const templates = await getTemplatesForLibrary();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Templates"
        description="Reusable checklists you refine once, then apply to each event. Open a template to see what's inside — applying always creates that event's own editable copy."
      />
      <PlaybooksSection initialTemplates={templates} />
    </div>
  );
}

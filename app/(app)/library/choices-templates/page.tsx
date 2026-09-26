import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { ChoicesTemplateList } from "@/components/client-choices-templates/choices-template-list";
import { getTemplates } from "@/lib/client-choices-templates/service";

export const metadata: Metadata = { title: "Choices Templates" };

export default async function ChoicesTemplatesPage() {
  const templates = await getTemplates(true);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Choices Templates"
        description="Reusable client choice forms — menus, bar, linens, rentals, and other post-booking decisions. Sending creates a client copy; finalizing updates Event Order."
      />
      <ChoicesTemplateList templates={templates} />
    </div>
  );
}

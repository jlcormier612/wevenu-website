import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PublicFormList } from "@/components/public-forms/public-form-list";
import { listPublicForms } from "@/lib/public-forms/service";
import { getCurrentUserRole } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Public Forms" };

export default async function PublicFormsLibraryPage() {
  const [forms, role] = await Promise.all([listPublicForms(true), getCurrentUserRole()]);
  const canEdit = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Forms"
        description="Purpose-specific lead capture forms you can share by link or QR — separate from your main inquiry form."
      />
      <PublicFormList initialForms={forms} canEdit={canEdit} />
    </div>
  );
}

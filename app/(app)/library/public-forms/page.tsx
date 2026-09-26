import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PublicFormList } from "@/components/public-forms/public-form-list";
import { listPublicForms } from "@/lib/public-forms/service";
import { safePublicFormEditorReturnTo } from "@/lib/qr-campaigns/qr-form-return";
import { getCurrentUserRole } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Public Forms" };

type Props = {
  searchParams: Promise<{ create?: string; returnTo?: string }>;
};

export default async function PublicFormsLibraryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const returnTo = safePublicFormEditorReturnTo(sp.returnTo);
  const openCreate = sp.create === "1";
  const [forms, role] = await Promise.all([listPublicForms(true), getCurrentUserRole()]);
  const canEdit = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Forms"
        description="Purpose-specific lead capture forms you can share by link or QR — separate from your main inquiry form."
      />
      <PublicFormList
        initialForms={forms}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
        canEdit={canEdit}
        initialShowCreate={openCreate}
        returnTo={returnTo}
      />
    </div>
  );
}

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
        description="Purpose-specific lead capture forms — separate from your main inquiry form."
      />
      <p className="rounded-sm border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Create a form once, then share it directly or use it as the destination for a QR campaign (bridal show, open house, brochure, sign).
        {" "}
        <a href="/library/qr-campaigns" className="font-medium text-heading hover:underline">
          QR Campaigns →
        </a>
      </p>
      <PublicFormList
        initialForms={forms}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
        canEdit={canEdit}
      />
    </div>
  );
}

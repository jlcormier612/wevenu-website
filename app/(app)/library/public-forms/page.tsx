import type { Metadata } from "next";

import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
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
      <LibraryHowItWorks>
        Build questions and fields on each form. Submissions create leads. Optionally create a QR campaign that opens this form.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Questions and fields are edited on the form itself. Create a QR campaign when you want a printable code that opens this form."
        action={{ href: "/library/qr-campaigns", label: "Open QR Campaigns" }}
      >
        QR Campaigns can use these forms as their destination.
      </LibraryDependencyNote>
      <PublicFormList
        initialForms={forms}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
        canEdit={canEdit}
      />
    </div>
  );
}

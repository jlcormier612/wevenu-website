import type { Metadata } from "next";

import { PublicFormsPageClient } from "@/components/public-forms/public-forms-page-client";
import { listPublicForms } from "@/lib/public-forms/service";
import { getCurrentUserRole } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Public Forms" };

export default async function PublicFormsLibraryPage() {
  const [forms, role] = await Promise.all([listPublicForms(true), getCurrentUserRole()]);
  const canEdit = role === "owner" || role === "manager";

  return (
    <PublicFormsPageClient
      forms={forms}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      canEdit={canEdit}
    />
  );
}

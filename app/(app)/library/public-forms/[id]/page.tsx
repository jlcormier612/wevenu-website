import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormBuilder } from "@/components/public-forms/public-form-builder";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  getPublicForm,
  listLeadsForPublicForm,
  listQrCampaignsForPublicForm,
} from "@/lib/public-forms/service";
import { getCurrentUserRole } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const form = await getPublicForm(id);
  return { title: form ? form.internalName : "Public Form" };
}

export default async function PublicFormDetailPage({ params }: Props) {
  const { id } = await params;
  const [form, role, qrCodes, leads] = await Promise.all([
    getPublicForm(id),
    getCurrentUserRole(),
    listQrCampaignsForPublicForm(id),
    listLeadsForPublicForm(id),
  ]);
  if (!form) notFound();
  const canEdit = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.internalName}
        description="Create a form, publish it, share the link or QR codes, and responses become leads."
      />
      <PublicFormBuilder
        form={form}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
        canEdit={canEdit}
        qrCodes={qrCodes}
        leads={leads}
      />
    </div>
  );
}

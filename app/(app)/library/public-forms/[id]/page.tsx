import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormBuilder } from "@/components/public-forms/public-form-builder";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  getPublicForm,
  listLeadsForPublicForm,
  listQrCampaignsForPublicForm,
} from "@/lib/public-forms/service";
import {
  safePublicFormEditorReturnTo,
  stampQrCreateReturnWithPublicFormId,
} from "@/lib/qr-campaigns/qr-form-return";
import { getCurrentUserRole } from "@/lib/venue/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const form = await getPublicForm(id);
  return { title: form ? form.internalName : "Public Form" };
}

export default async function PublicFormDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const returnTo =
    safePublicFormEditorReturnTo(sp.returnTo) ??
    // If opened without returnTo but came from QR create intent, still allow a sensible back path.
    null;
  const [form, role, qrCodes, leads] = await Promise.all([
    getPublicForm(id),
    getCurrentUserRole(),
    listQrCampaignsForPublicForm(id),
    listLeadsForPublicForm(id),
  ]);
  if (!form) notFound();
  const canEdit = role === "owner" || role === "manager";

  // When returning to QR create, stamp this form id and keep the draft campaign name.
  const qrReturnTo =
    returnTo?.startsWith("/library/qr-campaigns")
      ? (stampQrCreateReturnWithPublicFormId(returnTo, form.id) ?? returnTo)
      : returnTo;

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
        returnTo={qrReturnTo}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { ChoicesTemplateDetail } from "@/components/client-choices-templates/choices-template-detail";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getTemplate } from "@/lib/client-choices-templates/service";
import { listOfferings } from "@/lib/offerings/service";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Edit · ${template.name}` : "Choices template" };
}

export default async function ChoicesTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [template, offerings] = await Promise.all([getTemplate(id), listOfferings()]);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/library/choices-templates" className="text-xs text-muted-foreground hover:underline">
          ← Choices Templates
        </Link>
        <PageHeader title={template.name} description="Define choice groups and options. Clients select after you send; you finalize into Event Order." />
      </div>
      <ChoicesTemplateDetail template={template} offerings={offerings} />
    </div>
  );
}

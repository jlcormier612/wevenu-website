import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventOrderTemplateDetail } from "@/components/event-order-templates/event-order-template-detail";
import { getTemplate } from "@/lib/event-order-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template?.name ?? "Event Order Template" };
}

export default async function EventOrderTemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return <EventOrderTemplateDetail template={template} />;
}

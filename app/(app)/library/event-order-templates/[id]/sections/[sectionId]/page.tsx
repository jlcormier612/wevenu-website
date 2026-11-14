import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventOrderSectionEditor } from "@/components/event-order-templates/event-order-section-editor";
import { getTemplate } from "@/lib/event-order-templates/service";
import { listOfferingChoiceGroups } from "@/lib/offerings/choice-groups-service";
import { listOfferings } from "@/lib/offerings/service";

type Props = {
  params: Promise<{ id: string; sectionId: string }>;
  searchParams: Promise<{ choice?: string; offering?: string; category?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, sectionId } = await params;
  const template = await getTemplate(id);
  const section = template?.sections.find((s) => s.id === sectionId);
  return { title: section ? `${section.name} — ${template?.name}` : "Event Order section" };
}

export default async function EventOrderSectionEditorPage({ params, searchParams }: Props) {
  const { id, sectionId } = await params;
  const focus = await searchParams;
  const template = await getTemplate(id);
  if (!template) notFound();
  const section = template.sections.find((s) => s.id === sectionId);
  if (!section) notFound();
  const [catalogOfferings, catalogChoiceGroups] = await Promise.all([
    listOfferings(true),
    listOfferingChoiceGroups(),
  ]);
  return (
    <EventOrderSectionEditor
      template={template}
      section={section}
      catalogOfferings={catalogOfferings}
      catalogChoiceGroups={catalogChoiceGroups}
      focus={{
        choice: focus.choice ?? null,
        offering: focus.offering ?? null,
        category: focus.category ?? null,
      }}
    />
  );
}

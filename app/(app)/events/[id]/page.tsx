import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/event-detail";
import { getDocuments } from "@/lib/documents/service";
import { getInvoices } from "@/lib/invoices/service";
import { getEvent } from "@/lib/events/service";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getVendors } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: event.name };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const [event, availableVendors, allInvoices, documents, questionnaire] = await Promise.all([
    getEvent(id), getVendors(), getInvoices({}), getDocuments("event", id), getQuestionnaire(id),
  ]);
  if (!event) notFound();
  const eventInvoices = allInvoices.filter((inv) => inv.eventId === id || (event.clientId && inv.clientId === event.clientId));
  return <EventDetail event={event} availableVendors={availableVendors} invoices={eventInvoices} documents={documents} questionnaire={questionnaire} />;
}

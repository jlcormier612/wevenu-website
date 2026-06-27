import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/event-detail";
import { getInvoices } from "@/lib/invoices/service";
import { getEvent } from "@/lib/events/service";
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
  const [event, availableVendors] = await Promise.all([getEvent(id), getVendors()]);
  if (!event) notFound();
  const invoices = await getInvoices({ q: "", status: "" });
  const eventInvoices = invoices.filter((inv) => inv.eventId === id || (event.clientId && inv.clientId === event.clientId));
  return <EventDetail event={event} availableVendors={availableVendors} invoices={eventInvoices} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/event-detail";
import { getDocuments } from "@/lib/documents/service";
import { getInvoices } from "@/lib/invoices/service";
import { getEvent } from "@/lib/events/service";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getEventTasks, getTemplates } from "@/lib/playbooks/service";
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
  const [event, availableVendors, allInvoices, documents, questionnaire, eventTasks, playbookTemplates] = await Promise.all([
    getEvent(id), getVendors(), getInvoices({}), getDocuments("event", id), getQuestionnaire(id),
    getEventTasks(id), getTemplates(),
  ]);
  if (!event) notFound();
  const eventInvoices = allInvoices.filter((inv) => inv.eventId === id || (event.clientId && inv.clientId === event.clientId));

  // Fetch client email for questionnaire send-to-couple
  let coupleEmail: string | null = null;
  if (event.clientId) {
    const { createClient: mkClient } = await import("@/integrations/supabase/server");
    const sb = await mkClient();
    const { data: cl } = await sb.from("clients").select("email").eq("id", event.clientId).maybeSingle<{ email: string | null }>();
    coupleEmail = cl?.email ?? null;
  }

  return <EventDetail event={event} availableVendors={availableVendors} invoices={eventInvoices} documents={documents} questionnaire={questionnaire} coupleEmail={coupleEmail} eventTasks={eventTasks} playbookTemplates={playbookTemplates} />;
}

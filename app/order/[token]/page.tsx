import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventOrderDocumentClient } from "@/components/event-orders/event-order-document-client";
import { getEventOrderDocumentByToken } from "@/lib/event-orders/couple-document";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const doc = await getEventOrderDocumentByToken(token);
  if (!doc) return { title: "Event Order" };
  return { title: `${doc.eventName ?? "Your event"} · Event Order` };
}

export default async function EventOrderDocumentPage({ params }: Props) {
  const { token } = await params;
  const doc = await getEventOrderDocumentByToken(token);
  if (!doc) notFound();
  return <EventOrderDocumentClient key={`${doc.revision}-${doc.approved}`} token={token} doc={doc} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/clients/client-detail";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Client not found" };
  return { title: clientDisplayName(client.firstName, client.lastName) };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return <ClientDetail client={client} />;
}

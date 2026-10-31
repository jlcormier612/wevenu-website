/**
 * On-request PDFs for the Documents viewer. A finalized contract serves its
 * stored Final PDF; everything else renders the current record with the
 * existing generators and a status note so a working copy is never mistaken
 * for the signed or shared one.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { contractWorkingCopyNote, eventOrderPdfNote } from "@/lib/document-workspace/viewer";

export type WorkspacePdfResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: 401 | 404 | 500; message: string };

function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return `${cleaned || "Document"}.pdf`;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderContractPdfForViewer(contractId: string): Promise<WorkspacePdfResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, status: 401, message: "No venue found." };

  const { getContractDetail } = await import("@/lib/contracts/service");
  const contract = await getContractDetail(contractId);
  if (!contract) return { ok: false, status: 404, message: "Contract not found." };
  const filename = safeFilename(contract.title);

  const { getContractPdfUrl } = await import("@/lib/contracts/finalize");
  const finalUrl = await getContractPdfUrl(contractId);
  if (finalUrl.ok) {
    const bytes = await fetchBytes(finalUrl.url);
    if (bytes) return { ok: true, bytes, filename };
  }

  const { generateContractPdf } = await import("@/lib/contracts/pdf");
  const buffer = await generateContractPdf(contract, venue, contract.signers, contractWorkingCopyNote(contract.status));
  return { ok: true, bytes: new Uint8Array(buffer), filename };
}

export async function renderEventOrderPdfForViewer(eventOrderId: string): Promise<WorkspacePdfResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, status: 401, message: "No venue found." };

  const supabase = await createClient();
  const repo = await import("@/lib/event-orders/repository");
  const eventOrder = await repo.getEventOrderById(supabase, venue.id, eventOrderId);
  if (!eventOrder) return { ok: false, status: 404, message: "Event Order not found." };
  const full = await repo.getEventOrderByEvent(supabase, venue.id, eventOrder.eventId);
  if (!full) return { ok: false, status: 404, message: "Event Order not found." };

  const eventsRepo = await import("@/lib/events/repository");
  const event = await eventsRepo.getEvent(supabase, venue.id, eventOrder.eventId);
  if (!event) return { ok: false, status: 404, message: "Event not found." };

  const clientsRepo = await import("@/lib/clients/repository");
  const availabilityRepo = await import("@/lib/availability/repository");
  const { clientDisplayName } = await import("@/lib/clients/constants");
  const [client, spaces] = await Promise.all([
    event.clientId ? clientsRepo.getClient(supabase, venue.id, event.clientId) : Promise.resolve(null),
    availabilityRepo.getSpaces(supabase, venue.id),
  ]);

  const { generateEventOrderPdf } = await import("@/lib/event-orders/pdf");
  const buffer = await generateEventOrderPdf(full, venue, {
    eventName: event.name,
    eventDate: event.eventDate,
    guestCount: event.guestCount,
    spaceName: spaces.find((s) => s.id === event.spaceId)?.name ?? null,
    clientName: client ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) : null,
    statusNote: eventOrderPdfNote(eventOrder),
  });
  return { ok: true, bytes: new Uint8Array(buffer), filename: safeFilename(`Event Order — ${event.name}`) };
}

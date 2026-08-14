/**
 * Work Package D5C — the explicit "Share with Client" action. Mirrors
 * lib/contracts/finalize.ts's own orchestration shape exactly: resolves
 * real venue/event/client data, generates the PDF from the exact current,
 * locked ("Finalized") Event Order content, uploads it to private storage,
 * and hands off to lib/event-orders/document-integration.ts for the
 * Document Domain write. Only ever callable on a status='finalized' Event
 * Order — sharing an "Open" or still-being-edited order was explicitly
 * never the intent (Step 17/19 of this phase's own brief).
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";
import { getEvent } from "@/lib/events/service";
import { getClient } from "@/lib/clients/service";
import { getSpaces } from "@/lib/availability/service";
import { shareBlockedWhenNotFinalized } from "@/lib/event-orders/lifecycle-gates";
import { getEventOrder } from "@/lib/event-orders/service";
import * as repo from "@/lib/event-orders/repository";
import * as documentIntegration from "@/lib/event-orders/document-integration";
import { generateEventOrderPdf } from "@/lib/event-orders/pdf";
import { clientDisplayName } from "@/lib/clients/constants";
import type { EventOrderActionResult } from "@/lib/event-orders/types";

const BUCKET = "event-order-representations";

// Same established service-role pattern as lib/contracts/finalize.ts — the
// bucket's own policy grants `authenticated` only `select`; writing the PDF
// bytes requires bypassing RLS.
const getServiceClient = createAdminClient;

/** A plain-text snapshot for the Document Domain version's own `content` field — audit/display only. The real structured truth stays on event_order_lines/sections; this is never read back as a source of truth. */
function renderTextSnapshot(eventOrder: Awaited<ReturnType<typeof getEventOrder>>): string {
  if (!eventOrder) return "";
  const lines: string[] = [`Event Order — revision ${eventOrder.revision}`, ""];
  for (const section of eventOrder.sections) {
    lines.push(section.name);
    for (const l of eventOrder.lines.filter((x) => x.sectionId === section.id)) {
      lines.push(`  ${l.description} × ${l.quantity} — ${l.amount}`);
    }
  }
  for (const l of eventOrder.lines.filter((x) => !x.sectionId)) {
    lines.push(`${l.description} × ${l.quantity} — ${l.amount}`);
  }
  lines.push("", `Total: ${eventOrder.total}`);
  return lines.join("\n");
}

export async function shareEventOrderWithClient(eventOrderId: string, customMessage?: string): Promise<EventOrderActionResult & { url?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const supabase = await createClient();
  const eventOrder = await repo.getEventOrderById(supabase, venue.id, eventOrderId);
  if (!eventOrder) return { ok: false, message: "Event Order not found." };
  const shareBlocked = shareBlockedWhenNotFinalized(eventOrder.status);
  if (shareBlocked) return shareBlocked;

  const full = await getEventOrder(eventOrder.eventId);
  if (!full) return { ok: false, message: "Event Order not found." };

  const event = await getEvent(eventOrder.eventId);
  if (!event) return { ok: false, message: "Event not found." };
  const [client, spaces] = await Promise.all([
    event.clientId ? getClient(event.clientId) : Promise.resolve(null),
    getSpaces(),
  ]);
  const spaceName = spaces.find((s) => s.id === event.spaceId)?.name ?? null;
  const clientName = client ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) : null;

  const pdfBuffer = await generateEventOrderPdf(full, venue, {
    eventName: event.name, eventDate: event.eventDate, guestCount: event.guestCount, spaceName, clientName,
  });

  const storagePath = `${venue.id}/${eventOrderId}/eo-${Date.now()}.pdf`;
  const serviceClient = getServiceClient();
  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false, message: `Could not generate the Event Order PDF: ${uploadError.message}` };

  const { data: { user } } = await supabase.auth.getUser();
  const actor = { type: "venue" as const, id: user?.id ?? venue.id };

  try {
    await documentIntegration.shareEventOrderDocument(
      supabase, eventOrderId, eventOrder.eventId, `Event Order — ${event.name}`, renderTextSnapshot(full), actor,
      { storagePath, storageUrl: null, byteSize: pdfBuffer.byteLength },
    );
  } catch (err) {
    await serviceClient.storage.from(BUCKET).remove([storagePath]);
    throw err;
  }

  const isResend = !!eventOrder.sharedAt;
  await repo.setSharedAt(supabase, venue.id, eventOrderId);
  await repo.insertActivity(supabase, venue.id, eventOrderId, "shared", isResend ? "Updated shared copy" : "Shared with client");

  // Work Package D5E — real gap fix: sharing never actually told the
  // client anything before this (only the PDF/Document Domain write +
  // task automation happened; nothing prompted them to go look). The
  // client only ever reaches the Event Order through their portal (there's
  // no standalone token page the way Contract/Questionnaire have), so the
  // email links there with a deep-link hash straight to the Event Order
  // section — never to a bare Dashboard the client has to search from.
  if (client?.email) {
    try {
      const portalService = await import("@/lib/portal/service");
      const sessions = event.clientId ? await portalService.getPortalSessions(event.clientId) : [];
      let session: Awaited<ReturnType<typeof portalService.createPortalSession>> =
        sessions.find((s) => s.accessLevel !== "financial") ?? sessions[0] ?? null;
      // A client's portal session is normally created the moment they're
      // onboarded (before any of this ever runs) — but sharing must not
      // silently skip the client notification just because that never
      // happened for this particular client. Create the one they'd get
      // anyway, same shape createPortalSession() always produces.
      if (!session && event.clientId) session = await portalService.createPortalSession(event.clientId, null, "couple");
      if (session) {
        const { buildMergeData, mergeContent } = await import("@/lib/message-templates/merge");
        const { sendEmail } = await import("@/lib/email/send");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
        const portalUrl = `${appUrl}/p/${session.accessToken}#event-order`;
        const mergeData = buildMergeData({ venueName: venue.name ?? "Your venue", clientName: clientName ?? "", coordinatorName: venue.name ?? "", eventDate: event.eventDate, eventName: event.name });
        const defaultText = `We've shared your Event Order for ${event.name}. Please review it when you have a chance.`;
        const bodyText = customMessage?.trim() ? mergeContent(customMessage, mergeData) : defaultText;
        await sendEmail({
          to: client.email,
          subject: `${venue.name ?? "Your venue"}: Event Order for ${event.name}`,
          text: [`Hi ${client.firstName},`, "", bodyText, "", portalUrl, "", venue.name ?? ""].join("\n"),
          replyTo: venue.email ?? undefined,
        });
      }
    } catch { /* non-blocking — the share itself already succeeded above */ }
  }

  // Same non-blocking, best-effort pattern D5A's Event Inventory finalize
  // uses — a no-op unless a venue has actually configured a Task with
  // this trigger.
  try {
    const { triggerAutoComplete } = await import("@/lib/playbooks/service");
    await triggerAutoComplete(supabase, venue.id, eventOrder.eventId, "event_order_shared");
  } catch { /* non-blocking */ }

  return { ok: true };
}

/** A fresh, short-lived signed URL — never a stored/public path, same discipline as lib/contracts/finalize.ts getContractPdfUrl. */
export async function getEventOrderPdfUrl(eventOrderId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const supabase = await createClient();
  const documentId = await documentIntegration.getEventOrderDocumentId(supabase, eventOrderId);
  if (!documentId) return { ok: false, message: "This Event Order hasn't been shared yet." };

  const service = (await import("@/lib/document-domain/integration/service")).createDocumentService(supabase);
  const representation = await service.getCurrentRepresentation(documentId);
  if (!representation || !representation.storagePath) return { ok: false, message: "This Event Order hasn't been shared yet." };

  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUrl(representation.storagePath, 300);
  if (error || !data) return { ok: false, message: "Could not generate a download link." };
  return { ok: true, url: data.signedUrl };
}

/**
 * Venue Preview of the couple's Event Order document — built from what Send
 * will freeze (live lines) and the choices the couple will answer (active
 * packet, else the order's template). Same presentation as /order/{token}.
 */
import { proposalBrand } from "@/lib/booking-journey/proposal-view";
import {
  isClientChoicesClientEditable,
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";
import { pickActiveChoices } from "@/lib/client-choices/couple-choice-preview";
import { listClientChoicesForEvent } from "@/lib/client-choices/service";
import {
  defaultAnswersFromEventOrderTemplate,
  selectionDefinitionFromEventOrderTemplate,
} from "@/lib/event-order-templates/selection-definition";
import { getTemplate } from "@/lib/event-order-templates/service";
import type { CoupleDocumentView } from "@/lib/event-orders/couple-document";
import { buildSharePayload } from "@/lib/event-orders/repository";
import { getEventOrder } from "@/lib/event-orders/service";
import { getEvent } from "@/lib/events/service";
import { getCurrentVenue } from "@/lib/venue/service";

export async function buildEventOrderDocumentPreview(eventId: string): Promise<CoupleDocumentView | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const [eventOrder, event, packets] = await Promise.all([
    getEventOrder(eventId),
    getEvent(eventId),
    listClientChoicesForEvent(eventId),
  ]);
  if (!eventOrder) return null;

  let choices: CoupleDocumentView["choices"] = null;
  const active = pickActiveChoices(packets);
  if (active) {
    if (active.status === "draft" || isClientChoicesClientEditable(active.status) || isClientChoicesNeedsVenueReview(active.status)) {
      choices = {
        id: active.id, name: active.name, status: active.status, editable: true,
        definition: active.definition, answers: active.answers ?? {},
      };
    }
  } else if (eventOrder.templateId) {
    const template = await getTemplate(eventOrder.templateId);
    const definition = template ? selectionDefinitionFromEventOrderTemplate(template) : null;
    if (template && definition && definition.groups.length > 0) {
      choices = {
        id: "preview", name: template.name, status: "sent", editable: true,
        definition, answers: defaultAnswersFromEventOrderTemplate(template),
      };
    }
  }

  const payload = buildSharePayload(eventOrder);
  return {
    venueName: venue.name,
    brand: proposalBrand({
      primaryColor: venue.primaryColor,
      secondaryColor: venue.secondaryColor,
      accentColor: venue.accentColor,
      neutralColor: venue.neutralColor,
      logoUrl: venue.logoUrl,
    }),
    eventName: event?.name ?? null,
    eventDate: event?.eventDate ?? null,
    revision: eventOrder.revision,
    sharedAt: eventOrder.sharedAt ?? new Date().toISOString(),
    sections: [...payload.sections].sort((a, b) => a.sortOrder - b.sortOrder),
    lines: [...payload.lines].sort((a, b) => a.sortOrder - b.sortOrder),
    approved: false,
    approvedAt: null,
    approvedName: null,
    updating: false,
    choices,
  };
}

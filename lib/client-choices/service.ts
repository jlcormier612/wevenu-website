/**
 * Client Choices — venue domain service.
 * Submit (client) never touches EO/invoice. Finalize applies to Event Order only;
 * financial consequences use existing invoice drift / payment-plan paths.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { applyChoicesToEventOrder } from "@/lib/client-choices/apply-core";
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import {
  amendBlocked,
  finalizeBlocked,
  requestChangesBlocked,
} from "@/lib/client-choices/lifecycle-gates";
import * as repo from "@/lib/client-choices/repository";
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ClientChoices,
  ClientChoicesActionResult,
  ClientChoicesWithHistory,
  CreateClientChoicesResult,
  FinalizeClientChoicesResult,
  SendClientChoicesRequestResult,
} from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import * as eoTemplatesRepo from "@/lib/event-order-templates/repository";
import {
  defaultAnswersFromEventOrderTemplate,
  pruneAnswersToDefinition,
  selectionDefinitionFromEventOrderTemplate,
  selectionDefinitionNeedsHydration,
} from "@/lib/event-order-templates/selection-definition";
import * as templatesRepo from "@/lib/client-choices-templates/repository";
import { ensureEventOrder } from "@/lib/event-orders/service";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ClientChoicesActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

/**
 * Persist a complete EO-template freeze onto packets that only have sections
 * (or empty groups) — so staff preview and the couple form show the same
 * offering context the venue reviewed. Does not rebuild from a live catalog
 * at render time; writes the freeze once onto the packet.
 */
async function hydrateClientChoicesDefinitionFromEventOrderTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  row: ClientChoices,
): Promise<ClientChoices> {
  if (!row.eventOrderTemplateId) return row;
  if (row.status === "finalized") return row;
  const template = await eoTemplatesRepo.getTemplateWithDetails(
    supabase, venueId, row.eventOrderTemplateId,
  );
  if (!template) return row;
  if (!selectionDefinitionNeedsHydration(row.definition, template)) return row;

  const definition = selectionDefinitionFromEventOrderTemplate(template);
  const answers = pruneAnswersToDefinition(row.answers ?? {}, definition);
  await repo.updateInstance(supabase, venueId, row.id, { definition, answers });
  return { ...row, definition, answers };
}

function definitionFromTemplate(
  template: Awaited<ReturnType<typeof templatesRepo.getTemplateWithDetails>>,
): ChoicesDefinition {
  if (!template) return { sections: [], groups: [], options: [] };
  return {
    sections: template.sections.map((s) => ({
      id: s.id, name: s.name, guidance: s.guidance, sortOrder: s.sortOrder,
    })),
    groups: template.groups.map((g) => ({
      id: g.id,
      sectionId: g.sectionId,
      name: g.name,
      instructions: g.instructions,
      selectionMode: g.selectionMode,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      allowQuantity: g.allowQuantity,
      sortOrder: g.sortOrder,
    })),
    options: template.options.map((o) => ({
      id: o.id,
      groupId: o.groupId,
      offeringId: o.offeringId,
      label: o.label,
      description: o.description,
      isIncluded: o.isIncluded,
      unitPrice: o.isIncluded ? 0 : o.unitPrice,
      // Legacy Choices Template options have no photo column; EO freeze path
      // uses selectionDefinitionFromEventOrderTemplate (imageUrl there).
      imageUrl: null,
      sortOrder: o.sortOrder,
    })),
  };
}

export async function listClientChoicesForEvent(eventId: string): Promise<ClientChoices[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const rows = await repo.listForEvent(supabase, venue.id, eventId);
  const hydrated: ClientChoices[] = [];
  for (const row of rows) {
    hydrated.push(
      await hydrateClientChoicesDefinitionFromEventOrderTemplate(supabase, venue.id, row),
    );
  }
  return hydrated;
}

export async function getClientChoices(id: string): Promise<ClientChoicesWithHistory | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const row = await repo.getWithHistory(supabase, venue.id, id);
  if (!row) return null;
  const hydrated = await hydrateClientChoicesDefinitionFromEventOrderTemplate(
    supabase, venue.id, row,
  );
  return hydrated === row ? row : { ...row, ...hydrated };
}

export async function createClientChoicesFromTemplate(
  eventId: string,
  templateId: string,
  nameOverride?: string,
): Promise<CreateClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const template = await templatesRepo.getTemplateWithDetails(supabase, venueId, templateId);
    if (!template) return { ok: false, message: "Template not found." } as CreateClientChoicesResult;

    const { data: event } = await supabase.from("events")
      .select("id, client_id, name")
      .eq("id", eventId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; client_id: string | null; name: string }>();
    if (!event) return { ok: false, message: "Event not found." } as CreateClientChoicesResult;

    const definition = definitionFromTemplate(template);
    const choicesId = await repo.insertInstance(supabase, venueId, {
      eventId,
      clientId: event.client_id,
      templateId: template.id,
      name: (nameOverride?.trim() || template.name).trim(),
      definition,
    });
    await repo.insertActivity(supabase, venueId, choicesId, "created", `Created from template: ${template.name}`);
    return { ok: true, choicesId } as CreateClientChoicesResult;
  });
  return result as CreateClientChoicesResult;
}

/** Preferred authoring path: freeze an Event Order Template into a selection instance. */
export async function createClientChoicesFromEventOrderTemplate(
  eventId: string,
  eventOrderTemplateId: string,
  nameOverride?: string,
): Promise<CreateClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const template = await eoTemplatesRepo.getTemplateWithDetails(
      supabase, venueId, eventOrderTemplateId,
    );
    if (!template) return { ok: false, message: "Event Order Template not found." } as CreateClientChoicesResult;

    const { data: event } = await supabase.from("events")
      .select("id, client_id, name")
      .eq("id", eventId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; client_id: string | null; name: string }>();
    if (!event) return { ok: false, message: "Event not found." } as CreateClientChoicesResult;

    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const answers = defaultAnswersFromEventOrderTemplate(template);
    const choicesId = await repo.insertInstance(supabase, venueId, {
      eventId,
      clientId: event.client_id,
      templateId: null,
      eventOrderTemplateId: template.id,
      name: (nameOverride?.trim() || template.name).trim(),
      definition,
      answers,
    });
    await repo.insertActivity(
      supabase, venueId, choicesId, "created",
      `Created from Event Order Template: ${template.name}`,
    );
    return { ok: true, choicesId } as CreateClientChoicesResult;
  });
  return result as CreateClientChoicesResult;
}

export async function updateClientChoicesDraft(
  choicesId: string,
  input: { name?: string; definition?: ChoicesDefinition; answers?: ChoicesAnswers },
): Promise<ClientChoicesActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as ClientChoicesActionResult;
    if (row.status !== "draft") {
      return { ok: false, message: "Only a draft can be customized this way." } as ClientChoicesActionResult;
    }
    const patch: Record<string, unknown> = {};
    if (input.name?.trim()) patch.name = input.name.trim();
    if (input.definition) patch.definition = input.definition;
    if (input.answers) patch.answers = input.answers;
    await repo.updateInstance(supabase, venueId, choicesId, patch);
    return { ok: true } as ClientChoicesActionResult;
  });
  return result as ClientChoicesActionResult;
}

export async function sendClientChoices(choicesId: string): Promise<ClientChoicesActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const loaded = await repo.getById(supabase, venueId, choicesId);
    if (!loaded) return { ok: false, message: "Choices not found." } as ClientChoicesActionResult;
    if (loaded.status === "finalized") {
      return { ok: false, message: "Already finalized." } as ClientChoicesActionResult;
    }
    // Freeze the complete offering onto the packet before portal/email so the
    // couple receives the same context the venue reviewed in send-preview.
    const row = await hydrateClientChoicesDefinitionFromEventOrderTemplate(
      supabase, venueId, loaded,
    );
    if (row.status === "draft") {
      await repo.updateInstance(supabase, venueId, choicesId, {
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      await repo.insertActivity(supabase, venueId, choicesId, "sent", "Made available in portal");
    } else if (row.status === "sent" || row.status === "in_progress") {
      await repo.insertActivity(supabase, venueId, choicesId, "resent", "Portal reminder recorded");
    } else {
      return { ok: false, message: "These choices cannot be sent in their current status." } as ClientChoicesActionResult;
    }
    await repo.ensureClientOwnedChoicesTask(
      supabase, venueId, row.eventId, `Complete your choices: ${row.name}`,
    );
    return { ok: true } as ClientChoicesActionResult;
  });
  return result as ClientChoicesActionResult;
}

/**
 * Event Order share — the couple answers choices inside the Event Order
 * document, so the packet the venue previewed must be answerable on the link.
 * Same pick as the venue preview: the active packet, else one frozen from the
 * order's template. No separate selection email — the Event Order email is it.
 */
export async function prepareCoupleChoicesForEventOrderShare(
  eventId: string,
  eventOrderTemplateId: string | null,
): Promise<ClientChoicesActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { pickActiveChoices } = await import("@/lib/client-choices/couple-choice-preview");
    const active = pickActiveChoices(await repo.listForEvent(supabase, venueId, eventId));
    if (active) {
      return active.status === "draft"
        ? sendClientChoices(active.id)
        : ({ ok: true } as ClientChoicesActionResult);
    }
    if (!eventOrderTemplateId) return { ok: true } as ClientChoicesActionResult;
    const template = await eoTemplatesRepo.getTemplateWithDetails(supabase, venueId, eventOrderTemplateId);
    if (!template || selectionDefinitionFromEventOrderTemplate(template).groups.length === 0) {
      return { ok: true } as ClientChoicesActionResult;
    }
    const created = await createClientChoicesFromEventOrderTemplate(eventId, eventOrderTemplateId);
    if (!created.ok) return { ok: false, message: created.message ?? "Could not prepare the couple's choices." } as ClientChoicesActionResult;
    return sendClientChoices(created.choicesId);
  });
  return result as ClientChoicesActionResult;
}

/**
 * P2-C — Make available in portal (sendClientChoices), then submit selection-request email.
 * Email failure does not roll back portal status/task. Never reports email success from portal alone.
 */
export async function sendClientChoicesRequest(
  choicesId: string,
  customMessage?: string | null,
): Promise<SendClientChoicesRequestResult> {
  const portal = await sendClientChoices(choicesId);
  if (!portal.ok) {
    return { ok: false, message: portal.message };
  }

  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) {
      return {
        ok: true as const,
        portalReady: true as const,
        email: {
          submitted: false,
          state: "not_submitted" as const,
          message: "Available in the portal, but the choices record could not be reloaded for email.",
        },
      };
    }

    const { getEvent } = await import("@/lib/events/service");
    const event = await getEvent(row.eventId);
    if (!event?.clientId) {
      await repo.insertActivity(
        supabase, venueId, choicesId, "email_not_submitted",
        "Selection email not submitted — no client on event",
      );
      return {
        ok: true as const,
        portalReady: true as const,
        email: {
          submitted: false,
          state: "not_submitted" as const,
          message:
            "The request is available in the portal, but this event has no client, so the selection email was not sent.",
        },
      };
    }

    const { submitClientChoicesCoupleEmail } = await import("@/lib/client-choices/couple-email");
    const email = await submitClientChoicesCoupleEmail({
      supabase,
      venueId,
      choicesId,
      choicesName: row.name,
      eventId: row.eventId,
      eventName: event.name ?? null,
      clientId: event.clientId,
      customMessage,
    });

    await repo.insertActivity(
      supabase,
      venueId,
      choicesId,
      email.submitted ? "email_submitted" : "email_not_submitted",
      email.submitted
        ? "Selection request email submitted"
        : "Selection request email not submitted",
      email.message,
    );

    return {
      ok: true as const,
      portalReady: true as const,
      email: {
        submitted: email.submitted,
        state: email.state,
        message: email.message,
        recipient: email.recipient,
      },
    };
  });

  return result as SendClientChoicesRequestResult;
}

export async function requestClientChoicesChanges(
  choicesId: string,
  note: string,
): Promise<ClientChoicesActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as ClientChoicesActionResult;
    const blocked = requestChangesBlocked(row.status);
    if (blocked) return blocked;

    await repo.updateInstance(supabase, venueId, choicesId, {
      status: "changes_requested",
      changes_requested_note: note.trim() || null,
      changes_requested_at: new Date().toISOString(),
    });
    await repo.insertActivity(
      supabase, venueId, choicesId, "changes_requested", "Changes requested",
      note.trim() || undefined,
    );
    await repo.ensureClientOwnedChoicesTask(
      supabase, venueId, row.eventId, `Update your choices: ${row.name}`,
    );
    return { ok: true } as ClientChoicesActionResult;
  });
  return result as ClientChoicesActionResult;
}

/**
 * Venue Finalize — applies accepted answers to Event Order.
 * Never writes invoice lines. Returns financialDelta so UI can point at
 * existing invoice / payment-plan review.
 */
export async function finalizeClientChoices(
  choicesId: string,
  opts?: { venueUse?: boolean },
): Promise<FinalizeClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as FinalizeClientChoicesResult;
    const blocked = finalizeBlocked(row.status, opts);
    if (blocked) return blocked as FinalizeClientChoicesResult;

    // Drop stale dependent answers before applying billable lines.
    const answers = reconcileAnswersForDependencies(row.definition, row.answers);
    if (JSON.stringify(answers) !== JSON.stringify(row.answers ?? {})) {
      await repo.updateInstance(supabase, venueId, row.id, { answers });
      row.answers = answers;
    }

    // Defense in depth for venue-Use drafts and any path that finalizes without
    // a prior client submit — same rules as submit_client_choices / portal submit.
    const validated = validateChoicesAnswers(row.definition, answers);
    if (!validated.ok) {
      return {
        ok: false,
        message: validated.message ?? "Selections are incomplete.",
      } as FinalizeClientChoicesResult;
    }

    // Ensure Event Order exists; the shared engine reopens and applies.
    const ensured = await ensureEventOrder(row.eventId);
    if (!ensured.ok) {
      return { ok: false, message: ensured.message ?? "Could not open Event Order." } as FinalizeClientChoicesResult;
    }
    const applied = await applyChoicesToEventOrder(supabase, venueId, row, { submittedBy: "venue" });
    if (!applied.ok) return applied;

    // Client email + portal notification after persist. Failure must not unlock.
    try {
      const { getEvent } = await import("@/lib/events/service");
      const { getClient } = await import("@/lib/clients/service");
      const { getCurrentVenue } = await import("@/lib/venue/service");
      const { notifyClientChoicesFinalized } = await import("@/lib/client-choices/finalize-notify");
      const venue = await getCurrentVenue();
      const event = await getEvent(row.eventId);
      const clientId = row.clientId ?? event?.clientId ?? null;
      if (venue && clientId) {
        const client = await getClient(clientId);
        if (client) {
          await notifyClientChoicesFinalized({
            supabase,
            venueId,
            choicesId: row.id,
            choicesName: row.name,
            eventId: row.eventId,
            eventName: event?.name ?? null,
            clientId,
            clientEmail: client.email,
            clientFirstName: client.firstName,
            venueName: venue.name ?? "Your venue",
            venueEmail: venue.email,
            brand: venue,
          });
        }
      }
    } catch { /* non-blocking — finalized state already persisted */ }

    return applied;
  });
  return result as FinalizeClientChoicesResult;
}

/**
 * Amend a locked agreement: reopen THIS instance as a draft.
 * Prior submissions stay as the audit of what was agreed.
 * appliedLineIds stay so the next finalize replaces those EO lines
 * instead of inserting a second set of charges.
 */
export async function reviseClientChoices(choicesId: string): Promise<CreateClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as CreateClientChoicesResult;
    const blocked = amendBlocked(row.status);
    if (blocked) return blocked as CreateClientChoicesResult;
    await repo.updateInstance(supabase, venueId, row.id, {
      status: "draft",
      sent_at: null,
      opened_at: null,
      submitted_at: null,
      finalized_at: null,
      changes_requested_note: null,
      changes_requested_at: null,
    });
    await repo.insertActivity(
      supabase, venueId, row.id, "amended",
      "Amendment started — send to the client when ready.",
      "The previous finalized submission remains on the history. Event Order lines stay until you finalize again.",
    );
    return { ok: true, choicesId: row.id } as CreateClientChoicesResult;
  });
  return result as CreateClientChoicesResult;
}

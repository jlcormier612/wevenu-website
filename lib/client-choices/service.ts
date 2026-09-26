/**
 * Client Choices — venue domain service.
 * Submit (client) never touches EO/invoice. Finalize applies to Event Order only;
 * financial consequences use existing invoice drift / payment-plan paths.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  financialDeltaFromLines,
  resolveSelectedOptions,
  choicesLineNotes,
} from "@/lib/client-choices/apply-to-event-order";
import {
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
} from "@/lib/client-choices/types";
import * as templatesRepo from "@/lib/client-choices-templates/repository";
import {
  addLineFromOffering,
  addCustomLine,
  ensureEventOrder,
  getEventOrder,
  reopenEventOrder,
  removeLine,
} from "@/lib/event-orders/service";
import { triggerAutoComplete } from "@/lib/playbooks/service";
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
      sortOrder: o.sortOrder,
    })),
  };
}

export async function listClientChoicesForEvent(eventId: string): Promise<ClientChoices[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.listForEvent(await createClient(), venue.id, eventId);
}

export async function getClientChoices(id: string): Promise<ClientChoicesWithHistory | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getWithHistory(await createClient(), venue.id, id);
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
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as ClientChoicesActionResult;
    if (row.status === "finalized") {
      return { ok: false, message: "Already finalized." } as ClientChoicesActionResult;
    }
    if (row.status === "draft") {
      await repo.updateInstance(supabase, venueId, choicesId, {
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      await repo.insertActivity(supabase, venueId, choicesId, "sent", "Sent to client");
    } else if (row.status === "sent" || row.status === "in_progress") {
      await repo.insertActivity(supabase, venueId, choicesId, "resent", "Re-sent reminder to client");
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
): Promise<FinalizeClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as FinalizeClientChoicesResult;
    const blocked = finalizeBlocked(row.status);
    if (blocked) return blocked as FinalizeClientChoicesResult;

    const lines = resolveSelectedOptions(row.definition, row.answers);
    const delta = financialDeltaFromLines(lines);

    // Ensure Event Order exists and is open for mutation.
    const ensured = await ensureEventOrder(row.eventId);
    if (!ensured.ok) {
      return { ok: false, message: ensured.message ?? "Could not open Event Order." } as FinalizeClientChoicesResult;
    }
    let eo = await getEventOrder(row.eventId);
    if (!eo) {
      return { ok: false, message: "Event Order not found." } as FinalizeClientChoicesResult;
    }
    if (eo.status === "finalized") {
      const reopened = await reopenEventOrder(eo.id);
      if (!reopened.ok) {
        return { ok: false, message: reopened.message ?? "Could not reopen Event Order." } as FinalizeClientChoicesResult;
      }
      eo = await getEventOrder(row.eventId);
      if (!eo) {
        return { ok: false, message: "Event Order not found after reopen." } as FinalizeClientChoicesResult;
      }
    }

    // Remove previously applied lines from this Choices instance (revision-safe).
    for (const lineId of row.appliedLineIds) {
      const existing = eo.lines.find((l) => l.id === lineId);
      if (existing) {
        await removeLine(eo.id, lineId, existing.description);
      }
    }
    eo = await getEventOrder(row.eventId);
    if (!eo) {
      return { ok: false, message: "Event Order missing during apply." } as FinalizeClientChoicesResult;
    }

    const appliedIds: string[] = [];
    for (const line of lines) {
      const notes = choicesLineNotes(row.id, line.optionId);
      const qty = String(line.quantity);
      const price = line.unitPrice == null ? "" : String(line.unitPrice);
      if (line.offeringId) {
        const added = await addLineFromOffering(eo.id, {
          offeringId: line.offeringId,
          description: line.description,
          quantity: qty,
          unitPrice: price,
          sectionId: null,
          isIncluded: line.isIncluded,
          notes,
        });
        if (added.ok) appliedIds.push(added.line.id);
      } else {
        const added = await addCustomLine(eo.id, {
          description: line.description,
          quantity: qty,
          unitPrice: price,
          sectionId: null,
          isIncluded: line.isIncluded,
          notes,
        });
        if (added.ok) appliedIds.push(added.line.id);
      }
    }

    const submissionNumber = await repo.nextSubmissionNumber(supabase, row.id);
    await repo.insertSubmission(supabase, venueId, {
      clientChoicesId: row.id,
      eventId: row.eventId,
      submissionNumber,
      outcomeStatus: "finalized",
      snapshot: {
        definition: row.definition,
        answers: row.answers,
        name: row.name,
        appliedLineIds: appliedIds,
        financialDelta: delta,
      },
      submittedBy: "venue",
    });

    await repo.updateInstance(supabase, venueId, row.id, {
      status: "finalized",
      finalized_at: new Date().toISOString(),
      event_order_id: eo.id,
      applied_line_ids: appliedIds,
      finalized_submission_number: submissionNumber,
      changes_requested_note: null,
      changes_requested_at: null,
    });

    await repo.insertActivity(
      supabase, venueId, row.id, "finalized",
      "Finalized — applied to Event Order",
      delta === 0
        ? "No additional cost. Event Order updated operationally."
        : `Additional cost from choices: $${delta.toFixed(2)}. Review Invoice / payment plan if needed.`,
    );

    await triggerAutoComplete(
      supabase, venueId, row.eventId, "client_choices_finalized", "client_choices", row.id,
    );

    return {
      ok: true,
      eventOrderId: eo.id,
      financialDelta: delta,
      appliedLineIds: appliedIds,
    } as FinalizeClientChoicesResult;
  });
  return result as FinalizeClientChoicesResult;
}

/**
 * Start a post-finalize revision cycle: new draft-like working state from
 * the finalized definition, preserving all prior submissions.
 */
export async function reviseClientChoices(choicesId: string): Promise<CreateClientChoicesResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await repo.getById(supabase, venueId, choicesId);
    if (!row) return { ok: false, message: "Choices not found." } as CreateClientChoicesResult;
    if (row.status !== "finalized") {
      return { ok: false, message: "Only a finalized Choices can be revised this way." } as CreateClientChoicesResult;
    }
    const newId = await repo.insertInstance(supabase, venueId, {
      eventId: row.eventId,
      clientId: row.clientId,
      templateId: row.templateId,
      name: `${row.name} (revision)`,
      definition: row.definition,
    });
    await repo.updateInstance(supabase, venueId, newId, { answers: row.answers });
    await repo.insertActivity(
      supabase, venueId, newId, "created",
      `Revision started from finalized choices ${row.id}`,
    );
    return { ok: true, choicesId: newId } as CreateClientChoicesResult;
  });
  return result as CreateClientChoicesResult;
}

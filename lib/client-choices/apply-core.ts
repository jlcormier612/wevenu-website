/**
 * The one engine that applies a choices packet to its Event Order.
 * Shared by venue Finalize (staff session) and the couple's Approve on
 * /order/{token} (token-scoped service client). Never writes invoice lines.
 */
import {
  choicesLineNotes,
  conflictingSingleSelectLineIds,
  duplicateMultiSelectLineIds,
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import * as repo from "@/lib/client-choices/repository";
import type { ClientChoices, FinalizeClientChoicesResult } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import { matchChoiceGroupsToSections } from "@/lib/event-orders/document-view";
import * as eoRepo from "@/lib/event-orders/repository";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import { triggerAutoComplete } from "@/lib/playbooks/service";

type DbClient = Parameters<typeof repo.getById>[0];

/** EO section id for each choice group, matched by section name. */
function sectionIdByGroup(row: ClientChoices, eo: EventOrderWithDetails): Map<string, string> {
  const sectionNameById = new Map(row.definition.sections.map((s) => [s.id, s.name]));
  const groups = row.definition.groups.map((g) => ({
    groupId: g.id,
    name: g.name,
    sectionName: g.sectionId ? sectionNameById.get(g.sectionId) ?? null : null,
  }));
  const { bySectionId } = matchChoiceGroupsToSections(groups, eo.sections);
  const out = new Map<string, string>();
  for (const [sectionId, matched] of bySectionId) {
    for (const g of matched) out.set(g.groupId, sectionId);
  }
  return out;
}

export async function applyChoicesToEventOrder(
  supabase: DbClient,
  venueId: string,
  row: ClientChoices,
  opts: { submittedBy: "client" | "venue" },
): Promise<FinalizeClientChoicesResult> {
  const validated = validateChoicesAnswers(row.definition, row.answers);
  if (!validated.ok) {
    return { ok: false, message: validated.message ?? "Selections are incomplete." };
  }

  const lines = resolveSelectedOptions(row.definition, row.answers);
  const delta = financialDeltaFromLines(lines);

  let eo = await eoRepo.getEventOrderByEvent(supabase, venueId, row.eventId);
  if (!eo) return { ok: false, message: "Event Order not found." };
  if (eo.status === "finalized") {
    await eoRepo.reopenEventOrder(supabase, venueId, eo.id);
    await eoRepo.insertActivity(
      supabase, venueId, eo.id, "reopened",
      `Reopened for changes — was v${eo.revision}`,
      eo.sharedAt ? "Clients still see the last shared version until you share again." : undefined,
    );
    eo = await eoRepo.getEventOrderByEvent(supabase, venueId, row.eventId);
    if (!eo) return { ok: false, message: "Event Order not found after reopen." };
  }
  const eventOrderId = eo.id;

  async function removeLine(lineId: string) {
    const existing = eo!.lines.find((l) => l.id === lineId);
    if (!existing) return;
    await eoRepo.removeLine(supabase, venueId, lineId);
    await eoRepo.insertActivity(supabase, venueId, eventOrderId, "line_removed", `Removed: ${existing.description}`);
  }

  // Remove previously applied lines from this Choices instance (revision-safe).
  for (const lineId of row.appliedLineIds) await removeLine(lineId);

  // Required pick-one: clear any EO lines matching that group's option labels
  // so legacy package dinners are not left beside the newly selected option.
  const conflictIds = conflictingSingleSelectLineIds({
    definition: row.definition,
    answers: row.answers,
    eventOrderLines: eo.lines.map((l) => ({ id: l.id, description: l.description })),
    alreadyRemovingIds: row.appliedLineIds,
  });
  for (const lineId of conflictIds) await removeLine(lineId);

  const duplicateIds = duplicateMultiSelectLineIds({
    definition: row.definition,
    answers: row.answers,
    eventOrderLines: eo.lines.map((l) => ({ id: l.id, description: l.description, sectionId: l.sectionId })),
    sectionIdByGroup: sectionIdByGroup(row, eo),
    alreadyRemovingIds: [...row.appliedLineIds, ...conflictIds],
  });
  for (const lineId of duplicateIds) await removeLine(lineId);

  eo = await eoRepo.getEventOrderByEvent(supabase, venueId, row.eventId);
  if (!eo) return { ok: false, message: "Event Order missing during apply." };
  const sectionFor = sectionIdByGroup(row, eo);

  const appliedIds: string[] = [];
  for (const line of lines) {
    const sortOrder = await eoRepo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const common = {
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: line.unitPrice == null ? "" : String(line.unitPrice),
      sectionId: sectionFor.get(line.groupId) ?? null,
      isIncluded: line.isIncluded,
      notes: choicesLineNotes(row.id, line.optionId),
    };
    if (line.offeringId) {
      const added = await eoRepo.insertLineFromOffering(
        supabase, venueId, eventOrderId, { ...common, offeringId: line.offeringId }, sortOrder,
      );
      await eoRepo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Added offering: ${line.description.trim()}`);
      appliedIds.push(added.id);
    } else {
      const added = await eoRepo.insertCustomLine(supabase, venueId, eventOrderId, common, sortOrder);
      await eoRepo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Custom line added: ${line.description.trim()}`);
      appliedIds.push(added.id);
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
    submittedBy: opts.submittedBy,
  });

  await repo.updateInstance(supabase, venueId, row.id, {
    status: "finalized",
    finalized_at: new Date().toISOString(),
    event_order_id: eventOrderId,
    applied_line_ids: appliedIds,
    finalized_submission_number: submissionNumber,
    changes_requested_note: null,
    changes_requested_at: null,
  });

  await repo.insertActivity(
    supabase, venueId, row.id, "finalized",
    opts.submittedBy === "client"
      ? "Approved by the couple — applied to Event Order"
      : "Finalized — applied to Event Order",
    delta === 0
      ? "No additional cost. Event Order updated operationally."
      : `Additional cost from choices: $${delta.toFixed(2)}. Review Invoice / payment plan if needed.`,
  );

  await triggerAutoComplete(
    supabase, venueId, row.eventId, "client_choices_finalized", "client_choices", row.id,
  );

  return { ok: true, eventOrderId, financialDelta: delta, appliedLineIds: appliedIds };
}

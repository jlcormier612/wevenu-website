import { createClient } from "@/integrations/supabase/server";
import * as commercialSelectionsRepo from "@/lib/commercial-selections/repository";
import { isSupabaseConfigured } from "@/lib/env";
import {
  finalizeBlockedWhenAlreadyFinalized,
  mutationBlockedWhenFinalized,
  reopenBlockedWhenNotFinalized,
} from "@/lib/event-orders/lifecycle-gates";
import * as repo from "@/lib/event-orders/repository";
import * as floorPlansRepo from "@/lib/floor-plans/repository";
import {
  filterPackageInclusionsToSeed,
  packageSelectionNotes,
  resolveSelectionInclusions,
  seededInclusionQuantity,
  type PackageInclusionSeedItem,
} from "@/lib/event-orders/seed-package-inclusions";
import * as proposalsRepo from "@/lib/commercial-proposals/repository";
import {
  applyQuantityForLine,
  canApplyTemplateToEventOrder,
  normalizeTemplatePricingModel,
  packageStartingSelections,
  snapshotTemplateOfferingForEvent,
  type TemplateApplySelection,
} from "@/lib/event-order-templates/offerings";
import { ensureStarterCommercialStructure } from "@/lib/event-order-templates/provision";
import * as templatesRepo from "@/lib/event-order-templates/repository";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddOfferingLineInput,
  AddSectionResult, EnsureEventOrderResult, EventOrderActionResult, EventOrderWithDetails,
  UpdateLineInput,
} from "@/lib/event-orders/types";
import { boundHeadcountForApply } from "@/lib/events/headcount";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | EventOrderActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

async function assertOpen(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, eventOrderId: string,
): Promise<EventOrderActionResult | null> {
  const order = await repo.getEventOrderById(supabase, venueId, eventOrderId);
  if (!order) return { ok: false, message: "Event Order not found." };
  return mutationBlockedWhenFinalized(order.status);
}

function validateQty(quantity: string): EventOrderActionResult | null {
  const qty = Number(quantity);
  if (!(qty > 0)) return { ok: false, errors: { quantity: "Enter a valid quantity." } };
  return null;
}

/** Empty price is allowed (unpriced). Non-empty must be a valid >= 0 number. */
function validateOptionalPrice(unitPrice: string): EventOrderActionResult | null {
  const cleaned = unitPrice.replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const price = Number(cleaned);
  if (isNaN(price) || price < 0) return { ok: false, errors: { unitPrice: "Enter a valid price, or leave blank." } };
  return null;
}

export async function getEventOrder(eventId: string): Promise<EventOrderWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getEventOrderByEvent(supabase, venue.id, eventId);
}

export async function getEventOrderForClient(clientId: string): Promise<EventOrderWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getEventOrderByClient(await createClient(), venue.id, clientId);
}

async function loadTemplateReadyForApply(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  templateId: string,
): Promise<EventOrderTemplateWithDetails | null> {
  await ensureStarterCommercialStructure(supabase, venueId, templateId);
  return templatesRepo.getTemplateWithDetails(supabase, venueId, templateId);
}

function lineDedupeKey(description: string, sectionId: string | null): string {
  return `${sectionId ?? ""}::${description.trim().toLowerCase()}`;
}

/**
 * Transfer booking-spine Selected Package inclusion text onto an open, unshared
 * Event Order as included custom lines. Dedupes by description against existing
 * lines (including template copies). Does not add the package fee or invent Offerings.
 */
async function seedBookingPackageInclusions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  eventOrderId: string,
): Promise<number> {
  const details = await repo.getEventOrderByEvent(supabase, venueId, eventId);
  if (!details || details.id !== eventOrderId) return 0;
  if (details.status !== "open" || details.sharedAt) return 0;

  let selection = await commercialSelectionsRepo.getActiveSelectionForEvent(
    supabase, venueId, eventId,
  );
  if (!selection) {
    const { data: eventRow } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", eventId)
      .eq("venue_id", venueId)
      .maybeSingle<{ client_id: string | null }>();
    if (eventRow?.client_id) {
      selection = await commercialSelectionsRepo.getActiveSelectionForClient(
        supabase, venueId, eventRow.client_id,
      );
    }
  }
  if (!selection) return 0;

  let chosenOptions: { includedItems: PackageInclusionSeedItem[] }[] | null = null;
  if (selection.proposalId) {
    const proposal = await proposalsRepo.getProposal(supabase, venueId, selection.proposalId);
    if (proposal) {
      const chosen = new Set(proposal.choices.map((c) => c.optionId));
      chosenOptions = proposal.options.filter((o) => chosen.has(o.id));
    }
  }
  const inclusions = resolveSelectionInclusions(selection, chosenOptions);
  if (inclusions.length === 0) return 0;

  const toAdd = filterPackageInclusionsToSeed(
    inclusions,
    details.lines.map((l) => l.description),
  );
  if (toAdd.length === 0) return 0;

  const linkedIds = [...new Set(toAdd.map((i) => i.offeringId).filter((id): id is string => !!id))];
  const offeringsById = new Map<string, { inventoryItemId: string | null }>();
  if (linkedIds.length > 0) {
    const { data: offeringRows } = await supabase
      .from("offerings")
      .select("id, inventory_item_id")
      .eq("venue_id", venueId)
      .in("id", linkedIds);
    for (const row of (offeringRows ?? []) as { id: string; inventory_item_id: string | null }[]) {
      offeringsById.set(row.id, { inventoryItemId: row.inventory_item_id });
    }
  }

  const notes = packageSelectionNotes(selection.id, selection.name);
  const guestCount = toAdd.some((i) => i.perGuest)
    ? await loadEventOrderGuestCount(supabase, venueId, eventOrderId)
    : null;
  let lineSort = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
  let asOfferings = 0;
  for (const item of toAdd) {
    const input = {
      description: item.description,
      quantity: String(seededInclusionQuantity(item, guestCount)),
      unitPrice: "",
      sectionId: null,
      unit: item.unit ?? undefined,
      isIncluded: true,
      notes,
      boundToHeadcount: item.perGuest === true,
    };
    const offering = item.offeringId ? offeringsById.get(item.offeringId) : undefined;
    if (item.offeringId && offering) {
      await repo.insertLineFromOffering(supabase, venueId, eventOrderId, {
        ...input,
        offeringId: item.offeringId,
        inventoryItemId: offering.inventoryItemId,
      }, lineSort++);
      asOfferings += 1;
    } else {
      await repo.insertCustomLine(supabase, venueId, eventOrderId, input, lineSort++);
    }
  }
  await repo.insertActivity(
    supabase,
    venueId,
    eventOrderId,
    "line_added",
    `Imported ${toAdd.length} package inclusion${toAdd.length === 1 ? "" : "s"} from selected package: ${selection.name}`,
    asOfferings > 0
      ? `Seeded from booking Selected Package as included lines (${asOfferings} linked to catalog offerings). Not a package fee.`
      : "Seeded from booking Selected Package. Included custom lines — not Offerings or a package fee.",
  );
  return toAdd.length;
}

async function loadEventOrderGuestCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventOrderId: string,
): Promise<number | null> {
  const { data: order } = await supabase
    .from("event_orders")
    .select("event_id, client_id")
    .eq("id", eventOrderId)
    .eq("venue_id", venueId)
    .maybeSingle<{ event_id: string | null; client_id: string | null }>();
  if (!order) return null;
  if (order.event_id) {
    const { data } = await supabase
      .from("events")
      .select("guest_count, guaranteed_guest_count")
      .eq("id", order.event_id)
      .eq("venue_id", venueId)
      .maybeSingle<{ guest_count: number | null; guaranteed_guest_count: number | null }>();
    const bound = boundHeadcountForApply(data?.guest_count, data?.guaranteed_guest_count);
    return bound != null && bound > 0 ? bound : null;
  }
  if (order.client_id) {
    // Clients have Estimated only (no Guaranteed column).
    const { data } = await supabase
      .from("clients")
      .select("guest_count")
      .eq("id", order.client_id)
      .eq("venue_id", venueId)
      .maybeSingle<{ guest_count: number | null }>();
    const count = Number(data?.guest_count ?? 0);
    return count > 0 ? count : null;
  }
  return null;
}

async function copyTemplateSnapshotsIntoOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventOrderId: string,
  template: EventOrderTemplateWithDetails,
  selections: TemplateApplySelection[] | undefined,
  existing: EventOrderWithDetails | null,
): Promise<number> {
  const sectionIdMap = new Map<string, string>();
  const existingByName = new Map((existing?.sections ?? []).map((s) => [s.name, s.id]));
  let sectionSort = existing?.sections.length ?? 0;
  for (const s of [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const already = existingByName.get(s.name);
    if (already) {
      sectionIdMap.set(s.id, already);
      continue;
    }
    const created = await repo.insertSection(supabase, venueId, eventOrderId, s.name, sectionSort++, {
      floorPlanSetupName: s.floorPlanSetupName, notOnFloorPlan: s.notOnFloorPlan,
    });
    sectionIdMap.set(s.id, created.id);
    existingByName.set(s.name, created.id);
  }

  // Setup / inherit materializes the full package. Explicit Apply-sheet selections
  // still win when provided. Optionals keep isIncluded=false via snapshot.
  const resolved = selections
    ?? packageStartingSelections(template.lines, await loadEventOrderGuestCount(supabase, venueId, eventOrderId));
  const selected = new Map(resolved.map((s) => [s.lineId, s]));
  const existingKeys = new Set(
    (existing?.lines ?? []).map((l) => lineDedupeKey(l.description, l.sectionId)),
  );
  let copied = 0;
  let lineSort = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
  for (const line of [...template.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const choice = selected.get(line.id);
    if (!choice?.selected) continue;
    const eventSectionId = line.sectionId ? sectionIdMap.get(line.sectionId) ?? null : null;
    const key = lineDedupeKey(line.description, eventSectionId);
    if (existingKeys.has(key)) continue;
    const snapshot = snapshotTemplateOfferingForEvent(line, applyQuantityForLine(line, resolved));
    const input = {
      description: snapshot.description,
      descriptionDetail: snapshot.descriptionDetail ?? undefined,
      quantity: snapshot.quantity,
      unitPrice: snapshot.unitPrice,
      sectionId: eventSectionId,
      unit: snapshot.unit ?? undefined,
      isIncluded: snapshot.isIncluded,
      notes: snapshot.notes ?? undefined,
      boundToHeadcount: normalizeTemplatePricingModel(line.pricingModel) === "per_person",
    };
    if (snapshot.offeringId) {
      await repo.insertLineFromOffering(supabase, venueId, eventOrderId, {
        ...input,
        offeringId: snapshot.offeringId,
      }, lineSort++);
    } else {
      await repo.insertCustomLine(supabase, venueId, eventOrderId, input, lineSort++);
    }
    existingKeys.add(key);
    copied += 1;
  }
  return copied;
}

/**
 * Creates an Event Order. When templateId is set, copies sections and
 * selected offering snapshots. Does not create an invoice or change
 * proposal/contract/payment state. Existing Event Orders are not replaced.
 */
export async function ensureEventOrder(
  eventId: string,
  templateId: string | null = null,
  selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getEventOrderByEvent(supabase, venueId, eventId);
    if (existing) {
      // Heal empty or incomplete shells (e.g. only includedByDefault lines after
      // delivery-starter repair). Dedupe keeps custom event lines intact.
      const healTemplateId = templateId ?? existing.templateId;
      if (
        healTemplateId
        && existing.status === "open"
        && !existing.sharedAt
      ) {
        const template = await loadTemplateReadyForApply(supabase, venueId, healTemplateId);
        if (template && template.lines.length > existing.lines.length) {
          const copied = await copyTemplateSnapshotsIntoOrder(
            supabase,
            venueId,
            existing.id,
            template,
            selections,
            existing,
          );
          if (copied > 0) {
            await repo.insertActivity(
              supabase, venueId, existing.id, "template_applied",
              `Filled Event Order from package: ${template.name}`,
              "Recovered missing package offerings for this event. Not an invoice or share.",
            );
          }
        }
      }
      // Package inclusions seed even when no template heal is needed.
      if (existing.status === "open" && !existing.sharedAt) {
        await seedBookingPackageInclusions(supabase, venueId, eventId, existing.id);
      }
      return { ok: true, eventOrderId: existing.id } as EnsureEventOrderResult;
    }
    const eventOrderId = await repo.insertEventOrder(supabase, venueId, eventId, templateId);

    const template = templateId ? await loadTemplateReadyForApply(supabase, venueId, templateId) : null;
    if (template) {
      await copyTemplateSnapshotsIntoOrder(supabase, venueId, eventOrderId, template, selections, null);
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", `Event Order started from template: ${template.name}`);
    } else {
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", "Event Order started");
    }
    await seedBookingPackageInclusions(supabase, venueId, eventId, eventOrderId);
    return { ok: true, eventOrderId } as EnsureEventOrderResult;
  });
  return result as EnsureEventOrderResult;
}

export async function ensureEventOrderForClient(
  clientId: string,
  templateId: string | null = null,
  selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getEventOrderByClient(supabase, venueId, clientId);
    if (existing) return { ok: true, eventOrderId: existing.id } as EnsureEventOrderResult;
    const eventOrderId = await repo.insertEventOrderForClient(supabase, venueId, clientId, templateId);
    const template = templateId ? await loadTemplateReadyForApply(supabase, venueId, templateId) : null;
    if (template) {
      await copyTemplateSnapshotsIntoOrder(supabase, venueId, eventOrderId, template, selections, null);
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", `Event Order started from template: ${template.name}`);
    } else {
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", "Event Order started");
    }
    return { ok: true, eventOrderId } as EnsureEventOrderResult;
  });
  return result as EnsureEventOrderResult;
}

/**
 * Apply a template to an existing open Event Order. Refuses finalized orders.
 * Adds missing sections and selected snapshot lines. Does not wipe existing
 * lines, create invoices, or alter proposal/contract/payment state.
 */
export async function applyTemplateToEventOrder(
  eventOrderId: string,
  templateId: string,
  selections?: TemplateApplySelection[],
): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const header = await repo.getEventOrderById(supabase, venueId, eventOrderId);
    if (!header) return { ok: false, message: "Event Order not found." } as EventOrderActionResult;
    if (!canApplyTemplateToEventOrder(header.status)) {
      return { ok: false, message: "This Event Order is finalized — reopen it to make changes." } as EventOrderActionResult;
    }
    const template = await loadTemplateReadyForApply(supabase, venueId, templateId);
    if (!template) return { ok: false, message: "Template not found." } as EventOrderActionResult;
    const details = await repo.getEventOrderByEvent(supabase, venueId, header.eventId);
    const copied = await copyTemplateSnapshotsIntoOrder(
      supabase, venueId, eventOrderId, template, selections, details,
    );
    // Couple choices come from the order's starting template. Until the couple has
    // seen anything, an applied template with choices becomes that source.
    let choicesSource = false;
    if (header.templateId !== template.id && !header.sharedAt) {
      const { selectionDefinitionFromEventOrderTemplate } = await import(
        "@/lib/event-order-templates/selection-definition"
      );
      if (selectionDefinitionFromEventOrderTemplate(template).groups.length > 0) {
        const choicesRepo = await import("@/lib/client-choices/repository");
        const packets = await choicesRepo.listForEvent(supabase, venueId, header.eventId);
        if (packets.length === 0) {
          await repo.setEventOrderTemplateId(supabase, venueId, eventOrderId, template.id);
          choicesSource = true;
        }
      }
    }
    await repo.insertActivity(
      supabase, venueId, eventOrderId, "template_applied",
      `Applied template: ${template.name}`,
      [
        copied > 0
          ? "Copied template structure into this Event Order. This is not an invoice or contract."
          : "Copied template sections. No offerings were selected.",
        choicesSource ? `The couple's choices now come from ${template.name}.` : null,
      ].filter(Boolean).join(" "),
    );
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

/**
 * Create an Event Order from a template, or merge selected snapshots into an
 * existing open Event Order. Refuses finalized orders. Does not create invoices
 * or change proposal/contract/payment state.
 */
export async function startOrApplyEventOrderTemplate(
  eventId: string,
  templateId: string,
  selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const existing = await getEventOrder(eventId);
  if (!existing) {
    return ensureEventOrder(eventId, templateId, selections);
  }
  const applied = await applyTemplateToEventOrder(existing.id, templateId, selections);
  if (!applied.ok) {
    return { ok: false, message: applied.message ?? "Could not apply this template." };
  }
  return { ok: true, eventOrderId: existing.id };
}

/**
 * Overview setup editor — replace this event's open Event Order contents from a
 * Library Event Order template. Clears existing sections/lines then copies defaults.
 * Refuses finalized or previously shared orders. Does not invoice, share, or
 * mutate the Library. Prefer this over merge-apply when switching starting template.
 */
export async function replaceEventOrderFromTemplate(
  eventId: string,
  templateId: string,
): Promise<EnsureEventOrderResult | EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const template = await loadTemplateReadyForApply(supabase, venueId, templateId);
    if (!template || template.isArchived) {
      return { ok: false, message: "Select an active Event Order template." } as EventOrderActionResult;
    }
    let existing = await repo.getEventOrderByEvent(supabase, venueId, eventId);
    if (!existing) {
      const eventOrderId = await repo.insertEventOrder(supabase, venueId, eventId, templateId);
      await copyTemplateSnapshotsIntoOrder(
        supabase, venueId, eventOrderId, template, undefined, null,
      );
      await repo.insertActivity(
        supabase, venueId, eventOrderId, "started",
        `Event Order started from template: ${template.name}`,
      );
      await seedBookingPackageInclusions(supabase, venueId, eventId, eventOrderId);
      return { ok: true, eventOrderId } as EnsureEventOrderResult;
    }
    if (existing.status !== "open") {
      return {
        ok: false,
        message: "This Event Order is finalized. Reopen it in the Event Order workspace before switching templates.",
      } as EventOrderActionResult;
    }
    if (existing.sharedAt) {
      return {
        ok: false,
        message: "This Event Order was already shared with the client. Template switch from setup is blocked — use the Event Order workspace so the shared snapshot stays intentional.",
      } as EventOrderActionResult;
    }
    await repo.clearEventOrderContents(supabase, venueId, existing.id);
    await repo.setEventOrderTemplateId(supabase, venueId, existing.id, templateId);
    const copied = await copyTemplateSnapshotsIntoOrder(
      supabase, venueId, existing.id, template, undefined, null,
    );
    await repo.insertActivity(
      supabase, venueId, existing.id, "template_replaced",
      `Replaced starting Event Order template with: ${template.name}`,
      copied > 0
        ? "Event Order contents were replaced for this event. Not an invoice, contract, or share."
        : "Template sections applied. No default offerings were selected on the template.",
    );
    await seedBookingPackageInclusions(supabase, venueId, eventId, existing.id);
    return { ok: true, eventOrderId: existing.id } as EnsureEventOrderResult;
  });
  return result as EnsureEventOrderResult | EventOrderActionResult;
}

export async function finalizeEventOrder(eventOrderId: string): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const order = await repo.getEventOrderById(supabase, venueId, eventOrderId);
    if (!order) return { ok: false, message: "Event Order not found." } as EventOrderActionResult;
    const blocked = finalizeBlockedWhenAlreadyFinalized(order.status);
    if (blocked) return blocked;
    await repo.finalizeEventOrder(supabase, venueId, eventOrderId, order.revision + 1);
    await repo.insertActivity(supabase, venueId, eventOrderId, "finalized", `Finalized — v${order.revision + 1}`);
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

export async function reopenEventOrder(eventOrderId: string): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const order = await repo.getEventOrderById(supabase, venueId, eventOrderId);
    if (!order) return { ok: false, message: "Event Order not found." } as EventOrderActionResult;
    const blocked = reopenBlockedWhenNotFinalized(order.status);
    if (blocked) return blocked;
    await repo.reopenEventOrder(supabase, venueId, eventOrderId);
    await repo.insertActivity(
      supabase, venueId, eventOrderId, "reopened",
      `Reopened for changes — was v${order.revision}`,
      order.sharedAt
        ? "Clients still see the last shared version until you share again."
        : undefined,
    );
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

export async function addSection(eventOrderId: string, name: string): Promise<AddSectionResult> {
  if (!name.trim()) return { ok: false, message: "Give this section a name." };
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddSectionResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_sections", eventOrderId);
    const section = await repo.insertSection(supabase, venueId, eventOrderId, name, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "section_added", `Section added: ${section.name}`);
    return { ok: true, section } as AddSectionResult;
  });
  return result as AddSectionResult;
}

export async function setSectionFloorPlan(
  eventOrderId: string, sectionId: string, floorPlanId: string | null,
): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard;
    await repo.updateSectionFloorPlan(supabase, venueId, sectionId, floorPlanId);
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

/**
 * Which floor plan setup a section is compared with: "auto" (template name,
 * then section name), "none" (not on a floor plan), or a setup id on the
 * same event. Comparison only — allowed after sending; never changes lines.
 */
export async function setSectionFloorPlanSetup(
  eventOrderId: string, sectionId: string, choice: "auto" | "none" | { setupId: string },
): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const header = await repo.getEventOrderById(supabase, venueId, eventOrderId);
    if (!header) return { ok: false, message: "Event Order not found." } as EventOrderActionResult;
    let setupId: string | null = null;
    if (typeof choice === "object") {
      if (!header.eventId) return { ok: false, message: "This Event Order has no event yet." } as EventOrderActionResult;
      const setups = await floorPlansRepo.listEventFloorPlanSetups(supabase, venueId, header.eventId);
      if (!setups.some((s) => s.id === choice.setupId)) {
        return { ok: false, message: "That setup isn't on this event." } as EventOrderActionResult;
      }
      setupId = choice.setupId;
    }
    await repo.updateSectionFloorPlanSetup(supabase, venueId, eventOrderId, sectionId, {
      floorPlanSetupId: setupId,
      notOnFloorPlan: choice === "none",
    });
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

export async function removeSection(eventOrderId: string, sectionId: string, sectionName: string): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard;
    await repo.removeSection(supabase, venueId, sectionId);
    await repo.insertActivity(supabase, venueId, eventOrderId, "section_removed", `Section removed: ${sectionName}`, "Its lines were kept, now unsectioned.");
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

/** Legacy / advanced: bundled package fee line — not the primary Add path. */
export async function addLineFromPackage(eventOrderId: string, packageId: string, packageName: string, basePrice: number, sectionId: string | null): Promise<AddLineResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const line = await repo.insertLineFromPackage(supabase, venueId, eventOrderId, {
      packageId, description: packageName, unitPrice: basePrice, sectionId,
    }, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Added package fee: ${packageName}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

export async function addLineFromOffering(eventOrderId: string, input: AddOfferingLineInput): Promise<AddLineResult> {
  if (!input.description.trim()) return { ok: false, message: "Description is required." };
  const qtyErr = validateQty(input.quantity);
  if (qtyErr) return qtyErr as AddLineResult;
  const priceErr = validateOptionalPrice(input.unitPrice);
  if (priceErr) return priceErr as AddLineResult;
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const line = await repo.insertLineFromOffering(supabase, venueId, eventOrderId, input, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Added offering: ${input.description.trim()}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

export async function addLineFromInventory(eventOrderId: string, input: AddInventoryLineInput): Promise<AddLineResult> {
  if (!input.description.trim()) return { ok: false, message: "Description is required." };
  const qtyErr = validateQty(input.quantity);
  if (qtyErr) return qtyErr as AddLineResult;
  const priceErr = validateOptionalPrice(input.unitPrice);
  if (priceErr) return priceErr as AddLineResult;
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const line = await repo.insertLineFromInventory(supabase, venueId, eventOrderId, input, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Added from inventory: ${input.description.trim()}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

export async function addCustomLine(eventOrderId: string, input: AddCustomLineInput): Promise<AddLineResult> {
  if (!input.description.trim()) return { ok: false, errors: { description: "Description is required." } };
  const qtyErr = validateQty(input.quantity);
  if (qtyErr) return qtyErr as AddLineResult;
  const priceErr = validateOptionalPrice(input.unitPrice);
  if (priceErr) return priceErr as AddLineResult;
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const line = await repo.insertCustomLine(supabase, venueId, eventOrderId, input, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Custom line added: ${input.description.trim()}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

/** Explicit import of text-only package_items as Included custom snapshot lines. */
export async function importPackageInclusions(
  eventOrderId: string,
  items: { description: string; quantity: number; unit: string | null }[],
  sectionId: string | null,
): Promise<AddLineResult | EventOrderActionResult & { addedCount?: number }> {
  if (items.length === 0) return { ok: false, message: "Select at least one inclusion." };
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard;
    let added = 0;
    let lastLine = null as Awaited<ReturnType<typeof repo.insertCustomLine>> | null;
    for (const item of items) {
      if (!item.description.trim()) continue;
      const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
      lastLine = await repo.insertCustomLine(supabase, venueId, eventOrderId, {
        description: item.description.trim(),
        quantity: String(item.quantity || 1),
        unitPrice: "",
        sectionId,
        unit: item.unit ?? undefined,
        isIncluded: true,
      }, sortOrder);
      added++;
    }
    if (added === 0) return { ok: false, message: "No inclusions could be imported." } as EventOrderActionResult;
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Imported ${added} package inclusion${added === 1 ? "" : "s"}`);
    return { ok: true, line: lastLine!, addedCount: added } as AddLineResult & { addedCount: number };
  });
  return result as AddLineResult & { addedCount?: number };
}

export async function updateLine(eventOrderId: string, lineId: string, input: UpdateLineInput): Promise<AddLineResult> {
  if (!input.description.trim()) return { ok: false, errors: { description: "Description is required." } };
  const qtyErr = validateQty(input.quantity);
  if (qtyErr) return qtyErr as AddLineResult;
  const priceErr = validateOptionalPrice(input.unitPrice);
  if (priceErr) return priceErr as AddLineResult;
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const line = await repo.updateLine(supabase, venueId, lineId, input);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_updated", `Updated: ${input.description.trim()}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

export async function removeLine(eventOrderId: string, lineId: string, lineDescription: string): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard;
    await repo.removeLine(supabase, venueId, lineId);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_removed", `Removed: ${lineDescription}`);
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

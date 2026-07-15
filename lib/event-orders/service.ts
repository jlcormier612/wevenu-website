import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/event-orders/repository";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddSectionResult,
  EnsureEventOrderResult, EventOrderActionResult, EventOrderWithDetails,
} from "@/lib/event-orders/types";
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

/**
 * The one guard every mutation in this file goes through: a Finalized Event
 * Order is locked (docs/booking-financial-architecture-event-order-model.md
 * §1) — it takes an explicit reopen to edit again, the same posture this
 * codebase already applies to a signed Contract.
 */
async function assertOpen(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, eventOrderId: string,
): Promise<EventOrderActionResult | null> {
  const order = await repo.getEventOrderById(supabase, venueId, eventOrderId);
  if (!order) return { ok: false, message: "Event Order not found." };
  if (order.status === "finalized") {
    return { ok: false, message: "This Event Order is finalized — reopen it to make changes." };
  }
  return null;
}

// ---- read -----------------------------------------------------------------------

export async function getEventOrder(eventId: string): Promise<EventOrderWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getEventOrderByEvent(supabase, venue.id, eventId);
}

// ---- lifecycle --------------------------------------------------------------------

export async function ensureEventOrder(eventId: string): Promise<EnsureEventOrderResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getEventOrderByEvent(supabase, venueId, eventId);
    if (existing) return { ok: true, eventOrderId: existing.id } as EnsureEventOrderResult;
    const eventOrderId = await repo.insertEventOrder(supabase, venueId, eventId);
    await repo.insertActivity(supabase, venueId, eventOrderId, "started", "Event Order started");
    return { ok: true, eventOrderId } as EnsureEventOrderResult;
  });
  return result as EnsureEventOrderResult;
}

export async function finalizeEventOrder(eventOrderId: string): Promise<EventOrderActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const order = await repo.getEventOrderById(supabase, venueId, eventOrderId);
    if (!order) return { ok: false, message: "Event Order not found." } as EventOrderActionResult;
    if (order.status === "finalized") return { ok: false, message: "Already finalized." } as EventOrderActionResult;
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
    if (order.status !== "finalized") return { ok: false, message: "This Event Order isn't finalized." } as EventOrderActionResult;
    await repo.reopenEventOrder(supabase, venueId, eventOrderId);
    await repo.insertActivity(supabase, venueId, eventOrderId, "reopened", `Reopened for changes — was v${order.revision}`);
    return { ok: true } as EventOrderActionResult;
  });
  return result as EventOrderActionResult;
}

// ---- sections -----------------------------------------------------------------------

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

/**
 * Phase 4 — links (or clears, when floorPlanId is null) this Section's
 * Floor Plan for reconciliation. A structural authoring change like any
 * other Section edit, so it follows the same assertOpen guard as the rest
 * of this file — an Event Order's linked-Floor-Plan structure doesn't
 * silently change once finalized, same as its Sections and Lines don't.
 * Never touches the Floor Plan itself, only which one this Section points
 * at — see docs/booking-financial-architecture-phase4-floor-plan-design.md §6.
 */
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

// ---- lines --------------------------------------------------------------------------

export async function addLineFromPackage(eventOrderId: string, packageId: string, packageName: string, basePrice: number, sectionId: string | null): Promise<AddLineResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertOpen(supabase, venueId, eventOrderId);
    if (guard) return guard as AddLineResult;
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_lines", eventOrderId);
    const line = await repo.insertLineFromPackage(supabase, venueId, eventOrderId, {
      packageId, description: packageName, unitPrice: basePrice, sectionId,
    }, sortOrder);
    await repo.insertActivity(supabase, venueId, eventOrderId, "line_added", `Added from package: ${packageName}`);
    return { ok: true, line } as AddLineResult;
  });
  return result as AddLineResult;
}

export async function addLineFromInventory(eventOrderId: string, input: AddInventoryLineInput): Promise<AddLineResult> {
  if (!input.description.trim()) return { ok: false, message: "Description is required." };
  const qty = Number(input.quantity);
  if (!(qty > 0)) return { ok: false, errors: { quantity: "Enter a valid quantity." } };
  const price = Number(input.unitPrice.replace(/[$,]/g, ""));
  if (isNaN(price) || price < 0) return { ok: false, errors: { unitPrice: "Enter a valid price." } };
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
  const qty = Number(input.quantity);
  if (!(qty > 0)) return { ok: false, errors: { quantity: "Enter a valid quantity." } };
  const price = Number(input.unitPrice.replace(/[$,]/g, ""));
  if (isNaN(price) || price < 0) return { ok: false, errors: { unitPrice: "Enter a valid price." } };
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

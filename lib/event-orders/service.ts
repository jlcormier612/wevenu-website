import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  finalizeBlockedWhenAlreadyFinalized,
  mutationBlockedWhenFinalized,
  reopenBlockedWhenNotFinalized,
} from "@/lib/event-orders/lifecycle-gates";
import * as repo from "@/lib/event-orders/repository";
import * as templatesRepo from "@/lib/event-order-templates/repository";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddOfferingLineInput,
  AddSectionResult, EnsureEventOrderResult, EventOrderActionResult, EventOrderWithDetails,
  UpdateLineInput,
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

/**
 * Creates an Event Order. When templateId is set, copies section structure only
 * (delivery sections) — not checklist/process template lines.
 */
export async function ensureEventOrder(eventId: string, templateId: string | null = null): Promise<EnsureEventOrderResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getEventOrderByEvent(supabase, venueId, eventId);
    if (existing) return { ok: true, eventOrderId: existing.id } as EnsureEventOrderResult;
    const eventOrderId = await repo.insertEventOrder(supabase, venueId, eventId, templateId);

    const template = templateId ? await templatesRepo.getTemplateWithDetails(supabase, venueId, templateId) : null;
    if (template) {
      let sectionSort = 0;
      for (const s of [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
        await repo.insertSection(supabase, venueId, eventOrderId, s.name, sectionSort++);
      }
      // Intentionally do not copy template lines — templates are delivery
      // structure only (locked product model). Legacy checklist lines stay
      // on the template for archive/history but are not applied to live EOs.
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", `Event Order started from template: ${template.name}`);
    } else {
      await repo.insertActivity(supabase, venueId, eventOrderId, "started", "Event Order started");
    }
    return { ok: true, eventOrderId } as EnsureEventOrderResult;
  });
  return result as EnsureEventOrderResult;
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

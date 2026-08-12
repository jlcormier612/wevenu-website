import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/event-inventory/repository";
import type {
  AddItemResult, AddTemplateItemResult, AddToEventOrderResult, CreateTemplateResult, EnsureEventInventoryResult,
  EventInventoryActionResult, EventInventoryWithDetails, InventoryItemInput, InventoryTemplateWithItems,
} from "@/lib/event-inventory/types";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | EventInventoryActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

/** The one guard every item-level mutation goes through — mirrors Event Order's assertOpen() exactly, same "explicit reopen to edit again" posture. Also backed by a real DB trigger (20261248000000) — this is the friendly error, the trigger is the actual backstop. */
async function assertNotFinalized(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, eventInventoryId: string,
): Promise<EventInventoryActionResult | null> {
  const inv = await repo.getEventInventoryById(supabase, venueId, eventInventoryId);
  if (!inv) return { ok: false, message: "Event Inventory not found." };
  if (inv.status === "finalized") {
    return { ok: false, message: "This Event Inventory is finalized — reopen it to make changes.", reason: "finalized" };
  }
  return null;
}

// ---- read -----------------------------------------------------------------------

export async function getEventInventory(eventId: string): Promise<EventInventoryWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getEventInventoryByEvent(supabase, venue.id, eventId);
}

// ---- lifecycle --------------------------------------------------------------------

export async function ensureEventInventory(eventId: string, templateId: string | null = null): Promise<EnsureEventInventoryResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getEventInventoryByEvent(supabase, venueId, eventId);
    if (existing) return { ok: true, eventInventoryId: existing.id } as EnsureEventInventoryResult;
    const eventInventoryId = await repo.insertEventInventory(supabase, venueId, eventId, templateId);
    if (templateId) {
      const template = await repo.getTemplate(supabase, venueId, templateId);
      if (template) {
        await repo.applyTemplateItems(supabase, venueId, eventInventoryId, template.items);
        await repo.insertActivity(supabase, venueId, eventInventoryId, "created", `Created from template: ${template.name}`);
      }
    } else {
      await repo.insertActivity(supabase, venueId, eventInventoryId, "created", "Event Inventory started");
    }
    return { ok: true, eventInventoryId } as EnsureEventInventoryResult;
  });
  return result as EnsureEventInventoryResult;
}

export async function shareEventInventory(eventInventoryId: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const inv = await repo.getEventInventoryById(supabase, venueId, eventInventoryId);
    if (!inv) return { ok: false, message: "Event Inventory not found." } as EventInventoryActionResult;
    await repo.setStatus(supabase, venueId, eventInventoryId, "shared");
    await repo.insertActivity(supabase, venueId, eventInventoryId, "shared", "Shared with client — visible in their portal (read-only)");
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

export async function finalizeEventInventory(eventInventoryId: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const inv = await repo.getEventInventoryById(supabase, venueId, eventInventoryId);
    if (!inv) return { ok: false, message: "Event Inventory not found." } as EventInventoryActionResult;
    if (inv.status === "finalized") return { ok: false, message: "Already finalized." } as EventInventoryActionResult;
    await repo.setStatus(supabase, venueId, eventInventoryId, "finalized");
    await repo.insertActivity(supabase, venueId, eventInventoryId, "finalized", "Event Inventory finalized — agreed values are now locked");
    // Same non-blocking, best-effort pattern questionnaire submission uses
    // (app/(app)/events/[id]/questionnaire-actions.ts) — a no-op unless a
    // venue has actually configured a Task with this trigger.
    try {
      const { triggerAutoComplete } = await import("@/lib/playbooks/service");
      await triggerAutoComplete(supabase, venueId, inv.eventId, "inventory_finalized");
    } catch { /* non-blocking */ }
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

/**
 * Financial handoff (D5 brief §17-19) — "Inventory provides the applicable
 * commercial input. The financial domain creates/owns the actual financial
 * obligation." Deliberately not automatic on finalize — this is its own
 * explicit venue action, matching the brief's "Add to Payment Plan"
 * framing. Reuses Event Order's existing, unmodified addLineFromInventory/
 * addCustomLine functions — no second financial engine, no new provenance
 * value, no direct Inventory→Invoice or Inventory→Payment Plan link
 * invented. Only priced items are ever pushed (an item included at no
 * extra charge has nothing to bill); everything downstream (Event Order →
 * Invoice freeze → Payment Schedule) already exists and is untouched.
 */
export async function addToEventOrder(eventInventoryId: string, eventId: string): Promise<AddToEventOrderResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const inv = await repo.getEventInventoryByEvent(supabase, venue.id, eventId);
  if (!inv || inv.id !== eventInventoryId) return { ok: false, message: "Event Inventory not found." };
  if (inv.status !== "finalized") {
    return { ok: false, message: "Finalize the Event Inventory before adding it to the Event Order." };
  }
  // D8 — filters out items already pushed by a prior call, closing two real
  // bugs at once: (1) no server-side guard previously existed against
  // re-adding the same item twice (a double-click/retry/second tab would
  // have duplicated every billable line's financial impact), and (2) the
  // old all-time "has this Event Inventory ever been pushed" flag
  // permanently hid the action after first use, blocking items added on a
  // later Reopen from ever reaching the Event Order. Both are fixed by
  // tracking eligibility per item instead of once for the whole Inventory.
  const billable = inv.items.filter((i) => i.unitPrice != null && i.unitPrice > 0 && !i.addedToEventOrderAt);
  if (billable.length === 0) {
    const anyBillable = inv.items.some((i) => i.unitPrice != null && i.unitPrice > 0);
    return {
      ok: false,
      message: anyBillable
        ? "Everything billable here has already been added to the Event Order."
        : "Nothing to add — every item here is included at no extra charge.",
    };
  }

  const { ensureEventOrder, addLineFromInventory, addCustomLine, getEventOrder } = await import("@/lib/event-orders/service");
  const existingOrder = await getEventOrder(eventId);
  if (existingOrder?.status === "finalized") {
    return { ok: false, message: "The Event Order is finalized — reopen it before adding these items." };
  }
  const ensured = await ensureEventOrder(eventId);
  if (!ensured.ok) return { ok: false, message: ensured.message };

  let added = 0;
  let addedTotal = 0;
  const addedItemIds: string[] = [];
  for (const item of billable) {
    const lineResult = item.inventoryItemId
      ? await addLineFromInventory(ensured.eventOrderId, {
          inventoryItemId: item.inventoryItemId, description: item.name,
          quantity: String(item.quantity), unitPrice: String(item.unitPrice), sectionId: null,
        })
      : await addCustomLine(ensured.eventOrderId, {
          description: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice), sectionId: null,
        });
    if (lineResult.ok) {
      added++;
      addedTotal += item.quantity * (item.unitPrice ?? 0);
      addedItemIds.push(item.id);
    }
  }

  if (added === 0) return { ok: false, message: "Could not add items to the Event Order." };
  await repo.markAddedToEventOrder(supabase, venue.id, addedItemIds);
  await repo.insertActivity(supabase, venue.id, eventInventoryId, "added_to_event_order", `${added} item${added !== 1 ? "s" : ""} added to Event Order`);
  return { ok: true, addedCount: added, addedTotal };
}

export async function reopenEventInventory(eventInventoryId: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const inv = await repo.getEventInventoryById(supabase, venueId, eventInventoryId);
    if (!inv) return { ok: false, message: "Event Inventory not found." } as EventInventoryActionResult;
    if (inv.status !== "finalized") return { ok: false, message: "This Event Inventory isn't finalized." } as EventInventoryActionResult;
    await repo.setStatus(supabase, venueId, eventInventoryId, "draft");
    await repo.insertActivity(supabase, venueId, eventInventoryId, "reopened", "Reopened for changes");
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

// ---- items --------------------------------------------------------------------------

export async function addItem(eventInventoryId: string, input: InventoryItemInput): Promise<AddItemResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Item name is required." } };
  const qty = Number(input.quantity);
  if (!(qty > 0)) return { ok: false, errors: { quantity: "Enter a valid quantity." } };
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertNotFinalized(supabase, venueId, eventInventoryId);
    if (guard) return guard as AddItemResult;
    const sortOrder = await repo.nextItemSortOrder(supabase, eventInventoryId);
    const item = await repo.insertItem(supabase, venueId, eventInventoryId, input, sortOrder);
    await repo.insertActivity(supabase, venueId, eventInventoryId, "item_added", `Added: ${item.name}${item.quantity !== 1 ? ` (×${item.quantity})` : ""}`);
    return { ok: true, item } as AddItemResult;
  });
  return result as AddItemResult;
}

export async function updateItem(
  eventInventoryId: string, itemId: string, input: InventoryItemInput, expectedUpdatedAt: string,
): Promise<EventInventoryActionResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Item name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertNotFinalized(supabase, venueId, eventInventoryId);
    if (guard) return guard;
    const outcome = await repo.updateItem(supabase, venueId, itemId, input, expectedUpdatedAt);
    if (!outcome.ok) {
      return {
        ok: false, reason: outcome.reason,
        message: outcome.reason === "stale"
          ? "Someone else updated this item first. Review the latest version before saving."
          : "Item not found.",
      } as EventInventoryActionResult;
    }
    await repo.insertActivity(supabase, venueId, eventInventoryId, "item_changed", `Updated: ${input.name.trim()}`);
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

export async function removeItem(eventInventoryId: string, itemId: string, itemName: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const guard = await assertNotFinalized(supabase, venueId, eventInventoryId);
    if (guard) return guard;
    await repo.removeItem(supabase, venueId, itemId);
    await repo.insertActivity(supabase, venueId, eventInventoryId, "item_removed", `Removed: ${itemName}`);
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

// ---- templates (Library layer, D5 brief §9/§10) ------------------------------------

export async function getTemplates(includeArchived = false) {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id, includeArchived);
}

export async function getTemplate(id: string): Promise<InventoryTemplateWithItems | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function createTemplate(name: string, description: string): Promise<CreateTemplateResult> {
  if (!name.trim()) return { ok: false, errors: { name: "Name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, name, description);
    return { ok: true, templateId } as CreateTemplateResult;
  });
  return result as CreateTemplateResult;
}

export async function setTemplateArchived(id: string, isArchived: boolean): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTemplateArchived(supabase, venueId, id, isArchived);
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

export async function addTemplateItem(templateId: string, input: InventoryItemInput): Promise<AddTemplateItemResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Item name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextTemplateItemSortOrder(supabase, templateId);
    const item = await repo.insertTemplateItem(supabase, venueId, templateId, input, sortOrder);
    return { ok: true, item } as AddTemplateItemResult;
  });
  return result as AddTemplateItemResult;
}

export async function removeTemplateItem(itemId: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeTemplateItem(supabase, venueId, itemId);
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

/**
 * Delete restricted to Owner/Manager — same permission shape as Contract
 * delete (D4) and Payment line item delete.
 *
 * Release Readiness Reconciliation remediation: `inventory_templates_delete_gate`
 * is the RLS backstop for the role check above, but a RESTRICTIVE policy
 * blocks a disallowed delete by matching zero rows, not by raising an
 * error — this previously only checked `error`, so a direct-API call
 * bypassing this function's own role check would have silently no-op'd
 * while still reporting `{ ok: true }`. `.select("id")` surfaces which row
 * actually matched, same fix shape already shipped for
 * contracts/payments/invoices/timeline/floor plans.
 */
export async function deleteTemplate(id: string): Promise<EventInventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can delete a template." } as EventInventoryActionResult;
    }
    const { data, error } = await supabase.from("inventory_templates").delete().eq("id", id).eq("venue_id", venueId).select("id");
    if (error) return { ok: false, message: error.message } as EventInventoryActionResult;
    if (!data || data.length === 0) {
      return { ok: false, message: "Only an Owner or Manager can delete a template." } as EventInventoryActionResult;
    }
    return { ok: true } as EventInventoryActionResult;
  });
  return result as EventInventoryActionResult;
}

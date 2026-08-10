/**
 * Event Inventory — Work Package D5.
 *
 * The Working Item that D3 confirmed did not exist: "what is being used/
 * selected for this event," distinct from the venue-wide Master Catalog
 * (`lib/inventory/*`, untouched by this domain). Belongs to exactly one
 * Event (never a Client — mirrors Event Order's own "Event is the atomic
 * unit" decision, same reasoning: a Client with two Events gets two
 * independent Event Inventories). See docs/operational-documents-financial-
 * workflow-implementation.md for the full architecture.
 */

export type EventInventoryStatus = "draft" | "shared" | "finalized";

export type EventInventory = {
  id: string;
  venueId: string;
  eventId: string;
  templateId: string | null;
  status: EventInventoryStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventInventoryItem = {
  id: string;
  eventInventoryId: string;
  venueId: string;
  /** Provenance only — a snapshot, never a live reference (D5 brief §7). Null for a fully custom item. */
  inventoryItemId: string | null;
  name: string;
  category: string | null;
  quantity: number;
  /** Null = included at no extra charge; the Master Catalog has no price field at all today (confirmed), so this is always directly entered, never looked up. */
  unitPrice: number | null;
  isIncluded: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventInventoryActivity = {
  id: string;
  eventInventoryId: string;
  venueId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type EventInventoryWithDetails = EventInventory & {
  items: EventInventoryItem[];
  activities: EventInventoryActivity[];
};

export type InventoryTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTemplateItem = {
  id: string;
  templateId: string;
  venueId: string;
  inventoryItemId: string | null;
  name: string;
  category: string | null;
  quantity: number;
  unitPrice: number | null;
  isIncluded: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTemplateWithItems = InventoryTemplate & { items: InventoryTemplateItem[] };

export type InventoryItemInput = {
  inventoryItemId?: string | null;
  name: string;
  category?: string;
  quantity: string;
  unitPrice?: string;
  isIncluded: boolean;
  notes?: string;
};

export type EventInventoryErrors = Record<string, string>;

export type EventInventoryActionResult =
  | { ok: true }
  /** reason:"stale" mirrors D4's Contract concurrency check exactly (lib/contracts/repository.ts) — see §38 of the D5 brief. */
  | { ok: false; errors?: EventInventoryErrors; message?: string; reason?: "stale" | "finalized" | "not_found" };

export type EnsureEventInventoryResult =
  | { ok: true; eventInventoryId: string }
  | { ok: false; message: string };

export type AddItemResult =
  | { ok: true; item: EventInventoryItem }
  | { ok: false; errors?: EventInventoryErrors; message?: string };

export type AddTemplateItemResult =
  | { ok: true; item: InventoryTemplateItem }
  | { ok: false; errors?: EventInventoryErrors; message?: string };

export type CreateTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; errors?: EventInventoryErrors; message?: string };

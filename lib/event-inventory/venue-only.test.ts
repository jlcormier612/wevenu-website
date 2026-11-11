/**
 * R2 / U3 — Venue-only inventory items. Visibility (client_visible) is separate
 * from the commercial relationship (is_included). Venue-only rows stay in venue
 * reads and operational counts but never reach the couple, the Event Order
 * handoff, or an invoice.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { groupInventoryByCoupleBand, inventoryCoupleBand } from "@/lib/event-inventory/couple-bands";
import {
  eventInventoryItemsPendingForEventOrder,
  inventoryHandoffBillableTotal,
  isInventoryItemBillableForInvoice,
  isVenueOnlyInventoryItem,
} from "@/lib/event-inventory/handoff";
import * as repo from "@/lib/event-inventory/repository";
import type { InventoryTemplateItem } from "@/lib/event-inventory/types";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const migration = read("supabase/migrations/20261426300000_inventory_items_client_visible.sql");
const service = read("lib/event-inventory/service.ts");

type Call = { table: string; ops: Array<[string, unknown[]]> };

/** Records every PostgREST builder call; responder decides what each awaited chain resolves to. */
function fakeClient(responder: (call: Call) => { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const op of ["insert", "update", "select", "eq", "in", "order", "limit", "single", "maybeSingle", "delete"]) {
        chain[op] = (...args: unknown[]) => { call.ops.push([op, args]); return chain; };
      }
      chain.then = (resolveFn: (v: unknown) => unknown, rejectFn: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, ...responder(call) }).then(resolveFn, rejectFn);
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

const payload = (call: Call, op: "insert" | "update") => call.ops.find(([o]) => o === op)?.[1][0];

const itemRow = (over: Record<string, unknown> = {}) => ({
  id: "ei-1", event_inventory_id: "inv-1", venue_id: "v-1", inventory_item_id: null,
  name: "Staff tables", category: null, image_url: null, quantity: 4, unit_price: null,
  is_included: true, notes: null, sort_order: 0, client_selectable: false, max_quantity: null,
  client_draft_quantity: null, client_submitted_quantity: null, added_to_event_order_at: null,
  created_at: "2026-10-29T00:00:00Z", updated_at: "2026-10-29T00:00:00Z", ...over,
});

const templateItem = (over: Partial<InventoryTemplateItem>): InventoryTemplateItem => ({
  id: "ti-1", templateId: "t-1", venueId: "v-1", inventoryItemId: null, name: "Chairs", category: null,
  quantity: 100, unitPrice: null, isIncluded: true, clientVisible: true, notes: null, sortOrder: 0,
  createdAt: "", updatedAt: "", ...over,
});

describe("venue-only — handoff and invoice eligibility", () => {
  const visibleExtra = { id: "bar", isIncluded: false, unitPrice: 600, quantity: 1, addedToEventOrderAt: null };
  const visibleIncluded = { id: "chairs", isIncluded: true, unitPrice: 0, quantity: 150, addedToEventOrderAt: null };
  // Template-originated venue-only row (copied from a template marked Venue only).
  const templateVenueOnly = { id: "riser", isIncluded: true, unitPrice: null, quantity: 2, addedToEventOrderAt: null, clientVisible: false };
  // Event-specific venue-only row that would otherwise be a billable extra.
  const eventVenueOnlyPriced = { id: "staff-mic", isIncluded: false, unitPrice: 250, quantity: 3, addedToEventOrderAt: null, clientVisible: false };

  it("handoff skips venue-only rows (template-originated and event-specific)", () => {
    const pending = eventInventoryItemsPendingForEventOrder([visibleIncluded, templateVenueOnly, visibleExtra, eventVenueOnlyPriced]);
    assert.deepEqual(pending.map((i) => i.id), ["chairs", "bar"]);
  });

  it("venue-only rows are never billable, even when priced and not included", () => {
    assert.equal(isVenueOnlyInventoryItem(eventVenueOnlyPriced), true);
    assert.equal(isInventoryItemBillableForInvoice(eventVenueOnlyPriced), false);
    assert.equal(isInventoryItemBillableForInvoice(templateVenueOnly), false);
    assert.equal(inventoryHandoffBillableTotal([visibleExtra, eventVenueOnlyPriced]), 600);
  });

  it("visible behavior unchanged — missing or true clientVisible behaves exactly as before", () => {
    const legacy = [visibleIncluded, visibleExtra];
    const explicit = legacy.map((i) => ({ ...i, clientVisible: true }));
    assert.deepEqual(eventInventoryItemsPendingForEventOrder(legacy).map((i) => i.id), ["chairs", "bar"]);
    assert.deepEqual(eventInventoryItemsPendingForEventOrder(explicit).map((i) => i.id), ["chairs", "bar"]);
    assert.equal(isInventoryItemBillableForInvoice(visibleExtra), true);
    assert.equal(isInventoryItemBillableForInvoice(visibleIncluded), false);
    assert.equal(inventoryHandoffBillableTotal(explicit), 600);
  });

  it("addToEventOrder only creates lines from the filtered pending list", () => {
    assert.match(service, /const pending = eventInventoryItemsPendingForEventOrder\(inv\.items\);/);
    assert.match(service, /for \(const item of pending\)/);
    assert.match(service, /Only venue-only items remain — they stay off the Event Order\./);
  });
});

describe("venue-only — venue bands keep Included separate from visibility", () => {
  it("venue-only wins over Included / Select; Included still describes the row", () => {
    assert.equal(inventoryCoupleBand({ isIncluded: true, clientVisible: false, quantity: 2 }), "venue_only");
    assert.equal(inventoryCoupleBand({ isIncluded: false, clientVisible: false, quantity: 2 }), "venue_only");
    assert.equal(inventoryCoupleBand({ isIncluded: true, clientVisible: true, quantity: 2 }), "included");
    assert.equal(inventoryCoupleBand({ isIncluded: false, clientVisible: true, clientSelectable: true, quantity: 2 }), "couple_can_choose");
  });

  it("venue-only rows stay in the venue list (operational count unchanged)", () => {
    const rows = [
      { id: "a", isIncluded: true, quantity: 120 },
      { id: "b", isIncluded: true, clientVisible: false, quantity: 4 },
    ];
    const groups = groupInventoryByCoupleBand(rows);
    assert.equal(groups.flatMap((g) => g.rows).length, 2);
    assert.equal(groups.flatMap((g) => g.rows).reduce((s, r) => s + r.quantity, 0), 124);
  });
});

describe("venue-only — repository persistence", () => {
  it("event item insert defaults to visible and maps legacy rows as visible", async () => {
    const { client, calls } = fakeClient(() => ({ data: itemRow({ client_visible: undefined }) }));
    const item = await repo.insertItem(client, "v-1", "inv-1", { name: "Chairs", quantity: "10", isIncluded: true }, 0);
    assert.equal((payload(calls[0]!, "insert") as Record<string, unknown>).client_visible, true);
    assert.equal(item.clientVisible, true);
  });

  it("event-specific item can be created venue-only", async () => {
    const { client, calls } = fakeClient(() => ({ data: itemRow({ client_visible: false }) }));
    const item = await repo.insertItem(client, "v-1", "inv-1", { name: "Staff mic", quantity: "3", isIncluded: false, clientVisible: false }, 0);
    assert.equal((payload(calls[0]!, "insert") as Record<string, unknown>).client_visible, false);
    assert.equal(item.clientVisible, false);
  });

  it("event item update manages the setting, and leaves it untouched when omitted", async () => {
    const respond = (call: Call) => (call.ops.some(([o]) => o === "maybeSingle") ? { data: { id: "ei-1" } } : { data: [{ id: "ei-1" }] });
    const hide = fakeClient(respond);
    assert.deepEqual(
      await repo.updateItem(hide.client, "v-1", "ei-1", { name: "Riser", quantity: "2", isIncluded: true, clientVisible: false }, "t0"),
      { ok: true },
    );
    assert.equal((payload(hide.calls[1]!, "update") as Record<string, unknown>).client_visible, false);

    const keep = fakeClient(respond);
    await repo.updateItem(keep.client, "v-1", "ei-1", { name: "Riser", quantity: "2", isIncluded: true }, "t0");
    assert.equal("client_visible" in (payload(keep.calls[1]!, "update") as Record<string, unknown>), false);
  });

  it("template item can be marked venue-only (insert + update)", async () => {
    const ins = fakeClient(() => ({ data: { ...itemRow(), template_id: "t-1", client_visible: false } }));
    const created = await repo.insertTemplateItem(ins.client, "v-1", "t-1", { name: "Riser", quantity: "2", isIncluded: true, clientVisible: false }, 0);
    assert.equal((payload(ins.calls[0]!, "insert") as Record<string, unknown>).client_visible, false);
    assert.equal(created.clientVisible, false);

    const def = fakeClient(() => ({ data: { ...itemRow(), template_id: "t-1" } }));
    await repo.insertTemplateItem(def.client, "v-1", "t-1", { name: "Chairs", quantity: "2", isIncluded: true }, 0);
    assert.equal((payload(def.calls[0]!, "insert") as Record<string, unknown>).client_visible, true);

    const upd = fakeClient((call) => (call.ops.some(([o]) => o === "maybeSingle") ? { data: { id: "ti-1" } } : { data: [{ id: "ti-1" }] }));
    await repo.updateTemplateItem(upd.client, "v-1", "ti-1", { name: "Riser", quantity: "2", isIncluded: true, clientVisible: false }, "t0");
    assert.equal((payload(upd.calls[1]!, "update") as Record<string, unknown>).client_visible, false);
  });

  it("template apply preserves the setting on every copied row", async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await repo.applyTemplateItems(client, "v-1", "inv-1", [
      templateItem({ id: "a", name: "Chairs", clientVisible: true }),
      templateItem({ id: "b", name: "Staff tables", clientVisible: false }),
    ]);
    const inserted = payload(calls.find((c) => c.table === "event_inventory_items")!, "insert") as Array<Record<string, unknown>>;
    assert.deepEqual(inserted.map((r) => [r.name, r.client_visible]), [["Chairs", true], ["Staff tables", false]]);
  });
});

describe("venue-only — data-access boundaries (migration contract)", () => {
  it("both tables get client_visible boolean not null default true", () => {
    assert.match(migration, /alter table public\.inventory_template_items\s+add column if not exists client_visible boolean not null default true;/);
    assert.match(migration, /alter table public\.event_inventory_items\s+add column if not exists client_visible boolean not null default true;/);
    assert.doesNotMatch(migration, /set\s+client_visible/);
  });

  it("portal read excludes venue-only rows at the join; save treats them as missing", () => {
    assert.match(migration, /left join public\.event_inventory_items eii\s+on eii\.event_inventory_id = ei\.id\s+and eii\.client_visible/);
    assert.match(migration, /and venue_id = v_session\.venue_id\s+and client_visible;\s+if v_item\.id is null then\s+return jsonb_build_object\('ok', false, 'message', 'Item not found\.'\);/);
  });

  it("venue-only rows can never be couple-selectable (submit only freezes selectable rows)", () => {
    assert.match(migration, /check \(client_visible or not client_selectable\)/);
    assert.match(service, /if \(clientSelectable && !item\.clientVisible\)/);
  });

  it("finalized immutability covers visibility", () => {
    assert.match(migration, /and new\.client_visible is not distinct from old\.client_visible/);
  });

  it("RLS unchanged — venue policies are not touched", () => {
    assert.doesNotMatch(migration, /\bpolicy\b/i);
  });

  it("couple-facing routes read event inventory only through the portal RPC", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) files.push(p);
      }
    };
    for (const dir of ["app/api/portal", "components/portal", "lib/portal"]) walk(resolve(dir));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      assert.doesNotMatch(src, /from\("event_inventory_items"\)|lib\/event-inventory\/(repository|service)"/, f);
    }
  });
});

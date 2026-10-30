import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  eventsCompete,
  reservationState,
  stockForEvent,
  stockLeftForEvent,
  stockSentence,
  stockWindow,
  upcomingForItem,
  upcomingRowSentence,
  type StockEvent,
  type StockSharingSettings,
} from "@/lib/inventory/reservations";
import { catalogLimitLabel } from "@/lib/portal/floor-plan-catalog-limit";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const sameDay: StockSharingSettings = { mode: "same_day", turnaroundMinutes: 180 };
const byTime: StockSharingSettings = { mode: "by_time", turnaroundMinutes: 180 };

const ev = (id: string, over: Partial<StockEvent>): StockEvent => ({
  id, name: id, date: "2056-06-12", state: "reserved", quantities: {}, ...over,
});
const shower = ev("shower", { startTime: "10:00", endTime: "13:00", quantities: { chair: 60 } });
const wedding = ev("wedding", { startTime: "17:00", endTime: "23:00", quantities: { chair: 100 } });
const brunch = ev("brunch", { startTime: "12:00", endTime: "15:30", quantities: { chair: 50 } });
const chair = { id: "chair", name: "Chiavari Chair", quantityAvailable: 120 };

describe("which events compete for stock", () => {
  it("same_day: any two events on the same date compete; different dates don't", () => {
    assert.equal(eventsCompete(shower, wedding, sameDay), true);
    assert.equal(eventsCompete(shower, ev("next", { date: "2056-06-13" }), sameDay), false);
  });

  it("by_time: a morning shower and an evening wedding share when the gap covers turnaround", () => {
    assert.equal(eventsCompete(shower, wedding, byTime), false, "13:00 → 17:00 is 4h ≥ 3h");
    assert.equal(eventsCompete(brunch, wedding, byTime), true, "15:30 → 17:00 is 1.5h < 3h");
    assert.equal(eventsCompete(brunch, wedding, { mode: "by_time", turnaroundMinutes: 60 }), false);
  });

  it("by_time: setup/teardown widen the window; missing times mean all day; overnight ends roll over", () => {
    assert.equal(eventsCompete({ ...shower, teardownTime: "15:00" }, wedding, byTime), true);
    assert.equal(eventsCompete(ev("allday", {}), wedding, byTime), true);
    const late = ev("late", { startTime: "20:00", endTime: "01:00" });
    const w = stockWindow(late, "by_time");
    assert.equal(w.end - w.start, 5 * 60);
    assert.equal(eventsCompete(late, ev("nextmorning", { date: "2056-06-13", startTime: "03:00", endTime: "06:00" }), byTime), true);
  });

  it("multi-day events hold stock on every day", () => {
    const weekend = ev("weekend", { date: "2056-06-11", endDate: "2056-06-13" });
    assert.equal(eventsCompete(weekend, ev("sun", { date: "2056-06-13" }), sameDay), true);
    assert.equal(eventsCompete(weekend, ev("mon", { date: "2056-06-14" }), sameDay), false);
  });
});

describe("reservation state", () => {
  it("approved reserves, sent is pending, draft doesn't count", () => {
    assert.equal(reservationState({ sharedAt: "x", clientAgreedAt: "y" }), "reserved");
    assert.equal(reservationState({ sharedAt: "x", clientAgreedAt: null }), "pending");
    assert.equal(reservationState({ sharedAt: null, clientAgreedAt: null }), "none");
    assert.equal(reservationState(null), "none");
  });
});

describe("Event Order line stock picture", () => {
  it("counts approved events that compete; pending shown but not counted toward short", () => {
    const pendingBrunch = { ...brunch, state: "pending" as const };
    const [s] = stockForEvent(wedding, [shower, pendingBrunch, ev("draft", { state: "none", quantities: { chair: 500 } })], [chair], sameDay);
    assert.deepEqual(s!.reservedElsewhere.map((u) => u.eventId), ["shower"]);
    assert.deepEqual(s!.pendingElsewhere.map((u) => u.eventId), ["brunch"]);
    assert.equal(s!.short, 40, "100 here + 60 approved − 120 owned");
    assert.equal(stockSentence(s!, "2056-06-12"),
      "120 owned · 60 reserved by other events around Jun 12 · 50 more waiting on couple approval — 40 short");
  });

  it("by_time sharing removes the shortage", () => {
    const [s] = stockForEvent(wedding, [shower], [chair], byTime);
    assert.equal(s!.short, 0);
    assert.equal(stockSentence(s!, "2056-06-12"), "120 owned · none reserved by other events around Jun 12");
  });

  it("untracked items (quantity 0) never warn", () => {
    assert.deepEqual(stockForEvent(wedding, [shower], [{ ...chair, quantityAvailable: 0 }], sameDay), []);
  });

  it("couple's stock limit for an item not on their order is what's left at that time", () => {
    assert.equal(stockLeftForEvent(ev("couple", {}), [wedding, { ...shower, state: "pending" }], chair, sameDay), 20);
    assert.equal(stockLeftForEvent(ev("couple", { date: "2056-06-20" }), [wedding], chair, sameDay), 120);
  });
});

describe("inventory item upcoming dates", () => {
  it("each upcoming event with what it competes against; past events dropped", () => {
    const rows = upcomingForItem(chair, [wedding, shower, ev("past", { date: "2020-01-01", quantities: { chair: 5 } })], sameDay, "2026-10-30");
    assert.deepEqual(rows.map((r) => [r.name, r.reservedWithOthers, r.short]), [["shower", 160, 40], ["wedding", 160, 40]]);
    const shared = upcomingForItem(chair, [wedding, shower], byTime, "2026-10-30");
    assert.ok(shared.every((r) => r.short === 0));
  });
  it("a waiting row reads as what happens if approved, not as already reserved", () => {
    const pendingBrunch = ev("brunch", { state: "pending", quantities: { chair: 50 } });
    const rows = upcomingForItem(chair, [wedding, shower, pendingBrunch], sameDay, "2026-10-30");
    const row = (n: string) => rows.find((r) => r.name === n)!;
    assert.equal(row("brunch").reservedWithOthers, 210);
    assert.equal(upcomingRowSentence(row("brunch"), 120), "If approved: 90 short");
    assert.equal(upcomingRowSentence(row("wedding"), 120), "160 of 120 reserved at that time — 40 short");
    const small = upcomingForItem(chair, [ev("brunch", { state: "pending", quantities: { chair: 50 } })], sameDay, "2026-10-30");
    assert.equal(upcomingRowSentence(small[0]!, 120), "If approved: 50 of 120 reserved at that time");
    assert.match(read("components/inventory/item-upcoming-reservations.tsx"), /upcomingRowSentence\(r, owned\)/);
  });
});

describe("couple wording when stock is used up", () => {
  it("reads 'None left for your date'", () => {
    assert.equal(catalogLimitLabel({
      objectType: "table_round", name: "x", quantityAvailable: 0, quantityUsed: 0, remaining: 0,
      quantityConfigured: false, addable: false, limitSource: "stock",
    }), "None left for your date");
  });
});

describe("step 6 wiring", () => {
  const migration = read("supabase/migrations/20261426800000_inventory_stock_reservations.sql");
  it("SQL mirrors the TS rules", () => {
    assert.match(migration, /inventory_sharing_mode in \('same_day', 'by_time'\)/);
    assert.match(migration, /eo\.client_agreed_at is not null/, "only approved orders reserve");
    assert.match(migration, /o\.status in \('confirmed', 'complete'\)/);
    assert.match(migration, /coalesce\(e\.setup_time, e\.start_time\), coalesce\(e\.teardown_time, e\.end_time\)/);
    assert.match(migration, /t\.starts_at < ow\.ends_at \+ s\.gap\s+and ow\.starts_at < t\.ends_at \+ s\.gap/);
    assert.match(migration, /coalesce\(l\.inventory_item_id, f\.inventory_item_id\) = p_inventory_item_id/);
    assert.match(migration, /revoke all on function public\._inventory_reserved_elsewhere\(uuid, uuid, uuid\) from public, anon, authenticated/);
  });
  it("couple limit: Event Order quantity first, else stock minus reserved elsewhere", () => {
    assert.match(migration, /else greatest\(i\.quantity_available - public\._inventory_reserved_elsewhere\(v_ids\.venue_id, v_ids\.event_id, i\.id\), 0\)/);
    assert.match(migration, /else greatest\(v_item\.quantity_available - public\._inventory_reserved_elsewhere\(v_ids\.venue_id, v_ids\.event_id, v_item\.id\), 0\)/);
    assert.match(migration, /when q\.order_qty > 0 then q\.order_qty/);
  });
  it("read-only for the venue: no writes in the reservations service", () => {
    assert.doesNotMatch(read("lib/inventory/reservations-service.ts"), /\.(insert|update|upsert|delete)\(/);
  });
  it("venue surfaces: setting, EO line, item page", () => {
    assert.match(read("app/(app)/library/inventory/page.tsx"), /<StockSharingSetting/);
    assert.match(read("app/(app)/library/inventory/[id]/edit/page.tsx"), /<ItemUpcomingReservations/);
    assert.match(read("components/event-orders/event-order-panel.tsx"), /data-testid="eo-line-stock"/);
    assert.match(read("app/(app)/library/inventory/actions.ts"), /role !== "owner" && role !== "manager"/);
  });
});

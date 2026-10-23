/**
 * Event Order client agreement — share ≠ agree; reopen clears agreement.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildCommercialProgressSteps, buildCommercialStatusChips } from "@/lib/event-orders/commercial-status";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("Event Order client agreement", () => {
  it("migration adds agreement columns and accept RPC", () => {
    const mig = read("supabase/migrations/20261401000000_event_order_client_agreement.sql");
    assert.match(mig, /client_agreed_at/);
    assert.match(mig, /accept_event_order_for_portal/);
    assert.match(mig, /client_agreed/);
  });

  it("reopen clears client agreement fields", () => {
    const repo = read("lib/event-orders/repository.ts");
    assert.match(repo, /client_agreed_at: null/);
    assert.match(repo, /client_agreed_name: null/);
    assert.match(repo, /client_agreed_revision: null/);
  });

  it("portal accept API and UI exist", () => {
    assert.match(read("app/api/portal/event-order/accept/route.ts"), /accept_event_order_for_portal/);
    const view = read("components/portal/event-order-view.tsx");
    assert.match(view, /event-order-accept-panel/);
    assert.match(view, /Accept Event Order/);
    assert.match(view, /Sharing means your venue sent this for review/);
  });

  it("commercial checklist treats clientAgreedAt as Agreed, not finalize/share alone", () => {
    const sharedOnly = buildCommercialProgressSteps({
      showInventory: true,
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: "2026-01-01", clientAgreedAt: null },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
    });
    assert.equal(sharedOnly.find((s) => s.id === "order_agreed")?.state, "current");
    assert.equal(sharedOnly.find((s) => s.id === "order_agreed")?.label, "Agreed");

    const agreed = buildCommercialProgressSteps({
      showInventory: true,
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: "2026-01-01", clientAgreedAt: "2026-01-02" },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
    });
    assert.equal(agreed.find((s) => s.id === "order_agreed")?.state, "complete");

    const chips = buildCommercialStatusChips({
      showInventory: true,
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: "2026-01-01", clientAgreedAt: "2026-01-02" },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
    });
    assert.equal(chips.find((c) => c.id === "event_order")?.status, "Agreed");
  });
});

/**
 * Narrow B / B2 — gated recalc of open unapproved bound lines.
 *
 * Run: npx tsx --test lib/events/headcount-b2.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { shouldRecalcBoundLines } from "@/lib/events/headcount-recalc";
import { headcountRecalcEnabled } from "@/lib/events/headcount";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("B2 gate helpers", () => {
  it("allows open unshared unapproved; blocks finalized-unshared and approved", () => {
    assert.equal(shouldRecalcBoundLines({ status: "open", sharedAt: null, clientAgreedAt: null }), null);
    assert.equal(shouldRecalcBoundLines({ status: "finalized", sharedAt: null, clientAgreedAt: null }), "not_open");
    assert.equal(
      shouldRecalcBoundLines({ status: "open", sharedAt: null, clientAgreedAt: "2026-01-01T00:00:00Z" }),
      "approved",
    );
  });

  it("flag defaults on in test; production path stays fail-closed in source", () => {
    assert.equal(headcountRecalcEnabled(), true);
    const src = read("lib/events/headcount.ts");
    assert.match(src, /HEADCOUNT_RECALC_ENABLED/);
    assert.match(src, /env === "sandbox" \|\| process\.env\.NODE_ENV === "test"/);
  });
});

describe("B2 wiring contracts", () => {
  it("migration adds bound_to_headcount", () => {
    const sql = read("supabase/migrations/20261427100000_event_order_lines_bound_to_headcount.sql");
    assert.match(sql, /add column if not exists bound_to_headcount boolean not null default false/);
    assert.match(sql, /notes = 'Per person'/);
  });

  it("apply/seed stamp bound_to_headcount for per_person and per_guest", () => {
    const service = read("lib/event-orders/service.ts");
    assert.match(service, /boundToHeadcount: normalizeTemplatePricingModel\(line\.pricingModel\) === "per_person"/);
    assert.match(service, /boundToHeadcount: item\.perGuest === true/);
  });

  it("updateEvent_ recalcs only when bound count changes", () => {
    const svc = read("lib/events/service.ts");
    assert.match(svc, /recalculateBoundEventOrderLinesForEvent/);
    assert.match(svc, /prevBound !== nextBound/);
  });

  it("recalc module blocks approved and EO invoices; never updates invoices", () => {
    const recalc = read("lib/events/headcount-recalc.ts");
    assert.match(recalc, /return "approved"/);
    assert.match(recalc, /eo_invoice_draft/);
    assert.match(recalc, /eo_invoice_issued/);
    assert.match(recalc, /updateLineQuantityKeepingBound/);
    assert.doesNotMatch(recalc, /from\("invoices"\)[\s\S]*\.update\(/);
  });
});

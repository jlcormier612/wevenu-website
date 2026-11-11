/**
 * Narrow B / B4 — EO-linked invoice boundary + draft block.
 *
 * Run: npx tsx --test lib/events/headcount-b4.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { classifyBlockingEoInvoice } from "@/lib/events/headcount-recalc";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("B4 invoice classify", () => {
  it("allows recalc when no live EO invoices (void ignored)", () => {
    assert.equal(classifyBlockingEoInvoice([]), null);
    assert.equal(classifyBlockingEoInvoice([{ status: "void" }]), null);
    assert.equal(
      classifyBlockingEoInvoice([{ status: "void" }, { status: "void" }]),
      null,
    );
  });

  it("blocks draft EO invoices with draft reason", () => {
    assert.equal(classifyBlockingEoInvoice([{ status: "draft" }]), "eo_invoice_draft");
    assert.equal(
      classifyBlockingEoInvoice([{ status: "void" }, { status: "draft" }]),
      "eo_invoice_draft",
    );
  });

  it("blocks issued EO invoices; draft wins when both present", () => {
    assert.equal(classifyBlockingEoInvoice([{ status: "sent" }]), "eo_invoice_issued");
    assert.equal(classifyBlockingEoInvoice([{ status: "paid" }]), "eo_invoice_issued");
    assert.equal(
      classifyBlockingEoInvoice([{ status: "partially_paid" }]),
      "eo_invoice_issued",
    );
    assert.equal(
      classifyBlockingEoInvoice([{ status: "sent" }, { status: "draft" }]),
      "eo_invoice_draft",
    );
  });
});

describe("B4 wiring contracts", () => {
  it("recalc writes a blocked activity and never updates invoice rows", () => {
    const recalc = read("lib/events/headcount-recalc.ts");
    assert.match(recalc, /headcount_recalc_blocked/);
    assert.match(recalc, /draft Event Order invoice/);
    assert.match(recalc, /invoice was already issued/);
    assert.match(recalc, /classifyBlockingEoInvoice/);
    assert.doesNotMatch(recalc, /from\("invoices"\)[\s\S]*\.update\(/);
    assert.doesNotMatch(recalc, /eo_invoice_present/);
  });

  it("decision lock names B4 invoice boundary + draft block", () => {
    const lock = read("docs/qa/narrow-headcount/DECISION-LOCK.md");
    assert.match(lock, /\*\*B4\*\*.*Invoice boundary \+ draft block/);
    assert.match(lock, /Draft EO-linked invoice.*block recalc/i);
  });
});

/**
 * Draft Event Order–linked invoices store total=0 until freeze-on-send.
 * Payment schedule create/sync must use getInvoice's projected total — the
 * same figure the Invoice UI and Payment Plan Builder display.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("payment schedule uses projected EO draft invoice total", () => {
  it("createPaymentSchedule reconciles against getInvoice projected total", () => {
    const src = readFileSync(resolve("lib/payments/service.ts"), "utf8");
    const create = src.slice(src.indexOf("export async function createPaymentSchedule"));
    assert.match(create, /const projected = await getInvoice\(input\.invoiceId\)/);
    assert.match(create, /const totalAmount = projected\?\.total \?\? invoice\.total/);
    assert.match(
      create,
      /Payment schedule total \(\$\{scheduled\}\) must equal the invoice total \(\$\{totalAmount\}\)/,
    );
  });

  it("syncPaymentPlanToInvoiceCommitment uses projected commitment total", () => {
    const src = readFileSync(resolve("lib/payments/service.ts"), "utf8");
    const sync = src.slice(src.indexOf("export async function syncPaymentPlanToInvoiceCommitment"));
    assert.match(sync, /const projected = await getInvoice\(invoiceId\)/);
    assert.match(sync, /const commitmentTotal = projected\?\.total \?\? invoice\.total/);
  });

  it("documents the draft projection contract in invoices service", () => {
    const inv = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
    assert.match(inv, /draft Invoice linked to an Event Order is a live/);
    assert.match(inv, /projectEventOrderLines/);
  });
});

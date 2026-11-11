/**
 * Sent invoices must not have their line items changed.
 *
 * assertInvoiceEditable is the single enforcement point for that rule — a
 * financial safety control that had no direct coverage. Reverting to draft
 * stays the one explicit path back to an editable invoice.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertInvoiceEditable } from "@/lib/invoices/service";

const VENUE = "venue-1";
const INVOICE = "invoice-1";

/** Mirrors the one query the guard makes: from.select.eq.eq.maybeSingle. */
function clientReturning(row: { status: string } | null) {
  const calls: { table?: string; filters: Array<[string, string]> } = { filters: [] };
  const chain = {
    select: () => chain,
    eq: (column: string, value: string) => {
      calls.filters.push([column, value]);
      return chain;
    },
    maybeSingle: async () => ({ data: row }),
  };
  const client = {
    from: (table: string) => {
      calls.table = table;
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { calls, client: client as any };
}

describe("assertInvoiceEditable", () => {
  it("permits editing a draft invoice", async () => {
    const { client } = clientReturning({ status: "draft" });
    assert.equal(await assertInvoiceEditable(client, VENUE, INVOICE), null);
  });

  it("refuses a sent invoice and says how to proceed", async () => {
    const { client } = clientReturning({ status: "sent" });
    const result = await assertInvoiceEditable(client, VENUE, INVOICE);
    assert.ok(result, "a sent invoice must be refused");
    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /no longer a draft/);
    assert.match(result.message ?? "", /revert it to draft/);
  });

  it("refuses every other resolved status, not just sent", async () => {
    for (const status of ["paid", "void", "overdue", "partially_paid"]) {
      const { client } = clientReturning({ status });
      const result = await assertInvoiceEditable(client, VENUE, INVOICE);
      assert.ok(result, `status ${status} must be refused`);
      assert.equal(result.ok, false, `status ${status} must be refused`);
    }
  });

  it("handles a missing invoice without leaking it as editable", async () => {
    const { client } = clientReturning(null);
    const result = await assertInvoiceEditable(client, VENUE, INVOICE);
    assert.ok(result);
    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /Invoice not found/);
  });

  it("scopes the lookup to the caller's venue", async () => {
    const { client, calls } = clientReturning({ status: "draft" });
    await assertInvoiceEditable(client, VENUE, INVOICE);
    assert.equal(calls.table, "invoices");
    assert.deepEqual(calls.filters, [["id", INVOICE], ["venue_id", VENUE]]);
  });
});

describe("both line-item mutations go through that one guard", () => {
  const service = readFileSync(resolve("lib/invoices/service.ts"), "utf8");

  for (const fn of ["addLineItem", "removeLineItem"]) {
    it(`${fn} calls the guard before touching the invoice`, () => {
      const start = service.indexOf(`export async function ${fn}(`);
      assert.ok(start > 0, `${fn} must exist`);
      const body = service.slice(start, service.indexOf("\n}", start));
      const guardAt = body.indexOf("assertInvoiceEditable");
      const repoAt = body.indexOf(`repo.${fn}(`);
      assert.ok(guardAt > 0, `${fn} must call assertInvoiceEditable`);
      assert.ok(repoAt > guardAt, `${fn} must guard before writing`);
      assert.match(body, /if \(guard\) return guard/);
    });
  }

  it("reverting to draft remains the draft-edit path; post-payment credit is a separate explicit action", () => {
    assert.match(service, /Only a sent invoice can be reverted to draft\./);
    assert.match(service, /export async function applyPostPaymentCredit/);
  });
});

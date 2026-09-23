import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultInvoiceDisplayName,
  invoiceHumanLabel,
  invoiceSystemNumber,
} from "@/lib/invoices/display-name";

describe("invoice display name", () => {
  it("defaults deposit requests to Wedding Deposit", () => {
    assert.equal(defaultInvoiceDisplayName({ obligationKind: "deposit" }), "Wedding Deposit");
  });

  it("prefers schedule line label when present", () => {
    assert.equal(
      defaultInvoiceDisplayName({ obligationKind: "deposit", scheduleLabel: "Initial Payment" }),
      "Initial Payment",
    );
  });

  it("human label never falls back to ledger invoice_number", () => {
    assert.equal(
      invoiceHumanLabel({ displayName: null, invoiceNumber: "INV-DEPMAL-MUED28ME" }),
      "Invoice",
    );
    assert.equal(
      invoiceHumanLabel({ displayName: "Wedding Deposit", invoiceNumber: "INV-DEPMAL-MUED28ME" }),
      "Wedding Deposit",
    );
  });

  it("keeps system number separate", () => {
    assert.equal(invoiceSystemNumber({ invoiceNumber: "INV-DEPMAL-MUED28ME" }), "INV-DEPMAL-MUED28ME");
  });
});

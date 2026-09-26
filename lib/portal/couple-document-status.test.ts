import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  coupleContractStatusBadge,
  coupleDocumentStatusBadge,
  coupleInvoiceStatusBadge,
} from "@/lib/portal/couple-document-status";

describe("couple document status badges", () => {
  it("a sent invoice is issued, not awaiting a signature", () => {
    const badge = coupleInvoiceStatusBadge("sent");
    assert.equal(badge?.label, "Issued");
    assert.doesNotMatch(badge?.label ?? "", /signature|sign/i);
    assert.equal(coupleDocumentStatusBadge("invoice", "sent")?.label, "Issued");
  });

  it("an Event & Inventory Selections invoice uses invoice language only", () => {
    const badge = coupleDocumentStatusBadge("invoice", "sent");
    assert.equal(badge?.label, "Issued");
    assert.notEqual(badge?.label, coupleContractStatusBadge("sent")?.label);
  });

  it("a paid invoice is Paid", () => {
    assert.equal(coupleInvoiceStatusBadge("paid")?.label, "Paid");
  });

  it("a sent contract still awaits the couple signature", () => {
    assert.equal(coupleContractStatusBadge("sent")?.label, "Awaiting your signature");
    assert.equal(coupleDocumentStatusBadge("contract", "sent")?.label, "Awaiting your signature");
  });

  it("a signed contract stays Signed", () => {
    assert.equal(coupleContractStatusBadge("signed")?.label, "Signed");
    assert.equal(coupleDocumentStatusBadge("contract", "signed")?.label, "Signed");
  });

  it("shared lookup does not put signature language on invoices", () => {
    assert.equal(coupleDocumentStatusBadge("invoice", "sent")?.label, "Issued");
    assert.equal(coupleDocumentStatusBadge("invoice", "paid")?.label, "Paid");
    assert.doesNotMatch(coupleDocumentStatusBadge("invoice", "sent")?.label ?? "", /signature/i);
  });

  it("Documents uses type-specific badges and keeps the contract sign CTA", () => {
    const src = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
    assert.match(src, /coupleDocumentStatusBadge/);
    const invoiceCard = src.slice(src.indexOf("function InvoiceCard"), src.indexOf("function DocRow"));
    assert.doesNotMatch(invoiceCard, /Awaiting your signature/);
    assert.match(src, /needsSignature = doc\.status === "sent" && !!doc\.signToken/);
    assert.match(src, /Review &amp; sign/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("pre-portal payment access", () => {
  it("invoice email creates financial sessions when couple portal is not invited", () => {
    const source = readFileSync(resolve("lib/invoices/outbound.ts"), "utf8");
    assert.match(source, /createPortalSession\(clientId, "Payment", "financial"\)/);
    assert.doesNotMatch(
      source,
      /createPortalSession\([^,]+, "Payment", "couple"\)/,
    );
    assert.doesNotMatch(source, /createPortalSession\(clientId, "Documents", "couple"\)/);
    assert.match(source, /invoicePlanUrl/);
  });

  it("portal page routes financial access to PaymentAccessShell", () => {
    const page = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
    assert.match(page, /accessLevel === "financial"/);
    assert.match(page, /PaymentAccessShell/);
  });

  it("PaymentAccessShell has no full portal navigation", () => {
    const shell = readFileSync(
      resolve("components/portal/payment-access-shell.tsx"),
      "utf8",
    );
    assert.doesNotMatch(shell, /Tasks/);
    assert.doesNotMatch(shell, /Timeline/);
    assert.doesNotMatch(shell, /Floor Plan/);
    assert.doesNotMatch(shell, /Vendors/);
    assert.match(shell, /Pay \$\{formatCurrency\(payableLine\.amount\)\} Now/);
    assert.match(shell, /What&apos;s next/);
    assert.match(shell, /Invoice &amp; Payment Plan/);
  });
});

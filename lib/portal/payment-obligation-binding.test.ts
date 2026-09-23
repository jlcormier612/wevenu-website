import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { pickNextOpenPaymentLine } from "@/lib/invoices/amount-due-now";

describe("payment-access obligation binding", () => {
  it("invoice email CTA embeds the due-now payment_line_item id", () => {
    const source = readFileSync(resolve("app/(app)/invoices/actions.ts"), "utf8");
    assert.match(source, /pickNextOpenPaymentLine/);
    assert.match(source, /\?item=\$\{encodeURIComponent\(dueNowLine\.id\)\}/);
    assert.match(source, /dueNowLine/);
  });

  it("PaymentAccessShell binds ?item= and does not upgrade paid requests to next unpaid", () => {
    const shell = readFileSync(resolve("components/portal/payment-access-shell.tsx"), "utf8");
    assert.match(shell, /requestedItemId/);
    assert.match(shell, /searchParams\.get\("item"\)/);
    assert.match(shell, /boundAlreadyPaid/);
    assert.match(shell, /pickNextOpenPaymentLine/);
    assert.match(shell, /already been received/);
  });

  it("checkout return URLs preserve item binding", () => {
    const checkout = readFileSync(resolve("lib/stripe/checkout.ts"), "utf8");
    assert.match(checkout, /item=\$\{encodeURIComponent\(ctx\.itemId\)\}/);
    assert.match(checkout, /unit_amount: Math\.round\(ctx\.itemAmount \* 100\)/);
  });

  it("pickNextOpen still selects deposit before remaining when both pending", () => {
    const next = pickNextOpenPaymentLine([
      {
        id: "rem",
        amount: 6900,
        dueDate: "2026-09-23",
        status: "pending",
        label: "Remaining Balance",
        obligationKind: "final",
        sortOrder: 1,
      },
      {
        id: "dep",
        amount: 800,
        dueDate: "2026-09-23",
        status: "pending",
        label: "Initial Payment",
        obligationKind: "deposit",
        sortOrder: 0,
      },
    ]);
    assert.equal(next?.id, "dep");
    assert.equal(next?.amount, 800);
  });
});

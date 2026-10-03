import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { paymentAttentionReasons } from "@/lib/payments/attention-reasons";

describe("payment attention reasons", () => {
  it("names overdue, refunded, and partially refunded separately", () => {
    assert.deepEqual(
      paymentAttentionReasons({ overdueCount: 2, refundedCount: 1, partiallyRefundedCount: 1 }),
      ["2 overdue payments", "1 refunded payment", "1 partially refunded payment"],
    );
  });

  it("omits zero counts", () => {
    assert.deepEqual(
      paymentAttentionReasons({ overdueCount: 0, refundedCount: 0, partiallyRefundedCount: 0 }),
      [],
    );
  });
});

describe("payments list is not an attention-only queue", () => {
  it("defaults to All and keeps Action Required as an explicit filter", () => {
    const page = readFileSync(resolve("app/(app)/payments/page.tsx"), "utf8");
    const filters = readFileSync(resolve("lib/payments/list-filters.ts"), "utf8");
    assert.match(page, /All includes every payment plan/);
    assert.match(filters, /value: "all", label: "All"/);
    assert.match(filters, /value: "action_required", label: "Action Required"/);
    assert.match(filters, /DEFAULT_PAYMENT_LIST_FILTER: PaymentListFilterKey = "all"/);
    assert.doesNotMatch(page, /Show all/);
  });
});

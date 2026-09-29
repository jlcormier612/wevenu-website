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

describe("payments default view is the attention queue", () => {
  it("treats missing filter as attention and keeps ?filter=attention and Show all", () => {
    const page = readFileSync(resolve("app/(app)/payments/page.tsx"), "utf8");
    assert.match(page, /filter !== "all"/);
    assert.match(page, /filter=attention/);
    assert.match(page, /filter=all/);
    assert.match(page, /Show all/);
    assert.match(page, /scheduleStatus === "attention"/);
    assert.match(page, /excludeFromBusinessReporting/);
  });
});

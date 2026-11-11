import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NAV_SECTIONS } from "@/lib/navigation";
import {
  badgeCountForNavItem,
  navAttentionHref,
} from "@/lib/navigation/attention";

describe("Financials primary nav cleanup", () => {
  it("keeps Contracts and Payments and removes Invoices from primary nav", () => {
    const financials = NAV_SECTIONS.find((s) => s.id === "financials");
    assert.ok(financials);
    assert.deepEqual(
      financials.items.map((i) => ({ id: i.id, href: i.href, title: i.title })),
      [
        { id: "contracts", href: "/contracts", title: "Contracts" },
        { id: "payments", href: "/payments", title: "Payments" },
      ],
    );
  });

  it("does not delete invoice routes", () => {
    for (const rel of [
      "app/(app)/invoices/page.tsx",
      "app/(app)/invoices/new/page.tsx",
      "app/(app)/invoices/[id]/page.tsx",
    ]) {
      assert.ok(existsSync(resolve(rel)), rel);
    }
  });

  it("badges contracts as Draft + Awaiting Venue Signature only", () => {
    const counts = { leads: 0, tours: 0, inbox: 0, tasks: 0, payments: 4, contracts: 3 };
    assert.equal(badgeCountForNavItem("contracts", counts), 3);
    assert.equal(badgeCountForNavItem("payments", counts), 4);
    assert.equal(navAttentionHref("contracts", "/contracts", 3), "/contracts?filter=action_required");
    assert.equal(navAttentionHref("payments", "/payments", 2), "/payments?filter=attention");
  });

  it("payments attention definition is still deriveScheduleStatus, not installment/invoice counts", () => {
    const attention = readFileSync(resolve("lib/navigation/attention.ts"), "utf8");
    assert.match(attention, /deriveScheduleStatus\(schedule\.lineItems\) === "attention"/);
    assert.match(attention, /excludeFromBusinessReporting/);
    assert.doesNotMatch(attention, /due.?soon/i);
  });
});

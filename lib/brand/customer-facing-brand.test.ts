import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { QUICKBOOKS_DEFAULT_ITEM_NAME } from "@/lib/quickbooks/config";
import { publicAppOrigin } from "@/lib/env";

const ROOT = join(import.meta.dirname, "../..");

/** Customer-facing modules that must never hardcode the retired Wevenu brand. */
const CUSTOMER_FACING_URL_SOURCES = [
  "lib/conversations/notify.ts",
  "lib/client-auth/service.ts",
  "lib/contacts/service.ts",
  "lib/contracts/service.ts",
  "lib/brochures/service.ts",
  "lib/vendor-invites/service.ts",
  "lib/vendors/notify-assignment.ts",
  "lib/tours/communication.ts",
  "lib/notifications/digest-engine.ts",
  "lib/saved-reports/schedule-engine.ts",
  "lib/event-orders/representation.ts",
  "lib/feedback/notify.ts",
  "app/api/portal/messages/route.ts",
  "app/api/portal/participants/route.ts",
  "app/api/portal/export/route.ts",
  "components/settings/data-export-section.tsx",
  "components/settings/import-wizard.tsx",
];

describe("customer-facing brand — Hello to Cheers", () => {
  it("QuickBooks default item name is Hello to Cheers Services (never Wevenu)", () => {
    assert.equal(QUICKBOOKS_DEFAULT_ITEM_NAME, "Hello to Cheers Services");
    assert.doesNotMatch(QUICKBOOKS_DEFAULT_ITEM_NAME, /wevenu/i);
  });

  it("publicAppOrigin never falls back to a wevenu.com host", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      assert.doesNotMatch(publicAppOrigin(), /wevenu/i);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });

  it("customer-facing link/export sources do not hardcode wevenu brand strings", () => {
    for (const rel of CUSTOMER_FACING_URL_SOURCES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(
        src,
        /app\.wevenu\.com|feedback@wevenu\.com|wevenu-export-|my-wevenu-data|wevenu-.*-template\.csv/i,
        `${rel} still contains a customer-visible Wevenu string`,
      );
    }
  });

  it("QuickBooks private notes use Hello to Cheers prefix for new syncs", () => {
    const payment = readFileSync(join(ROOT, "lib/quickbooks/sync/payment.ts"), "utf8");
    const refund = readFileSync(join(ROOT, "lib/quickbooks/sync/refund.ts"), "utf8");
    assert.match(payment, /htc:payment_line_item:/);
    assert.match(refund, /htc:payment_refund:/);
    assert.match(payment, /PrivateNote: privateNote/);
    assert.match(refund, /PrivateNote: privateNote/);
  });

  it("Stripe Checkout metadata uses htc_ keys for new sessions", () => {
    const checkout = readFileSync(join(ROOT, "lib/stripe/checkout.ts"), "utf8");
    assert.match(checkout, /htc_payment_line_item_id/);
    assert.doesNotMatch(checkout, /wevenu_payment_line_item_id:\s*ctx/);
  });

  it("venue-facing terminology labels match the product language decisions", () => {
    const dashboard = readFileSync(join(ROOT, "app/(app)/dashboard/page.tsx"), "utf8");
    const relationshipCard = readFileSync(join(ROOT, "components/leads/relationship-card.tsx"), "utf8");
    const calendar = readFileSync(join(ROOT, "components/calendar/calendar-shared.tsx"), "utf8");
    const reportsLayout = readFileSync(join(ROOT, "app/(app)/reporting/layout.tsx"), "utf8");

    assert.match(dashboard, /title="Coming up"/);
    assert.match(dashboard, /label="Coming up"/);
    assert.match(dashboard, />View Reports</);
    assert.doesNotMatch(dashboard, /View full Reporting/);

    assert.match(relationshipCard, /CardTitle[^>]*>Follow-up</);
    assert.doesNotMatch(relationshipCard, />Relationship</);

    assert.match(calendar, />\s*Convert to Lead\s*</);
    assert.doesNotMatch(calendar, />\s*Convert to Booking\s*</);

    assert.match(reportsLayout, /title: "Reports"/);
    assert.match(reportsLayout, /title="Reports"/);
  });
});

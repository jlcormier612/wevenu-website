/**
 * Regression: Wave G hospitality presentation ports must stay on main.
 * Presentation-only — does not require deferred feature modules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Wave G hospitality presentation parity", () => {
  const pages = [
    "app/(app)/contracts/page.tsx",
    "app/(app)/leads/pipeline/page.tsx",
    "app/(app)/settings/page.tsx",
    "app/(app)/tasks/page.tsx",
    "app/(app)/requests/page.tsx",
    "app/(app)/help/page.tsx",
    "app/(app)/messaging/health/page.tsx",
    "app/(app)/invoices/page.tsx",
    "app/(app)/packages/page.tsx",
  ];

  it("keeps hospitality page + intro heading chrome on core staff pages", () => {
    for (const path of pages) {
      const src = read(path);
      assert.match(src, /htc-hospitality-page/, path);
      assert.match(src, /htc-hospitality-heading/, path);
      assert.match(src, /htc-hospitality-intro-accent/, path);
    }
  });

  it("keeps warm-border / record-link / working-surface recipes on list workspaces", () => {
    const contracts = read("components/contracts/contract-list.tsx");
    const vendors = read("components/vendors/vendor-list.tsx");
    const payments = read("components/payments/payment-schedule-list.tsx");
    const requests = read("components/requests/request-manager.tsx");
    const docs = read("components/document-workspace/document-workspace.tsx");
    const brochure = read("components/brochures/brochure-detail.tsx");

    assert.match(contracts, /htc-record-link/);
    assert.match(contracts, /--htc-border-warm/);
    assert.match(vendors, /htc-record-link/);
    assert.match(vendors, /htc-badge-attention/);
    assert.match(payments, /htc-hospitality-table/);
    assert.match(payments, /htc-surface-guidance/);
    assert.match(requests, /htc-surface-working/);
    assert.match(requests, /htc-hospitality-table/);
    assert.match(docs, /htc-hospitality-section-label/);
    assert.match(docs, /htc-hospitality-toolbar/);
    assert.match(brochure, /htc-hospitality-page/);
    assert.match(brochure, /htc-working-card/);
  });

  it("keeps dashboard ready-to-invite from walling operational content", () => {
    const service = read("lib/dashboard/service.ts");
    assert.doesNotMatch(
      service,
      /if\s*\(\s*!readyToInviteCouples\s*\)\s*\{\s*return\s+null/,
    );
  });
});

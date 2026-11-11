/**
 * Vendor assignment fee semantics + required-vendor removal request rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const eventVendors = read("components/events/vendors/event-vendors-section.tsx");
const vendorWorkspace = read("components/vendor-app/vendor-event-workspace.tsx");
const repo = read("lib/vendors/repository.ts");
const types = read("lib/vendors/types.ts");
const portal = read("components/portal/vendor-section.tsx");
const submitSql = read(
  "supabase/migrations/20261422500000_submit_vendor_list_exclude_required.sql",
);
const removalService = read("lib/vendor-removal-requests/service.ts");
const vendorActions = read("app/(app)/events/[id]/vendor-actions.ts");

describe("vendor assignment fee — venue cost, not couple charge", () => {
  it("persists agreed_fee / payment_status on event_vendor_assignments only", () => {
    assert.match(repo, /agreed_fee: agreedFee/);
    assert.match(repo, /payment_status: paymentStatus/);
    assert.match(types, /agreedFee:\s+number \| null/);
    assert.match(
      eventVendors,
      /what the venue owes this vendor|Venue cost for this vendor|venue owes/i,
    );
  });

  it("venue UI labels the amount as venue cost, not a couple charge", () => {
    assert.match(eventVendors, /Venue cost \$\{fee\.toLocaleString\(\)\}/);
    assert.match(eventVendors, /\+ Add venue cost/);
    assert.match(eventVendors, /Not a couple charge or Event Order line/);
    assert.match(eventVendors, /not charged to the couple/i);
  });

  it("vendor sees coordination amount; couple portal has no agreedFee surface", () => {
    assert.match(vendorWorkspace, /Venue cost for this event/);
    assert.match(vendorWorkspace, /not a couple charge/i);
    assert.doesNotMatch(portal, /agreedFee|agreed_fee|Venue cost \$/);
  });

  it("fee path is venue-staff setVendorAssignmentPayment only (no EO/invoice imports)", () => {
    assert.match(vendorActions, /setVendorAssignmentPaymentAction/);
    assert.doesNotMatch(vendorActions, /event.order|invoice|payment.plan/i);
    assert.doesNotMatch(eventVendors, /from \"@\/lib\/event-orders/);
    assert.doesNotMatch(eventVendors, /from \"@\/lib\/invoices/);
  });
});

describe("required vendor withdrawal — couple cannot invent removal via submit", () => {
  it("submit_vendor_list excludes active is_required relationships from removal CTE", () => {
    assert.match(submitSql, /submit_vendor_list/);
    assert.match(submitSql, /venue_vendor_relationships vvr/);
    assert.match(submitSql, /vvr\.is_required = true/);
    assert.match(submitSql, /vvr\.status = 'active'/);
    assert.match(submitSql, /must not invent/);
  });

  it("migration repairs pending couple requests on currently-required vendors", () => {
    assert.match(submitSql, /requested_by = 'couple'/);
    assert.match(submitSql, /status = 'dismissed'/);
    assert.match(submitSql, /is_required = true/);
  });

  it("portal UI blocks picking required vendors (client-side)", () => {
    assert.match(portal, /!viewingRec\.isRequired/);
    assert.match(portal, /Required for your event — your venue includes this vendor/);
  });

  it("dismiss keeps assignment; remove is venue-only hard delete with required override copy", () => {
    assert.match(removalService, /status: \"dismissed\"/);
    assert.match(eventVendors, /Request dismissed — vendor stays assigned/);
    assert.match(eventVendors, /overrides the venue Required designation/);
    assert.match(eventVendors, /Remove \(override required\)/);
    assert.match(eventVendors, /Dismiss request — keep vendor assigned/);
    assert.match(vendorActions, /dismissVendorRemovalRequestAction/);
    assert.match(vendorActions, /removeVendorAssignmentAction/);
  });

  it("couple has no direct remove-assignment server action in portal vendor section", () => {
    assert.doesNotMatch(portal, /removeVendorAssignmentAction/);
    assert.doesNotMatch(portal, /deleteVendorAssignment/);
  });
});
